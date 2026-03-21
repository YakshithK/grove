use serde::Serialize;
use std::collections::HashMap;
use std::process::Command;
use tauri::State;

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::path::PathBuf;

/// API key resolution order:
/// 1. VISH_API_KEY baked in at compile time (CI builds)
/// 2. GEMINI_API_KEY baked in at compile time (dev builds)
/// 3. GEMINI_API_KEY from runtime environment
/// 4. GEMINI_API_KEY from .env file
/// 5. Empty (user must enter in Settings — not expected for shipped builds)
const BUNDLED_API_KEY: Option<&str> = option_env!("VISH_API_KEY");
const BUNDLED_GEMINI_KEY: Option<&str> = option_env!("GEMINI_API_KEY");

fn resolve_api_key() -> String {
    // 1. Compile-time VISH_API_KEY (CI)
    if let Some(key) = BUNDLED_API_KEY {
        if !key.is_empty() { return key.to_string(); }
    }
    // 2. Compile-time GEMINI_API_KEY (dev)
    if let Some(key) = BUNDLED_GEMINI_KEY {
        if !key.is_empty() { return key.to_string(); }
    }
    // 3. Runtime env var
    if let Ok(key) = std::env::var("GEMINI_API_KEY") {
        if !key.is_empty() { return key; }
    }
    // 4. .env file in current dir or project root
    if let Ok(contents) = std::fs::read_to_string(".env") {
        for line in contents.lines() {
            let line = line.trim();
            if let Some(val) = line.strip_prefix("GEMINI_API_KEY=") {
                let val = val.trim().trim_matches('"').trim_matches('\'');
                if !val.is_empty() { return val.to_string(); }
            }
        }
    }
    String::new()
}

pub struct AppState {
    pub api_key: Arc<tokio::sync::Mutex<String>>,
    pub http_client: reqwest::Client,
    pub vector_store: Arc<crate::store::vector::VectorStore>,
    pub files_done: Arc<AtomicU32>,
    pub files_total: Arc<AtomicU32>,
    pub status: Arc<tokio::sync::Mutex<String>>,
    pub indexed_files: Arc<tokio::sync::Mutex<Vec<PathBuf>>>,
}

impl AppState {
    pub fn new(data_dir: PathBuf) -> Self {
        let api_key = resolve_api_key();

        let vector_dir = data_dir.join("vectors");
        let vector_store = crate::store::vector::VectorStore::new(vector_dir)
            .expect("Failed to initialize vector store");

        Self {
            api_key: Arc::new(tokio::sync::Mutex::new(api_key)),
            http_client: reqwest::Client::new(),
            vector_store: Arc::new(vector_store),
            files_done: Arc::new(AtomicU32::new(0)),
            files_total: Arc::new(AtomicU32::new(0)),
            status: Arc::new(tokio::sync::Mutex::new("idle".to_string())),
            indexed_files: Arc::new(tokio::sync::Mutex::new(Vec::new())),
        }
    }
}

#[derive(Serialize)]
pub struct IndexerStatus {
    pub status: String,
    pub files_done: u32,
    pub files_total: u32,
    pub eta_secs: Option<u32>,
}

const CHUNK_TOKENS: usize = 512;
const CHUNK_OVERLAP: usize = 64;
const EMBED_BATCH_SIZE: usize = 100; // Gemini supports up to 100 per batch
const MAX_CONCURRENT_FILES: usize = 8;

// Map file extension to MIME type for native Gemini multimodal embedding
fn mime_for_ext(ext: &str) -> Option<&'static str> {
    match ext {
        "pdf" => Some("application/pdf"),
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "webp" => Some("image/webp"),
        "mp4" => Some("video/mp4"),
        "mov" => Some("video/quicktime"),
        "mp3" => Some("audio/mpeg"),
        "wav" => Some("audio/wav"),
        "m4a" => Some("audio/mp4"),
        _ => None,
    }
}

#[tauri::command]
pub async fn set_api_key(key: String, state: State<'_, AppState>) -> Result<(), String> {
    *state.api_key.lock().await = key;
    Ok(())
}

#[tauri::command]
pub async fn get_api_key(state: State<'_, AppState>) -> Result<String, String> {
    let key = state.api_key.lock().await.clone();
    // Return masked version for security — just indicate if set or not
    if key.is_empty() {
        Ok(String::new())
    } else {
        Ok("set".to_string())
    }
}

#[tauri::command]
pub async fn check_index_exists(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.vector_store.has_points().await)
}

