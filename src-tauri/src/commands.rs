use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::State;

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::path::PathBuf;

pub struct AppState {
    pub api_key: tokio::sync::Mutex<Option<String>>,
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

#[tauri::command]
pub async fn start_indexing(folders: Vec<String>, state: State<'_, AppState>) -> Result<(), String> {
    if folders.is_empty() {
        return Err("No folders provided to index.".to_string());
    }

    let paths: Vec<std::path::PathBuf> = folders.into_iter().map(std::path::PathBuf::from).collect();
    
    // Validate paths
    for p in &paths {
        if !p.exists() || !p.is_dir() {
            return Err(format!("Invalid directory path: {}", p.display()));
        }
    }

    let mut status_lock = state.status.lock().await;
    *status_lock = "running".to_string();
    
    let files_done = state.files_done.clone();
    let files_total = state.files_total.clone();
    let status_arc = state.status.clone();
    
    let indexed_files = state.indexed_files.clone();

    // Spawn background task
    tokio::spawn(async move {
        // Collect files using our crawler
        let all_files: Vec<PathBuf> = crate::indexer::crawler::crawl(&paths).collect();
        
        files_total.store(all_files.len() as u32, Ordering::SeqCst);
        files_done.store(0, Ordering::SeqCst);

        // Clear previously indexed files
        indexed_files.lock().await.clear();
        
        for (i, file_path) in all_files.into_iter().enumerate() {
            // Check status
            loop {
                let st = status_arc.lock().await.clone();
                if st == "running" {
                    break;
                } else if st == "idle" {
                    return; // Abort
                }
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }
            
            // Store file path in the indexed list
            indexed_files.lock().await.push(file_path);
            
            // Small delay to avoid locking up the system
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
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
    
    Ok(IndexerStatus {
        status,
        files_done: done,
        files_total: total,
        eta_secs: None,
    })
}

#[tauri::command]
pub async fn search(
    query: String,
    _filters: Option<crate::search::SearchFilters>,
    state: State<'_, AppState>,
) -> Result<Vec<crate::search::SearchResult>, String> {
    let query_lower = query.to_lowercase();
    let indexed = state.indexed_files.lock().await.clone();

    if indexed.is_empty() {
        return Err("No files indexed yet. Please index a directory first.".to_string());
    }

    let mut results: Vec<crate::search::SearchResult> = Vec::new();

    for file_path in &indexed {
        // Only search text-readable files
        let ext = file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        let text_exts = ["txt", "md", "rs", "py", "js", "ts", "tsx", "jsx", "go",
                         "c", "cpp", "h", "java", "cs", "json", "yaml", "yml", "toml"];
        if !text_exts.contains(&ext.as_str()) {
            continue;
        }

        // Read file content
        let content = match std::fs::read_to_string(file_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        // Search for query matches (case-insensitive)
        let content_lower = content.to_lowercase();
        if !content_lower.contains(&query_lower) {
            continue;
        }

        // Find the first matching line and build excerpt
        let mut excerpt = String::new();
        for line in content.lines() {
            if line.to_lowercase().contains(&query_lower) {
                // Take up to 200 chars of the matching line
                excerpt = line.chars().take(200).collect();
                break;
            }
        }

        // Compute a naive "score" based on how many times the query appears
        let match_count = content_lower.matches(&query_lower).count();
        let score = (match_count as f32).min(50.0) / 50.0;

        results.push(crate::search::SearchResult {
            chunk_id: format!("chk-{}", results.len()),
            file_id: format!("file-{}", results.len()),
            path: file_path.display().to_string(),
            file_type: ext.clone(),
            text_excerpt: Some(excerpt),
            thumbnail_path: None,
            score,
            rank: 0, // will be set after sorting
        });
    }

    // Sort by score descending
    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

    // Assign ranks and cap at 50 results
    for (i, r) in results.iter_mut().enumerate() {
        r.rank = i + 1;
    }
    results.truncate(50);

    Ok(results)
}

// OS Reveal Handlers
#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    { Command::new("open").arg(&_path).spawn().map_err(|e| e.to_string())?; }
    
    #[cfg(target_os = "windows")]
    { Command::new("cmd").args(["/C", "start", "", &_path]).spawn().map_err(|e| e.to_string())?; }
    
    #[cfg(target_os = "linux")]
    { Command::new("xdg-open").arg(&path).spawn().map_err(|e| e.to_string())?; }

    Ok(())
}

#[tauri::command]
pub fn reveal_in_explorer(_path: String) -> Result<(), String> {
     #[cfg(target_os = "macos")]
    { Command::new("open").args(["-R", &_path]).spawn().map_err(|e| e.to_string())?; }
    
    #[cfg(target_os = "windows")]
    { Command::new("explorer").args(["/select,", &_path]).spawn().map_err(|e| e.to_string())?; }
    
     Ok(())
}
