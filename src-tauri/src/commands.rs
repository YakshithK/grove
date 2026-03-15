use tauri::command;
use std::path::PathBuf;
use crate::AppState;
use chrono;
use sqlx::SqlitePool;

// Placeholder commands

#[command]
pub fn get_settings() -> Result<String, String> {
    Ok("Settings placeholder".to_string())
}

#[command]
pub fn save_settings(settings: String) -> Result<(), String> {
    println!("save_settings called with: {}", settings);
    Ok(())
}

#[command]
pub async fn search(state: tauri::State<'_, AppState>, query: String) -> Result<Vec<String>, String> {
    println!("search called with query: {}", query);
    let pool = &state.pool;
    // Mock embed query
    let query_embedding = vec![0.0; 768];
    // Search vector store
    let results = state.vector_store.search(query_embedding, 10);
    // Fetch excerpts from DB
    let mut excerpts = Vec::new();
    for (chunk_id, _score) in results {
        let result = sqlx::query_as::<_, (Option<String>,)>("SELECT text_excerpt FROM chunks WHERE id = ?")
            .bind(&chunk_id)
            .fetch_one(&**pool)
            .await;
        if let Ok((Some(excerpt),)) = result {
            excerpts.push(excerpt);
        }
    }
    Ok(excerpts)
}

#[command]
pub async fn start_indexing(state: tauri::State<'_, AppState>, folders: Vec<String>) -> Result<(), String> {
    println!("start_indexing called with folders: {:?}", folders);
    let roots: Vec<PathBuf> = folders.into_iter().map(PathBuf::from).collect();
    let files: Vec<PathBuf> = crate::indexer::crawler::crawl(&roots).collect();
    println!("Found {} files", files.len());

    for file_path in files {
        // Insert file
        let metadata = tokio::fs::metadata(&file_path).await.map_err(|e| e.to_string())?;
        let file_type = file_path.extension().and_then(|e| e.to_str()).unwrap_or("unknown");
        let size = metadata.len();
        let modified = metadata.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH).duration_since(std::time::SystemTime::UNIX_EPOCH).unwrap().as_secs() as i64;
        let file_id = crate::store::metadata::insert_file(&state.pool, &file_path, file_type, size, modified).await.map_err(|e| e.to_string())?;

        // Extract content
        let content = crate::indexer::extractor::extract_content(&file_path).await.map_err(|e| e.to_string())?;
        if content.is_empty() {
            continue;
        }

        // Chunk
        let chunks = crate::indexer::chunker::chunk_text(&content, 512).map_err(|e| e.to_string())?;

        for (i, chunk) in chunks.into_iter().enumerate() {
            // For now, no embedding
            let embedding_json: Option<&str> = None; // serde_json::to_string(&vec![0.0f32; 768]).ok(); // mock
            let chunk_id = crate::store::metadata::insert_chunk(&state.pool, &file_id, i as i32, "text", Some(&chunk), None, None, embedding_json.as_deref()).await.map_err(|e| e.to_string())?;
            // Insert into vector store
            state.vector_store.insert_chunk(chunk_id, vec![0.0; 768]);
        }

        // Update file status
        crate::store::metadata::update_file_status(&state.pool, &file_id, "indexed", Some(chrono::Utc::now().timestamp())).await.map_err(|e| e.to_string())?;
    }

    Ok(())
}