#[tauri::command]
pub async fn get_point_count(state: State<'_, AppState>) -> Result<usize, String> {
    Ok(state.vector_store.point_count().await)
}

#[tauri::command]
pub async fn start_indexing(folders: Vec<String>, state: State<'_, AppState>) -> Result<(), String> {
    if folders.is_empty() {
        return Err("No folders provided to index.".to_string());
    }

    let api_key = state.api_key.lock().await.clone();
    if api_key.is_empty() {
        return Err("No Gemini API key set. Please add your API key in Settings first.".to_string());
    }

    let paths: Vec<PathBuf> = folders.into_iter().map(PathBuf::from).collect();
    for p in &paths {
        if !p.exists() || !p.is_dir() {
            return Err(format!("Invalid directory path: {}", p.display()));
        }
    }

    *state.status.lock().await = "running".to_string();

    let files_done = state.files_done.clone();
    let files_total = state.files_total.clone();
    let status_arc = state.status.clone();
    let indexed_files = state.indexed_files.clone();
    let vector_store = state.vector_store.clone();
    let http_client = state.http_client.clone();
    let api_key_arc = state.api_key.clone();

    // NOTE: We do NOT call vector_store.clear() — the index persists across sessions.
    // Individual files are deduped before re-embedding (see delete_by_payload below).
    // The next_point_id is derived from max existing ID + 1 to avoid collisions.

    tokio::spawn(async move {
        // User requested: Re-scanning completely wipes the old index to start fresh
        if let Err(e) = vector_store.clear().await {
            eprintln!("Failed to clear old index: {}", e);
        }

        let all_files: Vec<PathBuf> = crate::indexer::crawler::crawl(&paths).collect();
        files_total.store(all_files.len() as u32, Ordering::SeqCst);
        files_done.store(0, Ordering::SeqCst);
        indexed_files.lock().await.clear();

        let next_point_id = Arc::new(AtomicU32::new(
            vector_store.max_point_id().await.map(|id| id as u32 + 1).unwrap_or(0)
        ));

        // Use a semaphore to limit concurrent file processing
        let semaphore = Arc::new(tokio::sync::Semaphore::new(MAX_CONCURRENT_FILES));
        let mut handles = Vec::new();

        for (i, file_path) in all_files.into_iter().enumerate() {
            // Check if stopped
            {
                let st = status_arc.lock().await.clone();
                if st == "idle" { break; }
            }

            // Wait while paused
            loop {
                let st = status_arc.lock().await.clone();
                if st == "running" { break; }
                if st == "idle" { return; }
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }

            let permit = semaphore.clone().acquire_owned().await.unwrap();
            let vs = vector_store.clone();
            let hc = http_client.clone();
            let ak = api_key_arc.clone();
            let fd = files_done.clone();
            let idx_files = indexed_files.clone();
            let pid = next_point_id.clone();
            let fp = file_path.clone();
            let _file_idx = i;

            let handle = tokio::spawn(async move {
                let _permit = permit; // held until this task finishes

                let ext = fp.extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                let api_key = ak.lock().await.clone();

                // Remove any existing vectors for this file before re-embedding
                let path_str = fp.display().to_string();
                if let Err(e) = vs.delete_by_payload("path", &path_str).await {
                    eprintln!("Failed to remove old vectors for {:?}: {}", fp, e);
                }

                // Check if this file type can be natively embedded by Gemini (PDF, images)
                if let Some(mime) = mime_for_ext(&ext) {
                    let bytes = match std::fs::read(&fp) {
                        Ok(b) => b,
                        Err(_) => {
                            fd.fetch_add(1, Ordering::SeqCst);
                            return;
                        }
                    };

                    // Skip very large files (>10MB)
                    if bytes.len() > 10 * 1024 * 1024 {
                        fd.fetch_add(1, Ordering::SeqCst);
                        return;
                    }

                    let b64 = base64::Engine::encode(
                        &base64::engine::general_purpose::STANDARD,
                        &bytes,
                    );
                    
                    let filename = fp.file_name().unwrap_or_default().to_string_lossy();
                    let req = crate::embedding::client::make_binary_request(&b64, mime, Some(&filename));
                    match crate::embedding::client::batch_embed(&hc, &api_key, vec![req]).await {
                        Ok(embeddings) => {
                            if let Some(embedding) = embeddings.into_iter().next() {
                                let point_id = pid.fetch_add(1, Ordering::SeqCst) as u64;
                                let mut payload = std::collections::HashMap::new();
                                payload.insert("path".to_string(), fp.display().to_string());
                                payload.insert("file_type".to_string(), ext.clone());
                                payload.insert("chunk_text".to_string(),
                                    format!("[{} file: {}]", ext.to_uppercase(),
                                        fp.file_name().unwrap_or_default().to_string_lossy()));

                                let point = crate::store::vector::StoredPoint {
                                    id: point_id,
                                    vector: embedding,
                                    payload,
                                };
                                if let Err(e) = vs.upsert(vec![point]).await {
                                    eprintln!("Vector store error: {}", e);
                                }
                            }
                        }
                        Err(e) => eprintln!("Embed error for {:?}: {}", fp, e),
                    }
                } else {
                    // Text-based files: extract → chunk → embed
                    let text = match crate::indexer::extractor::extract_content(&fp) {
                        Ok(t) => t,
                        Err(_) => {
                            fd.fetch_add(1, Ordering::SeqCst);
                            return;
                        }
                    };

                    if text.trim().is_empty() {
                        fd.fetch_add(1, Ordering::SeqCst);
                        return;
                    }

                    let chunks = crate::indexer::chunker::chunk_text_for_extension(
                        &text,
                        &ext,
                        CHUNK_TOKENS,
                        CHUNK_OVERLAP,
                    );
                    if chunks.is_empty() {
                        fd.fetch_add(1, Ordering::SeqCst);
                        return;
                    }

                    let filename = fp.file_name().unwrap_or_default().to_string_lossy();
                    for batch in chunks.chunks(EMBED_BATCH_SIZE) {
                        let embed_requests: Vec<_> = batch.iter()
                            .map(|chunk| crate::embedding::client::make_text_request(chunk, Some(&filename)))
                            .collect();

                        let embeddings = match crate::embedding::client::batch_embed(
                            &hc, &api_key, embed_requests,
                        ).await {
                            Ok(e) => e,
                            Err(err) => {
                                eprintln!("Embed error for {:?}: {}", fp, err);
                                continue;
                            }
                        };

                        let mut points = Vec::new();
                        for (j, embedding) in embeddings.into_iter().enumerate() {
                            let chunk_text = batch.get(j).cloned().unwrap_or_default();
                            let point_id = pid.fetch_add(1, Ordering::SeqCst) as u64;
                            let mut payload = std::collections::HashMap::new();
                            payload.insert("path".to_string(), fp.display().to_string());
                            payload.insert("file_type".to_string(), ext.clone());
                            payload.insert("chunk_text".to_string(), chunk_text.chars().take(500).collect());

                            points.push(crate::store::vector::StoredPoint {
                                id: point_id,
                                vector: embedding,
                                payload,
                            });
                        }

                        if let Err(e) = vs.upsert(points).await {
                            eprintln!("Vector store error: {}", e);
                        }
                    }
                }

                idx_files.lock().await.push(fp);
                fd.fetch_add(1, Ordering::SeqCst);
            });

            handles.push(handle);
        }

        // Wait for all spawned tasks to complete
        for handle in handles {
            let _ = handle.await;
        }

        // Final flush to ensure everything is persisted
        if let Err(e) = vector_store.flush().await {
            eprintln!("Final flush error: {}", e);
        }

        *status_arc.lock().await = "idle".to_string();
    });

    Ok(())
}

