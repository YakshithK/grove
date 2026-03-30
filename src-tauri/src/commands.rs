use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::VecDeque;
use std::process::Command;
use tauri::State;

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tokio::sync::Semaphore;

const MAX_PREVIEW_TEXT_BYTES: usize = 12 * 1024;
const MAX_PREVIEW_TEXT_LINES: usize = 220;
const MAX_PREVIEW_PDF_BYTES: usize = 20 * 1024 * 1024;
const MAX_QUERY_CHARS: usize = 240;
const MAX_QUERY_WORDS: usize = 32;
const GEMINI_GLOBAL_PERMITS: usize = 3;
const GEMINI_BACKGROUND_PERMITS: usize = 2;

const SEARCH_RATE_LIMIT_MAX: usize = 10;
const PREVIEW_RATE_LIMIT_MAX: usize = 30;
const INDEX_RATE_LIMIT_MAX: usize = 2;
const API_KEY_RATE_LIMIT_MAX: usize = 4;

const SEARCH_RATE_LIMIT_WINDOW_SECS: u64 = 10;
const PREVIEW_RATE_LIMIT_WINDOW_SECS: u64 = 10;
const INDEX_RATE_LIMIT_WINDOW_SECS: u64 = 15;
const API_KEY_RATE_LIMIT_WINDOW_SECS: u64 = 60;

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
    pub data_dir: PathBuf,
    pub api_key: Arc<tokio::sync::Mutex<String>>,
    pub http_client: reqwest::Client,
    pub vector_store: Arc<crate::store::vector::VectorStore>,
    pub files_done: Arc<AtomicU32>,
    pub files_total: Arc<AtomicU32>,
    pub status: Arc<tokio::sync::Mutex<String>>,
    pub indexed_files: Arc<tokio::sync::Mutex<Vec<PathBuf>>>,
    pub watched_roots: Arc<tokio::sync::Mutex<Vec<PathBuf>>>,
    pub sync_status: Arc<tokio::sync::Mutex<String>>,
    pub watcher_generation: Arc<AtomicU32>,
    pub security: Arc<tokio::sync::Mutex<SecurityState>>,
    pub gemini_global_slots: Arc<Semaphore>,
    pub gemini_background_slots: Arc<Semaphore>,
}

#[derive(Default)]
pub struct SecurityState {
    command_hits: HashMap<&'static str, VecDeque<Instant>>,
}

impl SecurityState {
    fn check(&mut self, key: &'static str, max_hits: usize, window_secs: u64) -> Result<(), String> {
        let now = Instant::now();
        let window = Duration::from_secs(window_secs);
        let hits = self.command_hits.entry(key).or_default();

        while matches!(hits.front(), Some(front) if now.duration_since(*front) > window) {
            hits.pop_front();
        }

        if hits.len() >= max_hits {
            return Err(match key {
                "search" => "Too many searches. Wait a moment and try again.",
                "preview" => "Preview requests are coming in too fast. Slow down for a moment.",
                "index" => "Indexing controls were used too quickly. Wait a moment and try again.",
                "api_key" => "API key was updated too often. Wait a moment and try again.",
                _ => "Too many requests. Wait a moment and try again.",
            }
            .to_string());
        }

        hits.push_back(now);
        Ok(())
    }
}

#[derive(Clone)]
struct WatchRuntime {
    watched_roots: Arc<tokio::sync::Mutex<Vec<PathBuf>>>,
    sync_status: Arc<tokio::sync::Mutex<String>>,
    watcher_generation: Arc<AtomicU32>,
    vector_store: Arc<crate::store::vector::VectorStore>,
    http_client: reqwest::Client,
    api_key: Arc<tokio::sync::Mutex<String>>,
    gemini_global_slots: Arc<Semaphore>,
    gemini_background_slots: Arc<Semaphore>,
}

#[derive(Clone)]
struct IndexingRuntime {
    files_done: Arc<AtomicU32>,
    files_total: Arc<AtomicU32>,
    status: Arc<tokio::sync::Mutex<String>>,
    indexed_files: Arc<tokio::sync::Mutex<Vec<PathBuf>>>,
    vector_store: Arc<crate::store::vector::VectorStore>,
    http_client: reqwest::Client,
    api_key: Arc<tokio::sync::Mutex<String>>,
    sync_status: Arc<tokio::sync::Mutex<String>>,
    watch: WatchRuntime,
    gemini_global_slots: Arc<Semaphore>,
    gemini_background_slots: Arc<Semaphore>,
}

