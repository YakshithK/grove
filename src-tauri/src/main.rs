// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod indexer;
pub mod embedding;
pub mod store;
pub mod search;
pub mod commands;

fn main() {
    tauri::Builder::default()
        .manage(commands::AppState {
             api_key: tokio::sync::Mutex::new(None),
             files_done: std::sync::Arc::new(std::sync::atomic::AtomicU32::new(0)),
             files_total: std::sync::Arc::new(std::sync::atomic::AtomicU32::new(0)),
             status: std::sync::Arc::new(tokio::sync::Mutex::new("idle".to_string())),
             indexed_files: std::sync::Arc::new(tokio::sync::Mutex::new(Vec::new())),
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_indexing,
            commands::pause_indexing,
            commands::resume_indexing,
            commands::stop_indexing,
            commands::get_indexer_status,
            commands::search,
            commands::open_file,
            commands::reveal_in_explorer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
