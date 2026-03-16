use std::fs;
use std::path::Path;
use anyhow::{Result, Context};

/// Extracts content from files based on extension.
pub fn extract_content(path: &Path) -> Result<String> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "txt" | "md" | "rs" | "py" | "js" | "ts" | "jsx" | "tsx" | "go" | "c"
        | "cpp" | "h" | "java" | "cs" | "json" | "yaml" | "yml" | "toml" => {
            let content = fs::read_to_string(path)
                .with_context(|| format!("Failed reading text file: {:?}", path))?;
            Ok(content)
        }
        "pdf" => {
            // Use poppler's pdftotext for real PDF extraction
            crate::indexer::media::extract_pdf(path)
        }
        "docx" | "pptx" => {
            Ok(format!("[DOCX/PPTX Content Placeholder for {:?}]", path))
        }
        "png" | "jpg" | "jpeg" | "webp" => {
            // For images, return a placeholder — multimodal embedding would
            // use the base64 data directly in a future iteration
            Ok(format!("[Image: {:?}]", path.file_name().unwrap_or_default()))
        }
        "mp4" | "mov" | "mp3" | "wav" | "m4a" => {
            Ok(format!("[Media: {:?}]", path.file_name().unwrap_or_default()))
        }
        _ => Err(anyhow::anyhow!("Unsupported file type: {}", ext)),
    }
}