impl AppState {
    pub fn new(data_dir: PathBuf) -> Self {
        let api_key = resolve_api_key();

        let vector_dir = data_dir.join("vectors");
        let vector_store = crate::store::vector::VectorStore::new(vector_dir)
            .expect("Failed to initialize vector store");
        let watched_roots = load_watched_roots(&data_dir).unwrap_or_default();

        Self {
            data_dir,
            api_key: Arc::new(tokio::sync::Mutex::new(api_key)),
            http_client: reqwest::Client::new(),
            vector_store: Arc::new(vector_store),
            files_done: Arc::new(AtomicU32::new(0)),
            files_total: Arc::new(AtomicU32::new(0)),
            status: Arc::new(tokio::sync::Mutex::new("idle".to_string())),
            indexed_files: Arc::new(tokio::sync::Mutex::new(Vec::new())),
            watched_roots: Arc::new(tokio::sync::Mutex::new(watched_roots)),
            sync_status: Arc::new(tokio::sync::Mutex::new("idle".to_string())),
            watcher_generation: Arc::new(AtomicU32::new(0)),
            security: Arc::new(tokio::sync::Mutex::new(SecurityState::default())),
            gemini_global_slots: Arc::new(Semaphore::new(GEMINI_GLOBAL_PERMITS)),
            gemini_background_slots: Arc::new(Semaphore::new(GEMINI_BACKGROUND_PERMITS)),
        }
    }

    fn watch_runtime(&self) -> WatchRuntime {
        WatchRuntime {
            watched_roots: self.watched_roots.clone(),
            sync_status: self.sync_status.clone(),
            watcher_generation: self.watcher_generation.clone(),
            vector_store: self.vector_store.clone(),
            http_client: self.http_client.clone(),
            api_key: self.api_key.clone(),
            gemini_global_slots: self.gemini_global_slots.clone(),
            gemini_background_slots: self.gemini_background_slots.clone(),
        }
    }

