use reqwest;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct EmbedRequest {
    content: Content,
}

#[derive(Serialize)]
struct Content {
    parts: Vec<Part>,
}

#[derive(Serialize)]
struct Part {
    text: String,
}

#[derive(Deserialize)]
struct EmbedResponse {
    embedding: Embedding,
}

#[derive(Deserialize)]
struct Embedding {
    values: Vec<f32>,
}

pub async fn embed_text(text: &str, api_key: &str) -> Result<Vec<f32>, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let url = format!("https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={}", api_key);
    let request = EmbedRequest {
        content: Content {
            parts: vec![Part { text: text.to_string() }],
        },
    };
    let response = client.post(&url).json(&request).send().await?;
    let embed_resp: EmbedResponse = response.json().await?;
    Ok(embed_resp.embedding.values)
}