#[tauri::command]
pub async fn pause_indexing(state: State<'_, AppState>) -> Result<(), String> {
    *state.status.lock().await = "paused".to_string();
    Ok(())
}

#[tauri::command]
pub async fn resume_indexing(state: State<'_, AppState>) -> Result<(), String> {
    *state.status.lock().await = "running".to_string();
    Ok(())
}

#[tauri::command]
pub async fn stop_indexing(state: State<'_, AppState>) -> Result<(), String> {
    *state.status.lock().await = "idle".to_string();
    state.files_done.store(0, Ordering::SeqCst);
    state.files_total.store(0, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn get_indexer_status(state: State<'_, AppState>) -> Result<IndexerStatus, String> {
    let status = state.status.lock().await.clone();
    let done = state.files_done.load(Ordering::SeqCst);
    let total = state.files_total.load(Ordering::SeqCst);
    Ok(IndexerStatus { status, files_done: done, files_total: total, eta_secs: None })
}

#[tauri::command]
pub async fn search(
    query: String,
    _filters: Option<crate::search::SearchFilters>,
    state: State<'_, AppState>,
) -> Result<Vec<crate::search::SearchResult>, String> {
    const FILE_RESULT_LIMIT: usize = 20;
    const CHUNK_CANDIDATE_LIMIT: usize = 100;
    const RRF_K: f32 = 60.0;
    let query_features = QueryFeatures::from_query(&query);

    let api_key = state.api_key.lock().await.clone();
    if api_key.is_empty() {
        return Err("No Gemini API key set.".to_string());
    }

    // 1. Embed the query via Gemini
    let query_vector = crate::embedding::client::embed_query(
        &state.http_client, &api_key, &query,
    ).await.map_err(|e| format!("Failed to embed query: {}", e))?;

    // 2. Search local vector store
    let scored_points = state.vector_store
        .search(query_vector, CHUNK_CANDIDATE_LIMIT)
        .await
        .map_err(|e| format!("Search failed: {}", e))?;

    let lexical_points = state
        .vector_store
        .lexical_search(&query, CHUNK_CANDIDATE_LIMIT)
        .await;

    // 3. Fuse dense + lexical retrieval into a single file-level ranking.
    let mut fused_by_path: HashMap<String, FileCandidate> = HashMap::new();
    for (rank, point) in scored_points.into_iter().enumerate() {
        let path = point.payload.get("path").cloned().unwrap_or_default();
        if path.is_empty() {
            continue;
        }

        let entry = fused_by_path.entry(path.clone()).or_insert_with(|| {
            FileCandidate::new(path.clone(), point.payload.get("file_type").cloned().unwrap_or_default())
        });
        entry.rrf_score += 1.0 / (RRF_K + rank as f32 + 1.0);
        entry.dense_score = entry.dense_score.max(point.score);

        let candidate = build_search_result(&point);
        if entry
            .representative
            .as_ref()
            .map(|existing| candidate.score > existing.score)
            .unwrap_or(true)
        {
            entry.representative = Some(candidate);
        }
    }

    for (rank, point) in lexical_points.into_iter().enumerate() {
        let path = point.payload.get("path").cloned().unwrap_or_default();
        if path.is_empty() {
            continue;
        }

        let entry = fused_by_path.entry(path.clone()).or_insert_with(|| {
            FileCandidate::new(path.clone(), point.payload.get("file_type").cloned().unwrap_or_default())
        });
        entry.rrf_score += 1.0 / (RRF_K + rank as f32 + 1.0);
        entry.lexical_score = entry.lexical_score.max(point.score);

        if entry.representative.is_none() {
            entry.representative = Some(build_search_result(&point));
        }
    }

    let mut results: Vec<_> = fused_by_path
        .into_values()
        .filter_map(|candidate| {
            let mut result = candidate.representative?;
            result.file_type = if result.file_type.is_empty() {
                candidate.file_type
            } else {
                result.file_type
            };
            let lexical_bonus = (candidate.lexical_score.min(12.0) / 12.0) * 0.05;
            result.score = candidate.rrf_score + candidate.dense_score * 0.15 + lexical_bonus;
            Some(result)
        })
        .collect();

    results.sort_by(|a, b| {
        b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal)
    });
    rerank_results(&mut results, &query_features);
    results.truncate(FILE_RESULT_LIMIT);

    for (index, result) in results.iter_mut().enumerate() {
        result.rank = index + 1;
    }

    Ok(results)
}

struct FileCandidate {
    file_type: String,
    representative: Option<crate::search::SearchResult>,
    rrf_score: f32,
    dense_score: f32,
    lexical_score: f32,
}

impl FileCandidate {
    fn new(_path: String, file_type: String) -> Self {
        Self {
            file_type,
            representative: None,
            rrf_score: 0.0,
            dense_score: 0.0,
            lexical_score: 0.0,
        }
    }
}

fn build_search_result(point: &crate::store::vector::ScoredPoint) -> crate::search::SearchResult {
    let path = point.payload.get("path").cloned().unwrap_or_default();
    crate::search::SearchResult {
        chunk_id: format!("chk-{}", point.id),
        file_id: path.clone(),
        path,
        file_type: point.payload.get("file_type").cloned().unwrap_or_default(),
        text_excerpt: point.payload.get("chunk_text").cloned(),
        thumbnail_path: None,
        score: point.score,
        rank: 0,
    }
}

struct QueryFeatures {
    raw: String,
    tokens: Vec<String>,
    file_type_hints: Vec<String>,
    code_intent: bool,
}

impl QueryFeatures {
    fn from_query(query: &str) -> Self {
        let raw = query.trim().to_lowercase();
        let tokens = tokenize_query(&raw);
        let file_type_hints = tokens
            .iter()
            .filter(|token| is_file_type_token(token))
            .cloned()
            .collect();
        let code_intent = tokens.iter().any(|token| {
            matches!(
                token.as_str(),
                "function"
                    | "method"
                    | "class"
                    | "struct"
                    | "enum"
                    | "trait"
                    | "interface"
                    | "impl"
                    | "module"
                    | "parser"
                    | "query"
                    | "error"
                    | "stacktrace"
                    | "rust"
                    | "python"
                    | "typescript"
                    | "javascript"
                    | "java"
                    | "golang"
                    | "code"
            )
        });

        Self {
            raw,
            tokens,
            file_type_hints,
            code_intent,
        }
    }
}

fn rerank_results(results: &mut Vec<crate::search::SearchResult>, query: &QueryFeatures) {
    for result in results.iter_mut() {
        result.score += rerank_bonus(result, query);
    }

    results.sort_by(|a, b| {
        b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal)
    });
}