    fn indexing_runtime(&self) -> IndexingRuntime {
        IndexingRuntime {
            files_done: self.files_done.clone(),
            files_total: self.files_total.clone(),
            status: self.status.clone(),
            indexed_files: self.indexed_files.clone(),
            vector_store: self.vector_store.clone(),
            http_client: self.http_client.clone(),
            api_key: self.api_key.clone(),
            sync_status: self.sync_status.clone(),
            watch: self.watch_runtime(),
            gemini_global_slots: self.gemini_global_slots.clone(),
            gemini_background_slots: self.gemini_background_slots.clone(),
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

#[derive(Serialize, Deserialize)]
struct PersistedRoots {
    roots: Vec<String>,
}

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

fn watched_roots_path(data_dir: &Path) -> PathBuf {
    data_dir.join("indexed-roots.json")
}

fn load_watched_roots(data_dir: &Path) -> anyhow::Result<Vec<PathBuf>> {
    let path = watched_roots_path(data_dir);
    if !path.exists() {
        return Ok(Vec::new());
    }

    let contents = std::fs::read_to_string(path)?;
    let persisted: PersistedRoots = serde_json::from_str(&contents)?;
    Ok(persisted.roots.into_iter().map(PathBuf::from).collect())
}

fn save_watched_roots(data_dir: &Path, roots: &[PathBuf]) -> anyhow::Result<()> {
    std::fs::create_dir_all(data_dir)?;
    let contents = serde_json::to_string_pretty(&PersistedRoots {
        roots: roots
            .iter()
            .map(|root| root.to_string_lossy().to_string())
            .collect(),
    })?;
    std::fs::write(watched_roots_path(data_dir), contents)?;
    Ok(())
}

async fn set_sync_status(sync_status: &tokio::sync::Mutex<String>, value: &str) {
    *sync_status.lock().await = value.to_string();
}

fn canonicalize_root(path: &Path) -> Result<PathBuf, String> {
    if !path.exists() || !path.is_dir() {
        return Err(format!("Invalid directory path: {}", path.display()));
    }

    std::fs::canonicalize(path)
        .map_err(|error| format!("Failed to access {}: {}", path.display(), error))
}

fn canonicalize_file_access(path: &str) -> Result<PathBuf, String> {
    let raw = Path::new(path.trim());
    if !raw.exists() {
        return Err("File no longer exists.".to_string());
    }

    std::fs::canonicalize(raw)
        .map_err(|error| format!("Failed to access {}: {}", raw.display(), error))
}

async fn ensure_file_within_indexed_roots(path: &Path, roots: &tokio::sync::Mutex<Vec<PathBuf>>) -> Result<(), String> {
    let watched_roots = roots.lock().await;
    if watched_roots.is_empty() {
        return Err("No indexed roots are configured.".to_string());
    }

    if watched_roots.iter().any(|root| path.starts_with(root)) {
        Ok(())
    } else {
        Err("Access denied for files outside indexed folders.".to_string())
    }
}

async fn check_command_rate_limit(
    security: &tokio::sync::Mutex<SecurityState>,
    key: &'static str,
    max_hits: usize,
    window_secs: u64,
) -> Result<(), String> {
    security.lock().await.check(key, max_hits, window_secs)
}

fn sanitize_query(query: &str) -> Result<String, String> {
    let normalized = query.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        return Err("Enter a search query first.".to_string());
    }
    if normalized.chars().count() > MAX_QUERY_CHARS {
        return Err("Search query is too long.".to_string());
    }
    if normalized.split_whitespace().count() > MAX_QUERY_WORDS {
        return Err("Search query has too many terms.".to_string());
    }
    Ok(normalized)
}

async fn batch_embed_with_limits(
    client: &reqwest::Client,
    api_key: &str,
    requests: Vec<crate::embedding::types::EmbedRequest>,
    global_slots: Arc<Semaphore>,
    background_slots: Option<Arc<Semaphore>>,
) -> anyhow::Result<Vec<Vec<f32>>> {
    let _background_permit = if let Some(slots) = background_slots {
        Some(
            slots
                .acquire_owned()
                .await
                .map_err(|_| anyhow::anyhow!("Gemini background queue unavailable"))?,
        )
    } else {
        None
    };

    let _global_permit = global_slots
        .acquire_owned()
        .await
        .map_err(|_| anyhow::anyhow!("Gemini queue unavailable"))?;

    crate::embedding::client::batch_embed(client, api_key, requests).await
}

async fn embed_query_with_limits(
    client: &reqwest::Client,
    api_key: &str,
    query: &str,
    global_slots: Arc<Semaphore>,
) -> anyhow::Result<Vec<f32>> {
    let _global_permit = global_slots
        .acquire_owned()
        .await
        .map_err(|_| anyhow::anyhow!("Gemini queue unavailable"))?;
    crate::embedding::client::embed_query(client, api_key, query).await
}

fn build_image_thumbnail(path: &str, file_type: &str) -> Option<String> {
    let mime = match file_type {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        _ => return None,
    };

    let bytes = std::fs::read(path).ok()?;
    let encoded = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        bytes,
    );
    Some(format!("data:{};base64,{}", mime, encoded))
}

fn preview_title(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_else(|| path.to_str().unwrap_or("Unknown file"))
        .to_string()
}

fn preview_file_type(path: &Path) -> String {
    path.extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase()
}

fn is_text_preview_ext(ext: &str) -> bool {
    matches!(
        ext,
        "txt"
            | "md"
            | "rs"
            | "py"
            | "js"
            | "ts"
            | "jsx"
            | "tsx"
            | "go"
            | "c"
            | "cpp"
            | "h"
            | "java"
            | "cs"
            | "json"
            | "yaml"
            | "yml"
            | "toml"
            | "docx"
            | "pptx"
    )
}

fn truncate_preview_text(content: &str) -> (String, bool) {
    let mut result = String::new();
    let mut truncated = false;

    for (idx, line) in content.lines().enumerate() {
        if idx >= MAX_PREVIEW_TEXT_LINES || result.len() >= MAX_PREVIEW_TEXT_BYTES {
            truncated = true;
            break;
        }

        let remaining = MAX_PREVIEW_TEXT_BYTES.saturating_sub(result.len());
        if remaining == 0 {
            truncated = true;
            break;
        }

        let clipped_line: String = line.chars().take(remaining).collect();
        if clipped_line.len() < line.len() {
            if !result.is_empty() {
                result.push('\n');
            }
            result.push_str(&clipped_line);
            truncated = true;
            break;
        }

        if !result.is_empty() {
            result.push('\n');
        }
        result.push_str(line);
    }

    if result.is_empty() && !content.is_empty() {
        let clipped: String = content.chars().take(MAX_PREVIEW_TEXT_BYTES).collect();
        truncated = clipped.len() < content.len();
        return (clipped, truncated);
    }

    (result, truncated)
}

fn read_text_preview(path: &Path, ext: &str) -> Result<(String, bool), String> {
    let content = if ext == "pdf" {
        crate::indexer::media::extract_pdf(path)
            .map_err(|error| format!("Failed extracting PDF text: {}", error))?
    } else {
        crate::indexer::extractor::extract_content(path)
            .map_err(|error| format!("Failed reading preview text: {}", error))?
    };

    if content.trim().is_empty() {
        return Ok((String::from("No preview text available."), false));
    }

    Ok(truncate_preview_text(&content))
}

fn mime_for_preview(ext: &str) -> &'static str {
    match ext {
        "pdf" => "application/pdf",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        _ => "application/octet-stream",
    }
}

