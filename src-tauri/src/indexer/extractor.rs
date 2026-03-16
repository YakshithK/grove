use std::fs;
use std::path::Path;
use anyhow::{Result, Context};

/// Extracts content from files based on extension.
/// For v1, returning raw extracted `String` for textual types.
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
            // Placeholder: PDF extraction (requires external bin/library like pdfium or poppler)
            // For MVP skeleton, we return a mock string to prove the pipeline works
            Ok(format!("[PDF Content Placeholder for {:?}]", path))
        }
        "docx" | "pptx" => {
            // Placeholder: Word/Powerpoint extraction
            Ok(format!("[DOCX/PPTX Content Placeholder for {:?}]", path))
        }
        "png" | "jpg" | "jpeg" | "webp" => {
            // Note: Images will be converted directly to base64 downstream, not text
            Ok(format!("[IMAGE File Context: {:?}]", path))
        }
         "mp4" | "mov" | "mp3" | "wav" | "m4a" => {
             // Audio/Video
            Ok(format!("[MEDIA File Context: {:?}]", path))
        }
        _ => Err(anyhow::anyhow!("Unsupported file extraction type: {}", ext)),
    }
}
