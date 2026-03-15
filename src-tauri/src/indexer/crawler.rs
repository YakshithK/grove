use walkdir::WalkDir;
use std::path::PathBuf;

const SKIP_DIRS: &[&str] = &[
    "node_modules", ".git", "target", "venv", ".venv",
    "__pycache__", "dist", "build", ".cache"
];

const ALLOWED_EXT: &[&str] = &[
    "txt", "md", "rs", "py", "js", "ts", "jsx", "tsx", "go",
    "c", "cpp", "h", "java", "cs", "json", "yaml", "toml",
    "pdf", "docx", "pptx",
    "png", "jpg", "jpeg", "webp",
    "mp4", "mov", "mp3", "wav", "m4a"
];

pub fn crawl(roots: &[PathBuf]) -> impl Iterator<Item = PathBuf> + '_ {
    roots.iter().flat_map(|root| {
        WalkDir::new(root)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_string_lossy();
                !name.starts_with('.') && !SKIP_DIRS.contains(&&*name)
            })
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .filter(|e| {
                e.path().extension()
                    .and_then(|x| x.to_str())
                    .map(|ext| ALLOWED_EXT.contains(&ext.to_lowercase().as_str()))
                    .unwrap_or(false)
            })
            .map(|e| e.into_path())
    })
}