#[tauri::command]
pub async fn get_preview(path: String, state: State<'_, AppState>) -> Result<crate::search::PreviewPayload, String> {
    check_command_rate_limit(
        &state.security,
        "preview",
        PREVIEW_RATE_LIMIT_MAX,
        PREVIEW_RATE_LIMIT_WINDOW_SECS,
    )
    .await?;
    get_preview_impl(path, state.watched_roots.clone()).await
}

async fn get_preview_impl(
    path: String,
    watched_roots: Arc<tokio::sync::Mutex<Vec<PathBuf>>>,
) -> Result<crate::search::PreviewPayload, String> {
    let preview_path = canonicalize_file_access(&path)?;
    ensure_file_within_indexed_roots(&preview_path, &watched_roots).await?;
    let title = preview_title(&preview_path);
    let file_type = preview_file_type(&preview_path);

    let metadata = std::fs::metadata(&preview_path)
        .map_err(|error| format!("Failed loading preview metadata: {}", error))?;

    if !metadata.is_file() {
        return Ok(crate::search::PreviewPayload::Unsupported {
            title,
            path,
            file_type,
            message: "Preview is only available for files.".to_string(),
            text_excerpt: None,
        });
    }

    let ext = file_type.clone();
    let ext = ext.as_str();
    if !crate::indexer::crawler::is_allowed_file(&preview_path) {
        return Ok(crate::search::PreviewPayload::Unsupported {
            title,
            path,
            file_type,
            message: "Preview is not available for this file type.".to_string(),
            text_excerpt: None,
        });
    }

    if matches!(ext, "png" | "jpg" | "jpeg" | "webp") {
        return build_image_thumbnail(&path, ext)
            .map(|data_url| crate::search::PreviewPayload::Image {
                title,
                path,
                file_type,
                data_url,
            })
            .ok_or_else(|| "Failed building image preview.".to_string());
    }

    if ext == "pdf" {
        let text_excerpt = read_text_preview(&preview_path, ext).ok().map(|(content, _)| content);
        if metadata.len() as usize > MAX_PREVIEW_PDF_BYTES {
            return Ok(crate::search::PreviewPayload::Unsupported {
                title,
                path,
                file_type,
                message: "PDF is too large to render in-app.".to_string(),
                text_excerpt,
            });
        }

        let bytes = std::fs::read(&preview_path)
            .map_err(|error| format!("Failed reading PDF preview: {}", error))?;
        let encoded = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            bytes,
        );

        return Ok(crate::search::PreviewPayload::Pdf {
            title,
            path,
            file_type,
            data_url: format!("data:{};base64,{}", mime_for_preview(ext), encoded),
            text_excerpt,
        });
    }

    if is_text_preview_ext(ext) {
        return match read_text_preview(&preview_path, ext) {
            Ok((content, truncated)) => Ok(crate::search::PreviewPayload::Text {
                title,
                path,
                file_type,
                content,
                truncated,
            }),
            Err(message) => Ok(crate::search::PreviewPayload::Error {
                title,
                path,
                file_type,
                message,
            }),
        };
    }

    Ok(crate::search::PreviewPayload::Unsupported {
        title,
        path,
        file_type,
        message: "Preview is not available for this file type yet.".to_string(),
        text_excerpt: None,
    })
}