fn rerank_bonus(result: &crate::search::SearchResult, query: &QueryFeatures) -> f32 {
    let path = result.path.to_lowercase();
    let file_type = result.file_type.to_lowercase();
    let snippet = result
        .text_excerpt
        .as_deref()
        .unwrap_or_default()
        .to_lowercase();
    let filename = path
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or_default()
        .to_string();

    let mut bonus = 0.0;

    if !query.raw.is_empty() {
        if filename.contains(&query.raw) {
            bonus += 0.16;
        }
        if path.contains(&query.raw) {
            bonus += 0.08;
        }
        if !snippet.is_empty() && snippet.contains(&query.raw) {
            bonus += 0.06;
        }
    }

    for token in &query.tokens {
        if filename.contains(token) {
            bonus += 0.028;
        }
        if path.contains(token) {
            bonus += 0.014;
        }
        if !snippet.is_empty() && snippet.contains(token) {
            bonus += 0.012;
        }
    }

    if query.code_intent && is_code_file_type(&file_type) {
        bonus += 0.08;
    }

    if query
        .file_type_hints
        .iter()
        .any(|hint| hint == &file_type || filename.ends_with(&format!(".{hint}")))
    {
        bonus += 0.07;
    }

    bonus
}

fn tokenize_query(query: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();

    for ch in query.chars() {
        if ch.is_ascii_alphanumeric() {
            current.push(ch);
        } else if !current.is_empty() {
            if current.len() >= 2 {
                tokens.push(std::mem::take(&mut current));
            } else {
                current.clear();
            }
        }
    }

    if current.len() >= 2 {
        tokens.push(current);
    }

    tokens.sort();
    tokens.dedup();
    tokens
}

