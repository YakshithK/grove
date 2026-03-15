use tauri::command;

// Placeholder commands

#[command]
pub fn get_settings() -> Result<String, String> {
    Ok("Settings placeholder".to_string())
}

#[command]
pub fn save_settings(settings: String) -> Result<(), String> {
    println!("Saving settings: {}", settings);
    Ok(())
}

#[command]
pub fn search(query: String) -> Result<Vec<String>, String> {
    // Placeholder search
    Ok(vec![format!("Result for: {}", query)])
}