async fn index_single_file(
    fp: PathBuf,
    vector_store: Arc<crate::store::vector::VectorStore>,
    http_client: reqwest::Client,
    api_key_arc: Arc<tokio::sync::Mutex<String>>,
    next_point_id: Arc<AtomicU32>,
    gemini_global_slots: Arc<Semaphore>,
    gemini_background_slots: Arc<Semaphore>,
) {
    let ext = fp
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let api_key = api_key_arc.lock().await.clone();
    let path_str = fp.display().to_string();
    if let Err(error) = vector_store.delete_by_payload("path", &path_str).await {
        eprintln!("Failed removing stale vectors for {:?}: {}", fp, error);
    }

    if let Some(mime) = mime_for_ext(&ext) {
        let bytes = match std::fs::read(&fp) {
            Ok(bytes) => bytes,
            Err(_) => return,
        };

        if bytes.len() > 10 * 1024 * 1024 {
            return;
        }

        let b64 = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            &bytes,
        );

        let filename = fp.file_name().unwrap_or_default().to_string_lossy();
        let req = crate::embedding::client::make_binary_request(&b64, mime, Some(&filename));
        match batch_embed_with_limits(
            &http_client,
            &api_key,
            vec![req],
            gemini_global_slots.clone(),
            Some(gemini_background_slots.clone()),
        )
        .await
        {
            Ok(embeddings) => {
                if let Some(embedding) = embeddings.into_iter().next() {
                    let point_id = next_point_id.fetch_add(1, Ordering::SeqCst) as u64;
                    let mut payload = std::collections::HashMap::new();
                    payload.insert("path".to_string(), fp.display().to_string());
                    payload.insert("file_type".to_string(), ext.clone());
                    payload.insert(
                        "chunk_text".to_string(),
                        format!(
                            "[{} file: {}]",
                            ext.to_uppercase(),
                            fp.file_name().unwrap_or_default().to_string_lossy()
                        ),
                    );

                    let point = crate::store::vector::StoredPoint {
                        id: point_id,
                        vector: embedding,
                        payload,
                    };
                    if let Err(error) = vector_store.upsert(vec![point]).await {
                        eprintln!("Vector store error: {}", error);
                    }
                }
            }
            Err(error) => eprintln!("Embed error for {:?}: {}", fp, error),
        }
        return;
    }

    let text = match crate::indexer::extractor::extract_content(&fp) {
        Ok(text) => text,
        Err(_) => return,
    };

    if text.trim().is_empty() {
        return;
    }

    let chunks = crate::indexer::chunker::chunk_text_for_extension(
        &text,
        &ext,
        CHUNK_TOKENS,
        CHUNK_OVERLAP,
    );

    if chunks.is_empty() {
        return;
    }

    let filename = fp.file_name().unwrap_or_default().to_string_lossy();
    for batch in chunks.chunks(EMBED_BATCH_SIZE) {
        let embeddings = match batch_embed_with_limits(
            &http_client,
            &api_key,
            batch
                .iter()
                .map(|chunk| crate::embedding::client::make_text_request(chunk, Some(&filename)))
                .collect(),
            gemini_global_slots.clone(),
            Some(gemini_background_slots.clone()),
        )
        .await
        {
            Ok(embeddings) => embeddings,
            Err(error) => {
                eprintln!("Embed error for {:?}: {}", fp, error);
                continue;
            }
        };

        let mut points = Vec::new();
        for (idx, embedding) in embeddings.into_iter().enumerate() {
            let chunk_text = batch.get(idx).cloned().unwrap_or_default();
            let point_id = next_point_id.fetch_add(1, Ordering::SeqCst) as u64;
            let mut payload = std::collections::HashMap::new();
            payload.insert("path".to_string(), fp.display().to_string());
            payload.insert("file_type".to_string(), ext.clone());
            payload.insert(
                "chunk_text".to_string(),
                chunk_text.chars().take(500).collect(),
            );

            points.push(crate::store::vector::StoredPoint {
                id: point_id,
                vector: embedding,
                payload,
            });
        }

        if let Err(error) = vector_store.upsert(points).await {
            eprintln!("Vector store error: {}", error);
        }
    }
}

