use anyhow::{Context, Result};
use reqwest::{Client, StatusCode};
use std::time::Duration;
use tokio::time::sleep;

use super::types::{BatchEmbedRequest, BatchEmbedResponse, EmbedRequest, Content, Part};

const GEMINI_MODEL: &str = "models/gemini-embedding-2-preview";
const GEMINI_EMBED_URL: &str = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2-preview:batchEmbedContents";
const EMBED_DIMENSION: u32 = 768;

/// Build an EmbedRequest for a text chunk (used during indexing)
pub fn make_document_request(text: &str) -> EmbedRequest {
    EmbedRequest {
        model: GEMINI_MODEL.to_string(),
        content: Content {
            role: "user".to_string(),
            parts: vec![Part { text: text.to_string() }],
        },
        task_type: "RETRIEVAL_DOCUMENT".to_string(),
        output_dimensionality: EMBED_DIMENSION,
        title: None,
    }
}

/// Build an EmbedRequest for a search query
pub fn make_query_request(query: &str) -> EmbedRequest {
    EmbedRequest {
        model: GEMINI_MODEL.to_string(),
        content: Content {
            role: "user".to_string(),
            parts: vec![Part { text: query.to_string() }],
        },
        task_type: "RETRIEVAL_QUERY".to_string(),
        output_dimensionality: EMBED_DIMENSION,
        title: None,
    }
}

/// Batch embed multiple text chunks. Returns one Vec<f32> per input request.
pub async fn batch_embed(
    client: &Client,
    api_key: &str,
    requests: Vec<EmbedRequest>,
) -> Result<Vec<Vec<f32>>> {
    if requests.is_empty() {
        return Ok(Vec::new());
    }

    let url = format!("{}?key={}", GEMINI_EMBED_URL, api_key);
    let payload = BatchEmbedRequest { requests };

    let mut retries = 0;
    let max_retries = 3;

    loop {
        let response = client
            .post(&url)
            .json(&payload)
            .send()
            .await?;

        let status = response.status();
        
        if status.is_success() {
            let body: BatchEmbedResponse = response.json().await.context("Failed to parse Gemini embedding response")?;
            return Ok(body.embeddings.into_iter().map(|e| e.values).collect());
        }

        if status == StatusCode::TOO_MANY_REQUESTS || status.is_server_error() {
            if retries >= max_retries {
                anyhow::bail!("Gemini API failed after {} retries: {}", retries, status);
            }
            retries += 1;
            sleep(Duration::from_secs(2_u64.pow(retries))).await;
            continue;
        }

        let err_body = response.text().await.unwrap_or_default();
        anyhow::bail!("Gemini API error {}: {}", status, err_body);
    }
}

/// Embed a single text string (convenience wrapper for search queries)
pub async fn embed_query(client: &Client, api_key: &str, query: &str) -> Result<Vec<f32>> {
    let req = make_query_request(query);
    let mut results = batch_embed(client, api_key, vec![req]).await?;
    results.pop().context("Empty embedding response from Gemini")
}
