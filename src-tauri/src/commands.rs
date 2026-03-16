use serde::Serialize;
use std::process::Command;
use tauri::State;

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::path::PathBuf;

pub struct AppState {
    pub api_key: Arc<tokio::sync::Mutex<String>>,
    pub http_client: reqwest::Client,
    pub vector_store: Arc<crate::store::vector::VectorStore>,
    pub files_done: Arc<AtomicU32>,
    pub files_total: Arc<AtomicU32>,
    pub status: Arc<tokio::sync::Mutex<String>>,
    pub indexed_files: Arc<tokio::sync::Mutex<Vec<PathBuf>>>,
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
const EMBED_BATCH_SIZE: usize = 20; // Gemini batchEmbedContents limit

#[tauri::command]
pub async fn set_api_key(key: String, state: State<'_, AppState>) -> Result<(), String> {
    *state.api_key.lock().await = key;
    Ok(())
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

    // Set status
    *state.status.lock().await = "running".to_string();

    let files_done = state.files_done.clone();
    let files_total = state.files_total.clone();
    let status_arc = state.status.clone();
    let indexed_files = state.indexed_files.clone();
    let vector_store = state.vector_store.clone();
    let http_client = state.http_client.clone();
    let api_key_arc = state.api_key.clone();

    // Ensure Qdrant collection exists (recreate for fresh index)
    vector_store.delete_collection().await.map_err(|e| e.to_string())?;
    vector_store.ensure_collection().await.map_err(|e| e.to_string())?;

    tokio::spawn(async move {
        let all_files: Vec<PathBuf> = crate::indexer::crawler::crawl(&paths).collect();
        files_total.store(all_files.len() as u32, Ordering::SeqCst);
        files_done.store(0, Ordering::SeqCst);
        indexed_files.lock().await.clear();

        let mut point_id: u64 = 0;

        for (i, file_path) in all_files.into_iter().enumerate() {
            // Check if paused or stopped
            loop {
                let st = status_arc.lock().await.clone();
                if st == "running" { break; }
                if st == "idle" { return; }
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }

            // 1. Extract text content
            let text = match crate::indexer::extractor::extract_content(&file_path) {
                Ok(t) => t,
                Err(_) => {
                    files_done.store((i + 1) as u32, Ordering::SeqCst);
                    continue;
                }
            };

            if text.trim().is_empty() {
                files_done.store((i + 1) as u32, Ordering::SeqCst);
                continue;
            }

            // 2. Chunk text
            let chunks = crate::indexer::chunker::chunk_text(&text, CHUNK_TOKENS, CHUNK_OVERLAP);
            if chunks.is_empty() {
                files_done.store((i + 1) as u32, Ordering::SeqCst);
                continue;
            }

            // 3. Embed chunks in batches via Gemini API
            let api_key = api_key_arc.lock().await.clone();
            
            for batch in chunks.chunks(EMBED_BATCH_SIZE) {
                let embed_requests: Vec<crate::embedding::types::EmbedRequest> = batch
                    .iter()
                    .map(|chunk| crate::embedding::client::make_document_request(chunk))
                    .collect();

                let embeddings = match crate::embedding::client::batch_embed(
                    &http_client,
                    &api_key,
                    embed_requests,
                ).await {
                    Ok(e) => e,
                    Err(err) => {
                        eprintln!("Embedding error for {:?}: {}", file_path, err);
                        continue;
                    }
                };

                // 4. Build Qdrant points with metadata
                let mut points = Vec::new();
                for (j, embedding) in embeddings.into_iter().enumerate() {
                    let chunk_text = batch.get(j).cloned().unwrap_or_default();
                    let payload: std::collections::HashMap<String, qdrant_client::qdrant::Value> = [
                        ("path".to_string(), qdrant_client::qdrant::Value {
                            kind: Some(qdrant_client::qdrant::value::Kind::StringValue(
                                file_path.display().to_string()
                            )),
                        }),
                        ("file_type".to_string(), qdrant_client::qdrant::Value {
                            kind: Some(qdrant_client::qdrant::value::Kind::StringValue(
                                file_path.extension().and_then(|e| e.to_str()).unwrap_or("").to_string()
                            )),
                        }),
                        ("chunk_text".to_string(), qdrant_client::qdrant::Value {
                            kind: Some(qdrant_client::qdrant::value::Kind::StringValue(
                                chunk_text.chars().take(500).collect()
                            )),
                        }),
                    ].into();

                    points.push(PointStruct::new(point_id, embedding, payload));
                    point_id += 1;
                }

                if let Err(e) = vector_store.upsert_points(points).await {
                    eprintln!("Qdrant upsert error: {}", e);
                }
            }

            indexed_files.lock().await.push(file_path);
            files_done.store((i + 1) as u32, Ordering::SeqCst);
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
    let api_key = state.api_key.lock().await.clone();
    if api_key.is_empty() {
        return Err("No Gemini API key set.".to_string());
    }

    // 1. Embed the query via Gemini
    let query_vector = crate::embedding::client::embed_query(
        &state.http_client,
        &api_key,
        &query,
    ).await.map_err(|e| format!("Failed to embed query: {}", e))?;

    // 2. Search Qdrant for nearest neighbors
    let scored_points = state.vector_store
        .search(query_vector, 20)
        .await
        .map_err(|e| format!("Qdrant search failed: {}", e))?;

    // 3. Transform scored points into SearchResult structs
    let mut results: Vec<crate::search::SearchResult> = Vec::new();
    for (rank, point) in scored_points.into_iter().enumerate() {
        let payload = &point.payload;

        let path = payload.get("path")
            .and_then(|v| v.kind.as_ref())
            .map(|k| match k {
                qdrant_client::qdrant::value::Kind::StringValue(s) => s.clone(),
                _ => String::new(),
            })
            .unwrap_or_default();

        let file_type = payload.get("file_type")
            .and_then(|v| v.kind.as_ref())
            .map(|k| match k {
                qdrant_client::qdrant::value::Kind::StringValue(s) => s.clone(),
                _ => String::new(),
            })
            .unwrap_or_default();

        let chunk_text = payload.get("chunk_text")
            .and_then(|v| v.kind.as_ref())
            .map(|k| match k {
                qdrant_client::qdrant::value::Kind::StringValue(s) => s.clone(),
                _ => String::new(),
            })
            .unwrap_or_default();

        results.push(crate::search::SearchResult {
            chunk_id: format!("chk-{}", point.id.as_ref().map(|id| format!("{:?}", id)).unwrap_or_default()),
            file_id: path.clone(),
            path,
            file_type,
            text_excerpt: Some(chunk_text),
            thumbnail_path: None,
            score: point.score,
            rank: rank + 1,
        });
    }

    Ok(results)
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
        // xdg-open on the parent directory
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

use qdrant_client::qdrant::PointStruct;