async fn process_watch_actions(
    actions: Vec<crate::indexer::watcher::WatchAction>,
    vector_store: Arc<crate::store::vector::VectorStore>,
    http_client: reqwest::Client,
    api_key_arc: Arc<tokio::sync::Mutex<String>>,
    sync_status: Arc<tokio::sync::Mutex<String>>,
    gemini_global_slots: Arc<Semaphore>,
    gemini_background_slots: Arc<Semaphore>,
) {
    if actions.is_empty() {
        return;
    }

    set_sync_status(&sync_status, "syncing").await;
    let next_point_id = Arc::new(AtomicU32::new(
        vector_store
            .max_point_id()
            .await
            .map(|id| id as u32 + 1)
            .unwrap_or(0),
    ));

    for action in actions {
        match action {
            crate::indexer::watcher::WatchAction::Upsert(path) => {
                if !path.exists() || !crate::indexer::crawler::is_allowed_file(&path) {
                    continue;
                }
                index_single_file(
                    path,
                    vector_store.clone(),
                    http_client.clone(),
                    api_key_arc.clone(),
                    next_point_id.clone(),
                    gemini_global_slots.clone(),
                    gemini_background_slots.clone(),
                )
                .await;
            }
            crate::indexer::watcher::WatchAction::Delete(path) => {
                if let Err(error) = vector_store
                    .delete_by_payload("path", &path.display().to_string())
                    .await
                {
                    eprintln!("Failed deleting removed file {:?}: {}", path, error);
                }
            }
        }
    }

    if let Err(error) = vector_store.flush().await {
        eprintln!("Watcher flush error: {}", error);
    }
    set_sync_status(&sync_status, "idle").await;
}

async fn restart_watcher(runtime: WatchRuntime) {
    let roots = runtime.watched_roots.lock().await.clone();

    let generation = runtime.watcher_generation.fetch_add(1, Ordering::SeqCst) + 1;

    if roots.is_empty() {
        let sync_status = runtime.sync_status.clone();
        set_sync_status(&sync_status, "idle").await;
        return;
    }

    let vector_store = runtime.vector_store.clone();
    let http_client = runtime.http_client.clone();
    let api_key = runtime.api_key.clone();
    let sync_status = runtime.sync_status.clone();
    let gemini_global_slots = runtime.gemini_global_slots.clone();
    let gemini_background_slots = runtime.gemini_background_slots.clone();
    let generation_counter = runtime.watcher_generation.clone();
    let handler: Arc<dyn Fn(Vec<crate::indexer::watcher::WatchAction>) + Send + Sync> =
        Arc::new(move |actions| {
            let vector_store = vector_store.clone();
            let http_client = http_client.clone();
            let api_key = api_key.clone();
            let sync_status = sync_status.clone();
            let gemini_global_slots = gemini_global_slots.clone();
            let gemini_background_slots = gemini_background_slots.clone();
            tauri::async_runtime::spawn(async move {
                process_watch_actions(
                    actions,
                    vector_store,
                    http_client,
                    api_key,
                    sync_status,
                    gemini_global_slots,
                    gemini_background_slots,
                )
                .await;
            });
        });

    if let Err(error) = crate::indexer::watcher::spawn_fs_watcher(
        roots,
        generation,
        generation_counter,
        handler,
    ) {
        eprintln!("Failed restarting watcher: {}", error);
    }
}

