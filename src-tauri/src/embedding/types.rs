use serde::{Deserialize, Serialize};

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Content {
    pub role: String,
    pub parts: Vec<Part>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Part {
    pub text: String,
    // Note: Future revisions could use inline_data struct for images/video
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EmbedRequest {
    pub model: String,
    pub content: Content,
    pub task_type: String,
    pub output_dimensionality: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BatchEmbedRequest {
    pub requests: Vec<EmbedRequest>,
}

#[derive(Deserialize, Debug)]
pub struct EmbeddingResponse {
    pub values: Vec<f32>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BatchEmbedResponse {
    pub embeddings: Vec<EmbeddingResponse>,
}