fn is_file_type_token(token: &str) -> bool {
    matches!(
        token,
        "pdf"
            | "md"
            | "markdown"
            | "txt"
            | "json"
            | "yaml"
            | "yml"
            | "toml"
            | "rs"
            | "py"
            | "js"
            | "ts"
            | "tsx"
            | "jsx"
            | "cpp"
            | "java"
            | "cs"
            | "png"
            | "jpg"
            | "jpeg"
            | "webp"
            | "mp4"
            | "mov"
            | "mp3"
            | "wav"
            | "m4a"
    )
}

fn is_code_file_type(file_type: &str) -> bool {
    matches!(
        file_type,
        "rs" | "py" | "js" | "ts" | "jsx" | "tsx" | "go" | "c" | "cpp" | "h" | "java" | "cs"
    )
}

// OS Reveal Handlers
#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    { Command::new("xdg-open").arg(&path).spawn().map_err(|e| e.to_string())?; }

    #[cfg(target_os = "macos")]
    { Command::new("open").arg(&path).spawn().map_err(|e| e.to_string())?; }
    
    #[cfg(target_os = "windows")]
    { Command::new("cmd").args(["/C", "start", "", &path]).spawn().map_err(|e| e.to_string())?; }

    Ok(())
}

#[tauri::command]
pub fn reveal_in_explorer(_path: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        if let Some(parent) = std::path::Path::new(&_path).parent() {
            Command::new("xdg-open").arg(parent).spawn().map_err(|e| e.to_string())?;
        }
    }

    #[cfg(target_os = "macos")]
    { Command::new("open").args(["-R", &_path]).spawn().map_err(|e| e.to_string())?; }
    
    #[cfg(target_os = "windows")]
    { Command::new("explorer").args(["/select,", &_path]).spawn().map_err(|e| e.to_string())?; }
    
    Ok(())
}