fn spawn_indexing_job(paths: Vec<PathBuf>, runtime: IndexingRuntime, clear_existing: bool, restart_watch_after: bool) {
    tokio::spawn(async move {
        *runtime.status.lock().await = "running".to_string();
        set_sync_status(&runtime.sync_status, "syncing").await;

        if clear_existing {
            if let Err(error) = runtime.vector_store.clear().await {
                eprintln!("Failed to clear old index: {}", error);
            }
        }

        let all_files: Vec<PathBuf> = crate::indexer::crawler::crawl(&paths).collect();
        runtime.files_total.store(all_files.len() as u32, Ordering::SeqCst);
        runtime.files_done.store(0, Ordering::SeqCst);
        runtime.indexed_files.lock().await.clear();

        let next_point_id = Arc::new(AtomicU32::new(
            runtime
                .vector_store
                .max_point_id()
                .await
                .map(|id| id as u32 + 1)
                .unwrap_or(0),
        ));

        let semaphore = Arc::new(tokio::sync::Semaphore::new(MAX_CONCURRENT_FILES));
        let mut handles = Vec::new();

        for file_path in all_files {
            let st = runtime.status.lock().await.clone();
            if st == "idle" {
                break;
            }

            loop {
                let st = runtime.status.lock().await.clone();
                if st == "running" {
                    break;
                }
                if st == "idle" {
                    return;
                }
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }

            let permit = semaphore.clone().acquire_owned().await.unwrap();
            let vector_store = runtime.vector_store.clone();
            let http_client = runtime.http_client.clone();
            let api_key_arc = runtime.api_key.clone();
            let files_done = runtime.files_done.clone();
            let indexed_files = runtime.indexed_files.clone();
            let next_point_id = next_point_id.clone();
            let fp = file_path.clone();
            let gemini_global_slots = runtime.gemini_global_slots.clone();
            let gemini_background_slots = runtime.gemini_background_slots.clone();

            handles.push(tokio::spawn(async move {
                let _permit = permit;
                index_single_file(
                    fp.clone(),
                    vector_store,
                    http_client,
                    api_key_arc,
                    next_point_id,
                    gemini_global_slots,
                    gemini_background_slots,
                )
                .await;

                indexed_files.lock().await.push(fp);
                files_done.fetch_add(1, Ordering::SeqCst);
            }));
        }

        for handle in handles {
            let _ = handle.await;
        }

        if let Err(error) = runtime.vector_store.flush().await {
            eprintln!("Final flush error: {}", error);
        }

        *runtime.status.lock().await = "idle".to_string();
        set_sync_status(&runtime.sync_status, "idle").await;

        if restart_watch_after {
            restart_watcher(runtime.watch.clone()).await;
        }
    });
}

