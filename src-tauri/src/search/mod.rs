use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SearchResult {
    pub chunk_id: String,
    pub file_id: String,
    pub path: String,
    pub file_type: String,
    pub text_excerpt: Option<String>,
    pub thumbnail_path: Option<String>,
    pub score: f32,
    pub rank: usize,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SearchFilters {
    pub file_type: Option<String>,
    pub path_prefix: Option<String>,
}
