use std::process::Command;
use std::path::Path;
use anyhow::{Result, Context};
use base64::{Engine as _, engine::general_purpose};

/// Helper function attempting PDF text extraction via `pdftotext` from `poppler-utils`.
/// Assumes `pdftotext` exists in the system PATH.
pub fn extract_pdf(path: &Path) -> Result<String> {
    let output = Command::new("pdftotext")
        .args(["-nopgbrk", path.to_str().unwrap_or(""), "-"])
        .output()
        .context("Failed executing `pdftotext`. Make sure poppler is installed on the system.")?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("Failed parsing PDF: {}", err);
    }
    
    let text = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(text)
}

/// Image formats Base64 encoded wrappers
pub fn get_image_base64(path: &Path) -> Result<String> {
     let bytes = std::fs::read(path).context("Failed reading image file")?;
     Ok(general_purpose::STANDARD.encode(&bytes))
}