#[tauri::command]
pub async fn set_api_key(key: String, state: State<'_, AppState>) -> Result<(), String> {
    check_command_rate_limit(
        &state.security,
        "api_key",
        API_KEY_RATE_LIMIT_MAX,
        API_KEY_RATE_LIMIT_WINDOW_SECS,
    )
    .await?;
    *state.api_key.lock().await = key.trim().to_string();
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
    check_command_rate_limit(
        &state.security,
        "index",
        INDEX_RATE_LIMIT_MAX,
        INDEX_RATE_LIMIT_WINDOW_SECS,
    )
    .await?;

    let current_status = state.status.lock().await.clone();
    if current_status == "running" || current_status == "paused" {
        return Err("Indexing is already in progress.".to_string());
    }

    if folders.is_empty() {
        return Err("No folders provided to index.".to_string());
    }

    let api_key = state.api_key.lock().await.clone();
    if api_key.is_empty() {
        return Err("No Gemini API key set. Please add your API key in Settings first.".to_string());
    }

    let mut paths = Vec::new();
    for folder in folders {
        let root = canonicalize_root(Path::new(folder.trim()))?;
        if !paths.iter().any(|existing| existing == &root) {
            paths.push(root);
        }
    }
    if paths.is_empty() {
        return Err("No valid directories provided to index.".to_string());
    }

    {
        let mut watched_roots = state.watched_roots.lock().await;
        *watched_roots = paths.clone();
        save_watched_roots(&state.data_dir, &watched_roots)
            .map_err(|error| format!("Failed to save indexed roots: {}", error))?;
    }

    spawn_indexing_job(paths, state.indexing_runtime(), true, true);

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
pub async fn get_indexed_roots(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    Ok(state
        .watched_roots
        .lock()
        .await
        .iter()
        .map(|root| root.to_string_lossy().to_string())
        .collect())
}

#[tauri::command]
pub async fn add_indexed_root(path: String, state: State<'_, AppState>) -> Result<(), String> {
    check_command_rate_limit(
        &state.security,
        "index",
        INDEX_RATE_LIMIT_MAX,
        INDEX_RATE_LIMIT_WINDOW_SECS,
    )
    .await?;

    let current_status = state.status.lock().await.clone();
    if current_status == "running" || current_status == "paused" {
        return Err("Wait for the current indexing job to finish before adding another folder.".to_string());
    }

    let root = canonicalize_root(Path::new(path.trim()))?;

    {
        let mut watched_roots = state.watched_roots.lock().await;
        if watched_roots.iter().any(|existing| existing == &root) {
            return Ok(());
        }
        watched_roots.push(root.clone());
        save_watched_roots(&state.data_dir, &watched_roots)
            .map_err(|error| format!("Failed to save indexed roots: {}", error))?;
    }

    restart_watcher(state.watch_runtime()).await;
    spawn_indexing_job(vec![root], state.indexing_runtime(), false, false);
    Ok(())
}

#[tauri::command]
pub async fn remove_indexed_root(path: String, state: State<'_, AppState>) -> Result<(), String> {
    check_command_rate_limit(
        &state.security,
        "index",
        INDEX_RATE_LIMIT_MAX,
        INDEX_RATE_LIMIT_WINDOW_SECS,
    )
    .await?;

    let current_status = state.status.lock().await.clone();
    if current_status == "running" || current_status == "paused" {
        return Err("Wait for the current indexing job to finish before removing a folder.".to_string());
    }

    let root = PathBuf::from(path.trim());
    {
        let mut watched_roots = state.watched_roots.lock().await;
        watched_roots.retain(|existing| existing != &root);
        save_watched_roots(&state.data_dir, &watched_roots)
            .map_err(|error| format!("Failed to save indexed roots: {}", error))?;
    }

    state
        .vector_store
        .delete_by_path_prefix(&root.to_string_lossy())
        .await
        .map_err(|error| format!("Failed removing indexed files: {}", error))?;
    state
        .vector_store
        .flush()
        .await
        .map_err(|error| format!("Failed persisting vector store: {}", error))?;
    restart_watcher(state.watch_runtime()).await;
    Ok(())
}

#[tauri::command]
pub async fn reset_index(state: State<'_, AppState>) -> Result<(), String> {
    check_command_rate_limit(
        &state.security,
        "index",
        INDEX_RATE_LIMIT_MAX,
        INDEX_RATE_LIMIT_WINDOW_SECS,
    )
    .await?;

    let current_status = state.status.lock().await.clone();
    if current_status == "running" || current_status == "paused" {
        return Err("Stop indexing before resetting the index.".to_string());
    }

    {
        let mut watched_roots = state.watched_roots.lock().await;
        watched_roots.clear();
        save_watched_roots(&state.data_dir, &watched_roots)
            .map_err(|error| format!("Failed clearing indexed roots: {}", error))?;
    }

    state
        .vector_store
        .clear()
        .await
        .map_err(|error| format!("Failed clearing vector store: {}", error))?;
    state
        .vector_store
        .flush()
        .await
        .map_err(|error| format!("Failed flushing vector store: {}", error))?;

    state.watcher_generation.fetch_add(1, Ordering::SeqCst);
    set_sync_status(&state.sync_status, "idle").await;
    Ok(())
}

#[tauri::command]
pub async fn get_sync_status(state: State<'_, AppState>) -> Result<String, String> {
    Ok(state.sync_status.lock().await.clone())
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
    check_command_rate_limit(
        &state.security,
        "search",
        SEARCH_RATE_LIMIT_MAX,
        SEARCH_RATE_LIMIT_WINDOW_SECS,
    )
    .await?;

    let query = sanitize_query(&query)?;
    let query_features = QueryFeatures::from_query(&query);

    let api_key = state.api_key.lock().await.clone();
    if api_key.is_empty() {
        return Err("No Gemini API key set.".to_string());
    }

    if !state.vector_store.has_points().await {
        return Ok(Vec::new());
    }

    // 1. Embed the query via Gemini
    let query_vector = embed_query_with_limits(
        &state.http_client,
        &api_key,
        &query,
        state.gemini_global_slots.clone(),
    )
    .await
    .map_err(|e| format!("Failed to embed query: {}", e))?;

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
    let file_type = point.payload.get("file_type").cloned().unwrap_or_default();
    crate::search::SearchResult {
        chunk_id: format!("chk-{}", point.id),
        file_id: path.clone(),
        path: path.clone(),
        file_type: file_type.clone(),
        text_excerpt: point.payload.get("chunk_text").cloned(),
        thumbnail_path: build_image_thumbnail(&path, &file_type),
        score: point.score,
        rank: 0,
    }
}

pub fn bootstrap_watchers(state: &AppState) {
    let runtime = state.watch_runtime();
    tauri::async_runtime::spawn(async move {
        restart_watcher(runtime).await;
    });
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
