use std::path::Path;

use pdf_extract::extract_text;
use tokio::fs;

pub async fn extract_content(path: &Path) -> Result<String, Box<dyn std::error::Error>> {
    let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();

    match extension.as_str() {
        "txt" | "md" | "rs" | "js" | "ts" | "py" | "json" | "html" | "css" | "xml" | "yaml" | "yml" => {
            fs::read_to_string(path).await.map_err(Into::into)
        }
        "pdf" => {
            let path_str = path.to_str().ok_or("Invalid path")?;
            extract_text(path_str).map_err(Into::into)
        }
        _ => {
            // For now, skip other types like images
            Ok(String::new())
        }
    }
}