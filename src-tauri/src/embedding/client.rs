use anyhow::{Context, Result};
use reqwest::{Client, StatusCode};
use std::time::Duration;
use tokio::time::sleep;

use super::types::{BatchEmbedRequest, BatchEmbedResponse, EmbedRequest};

const GEMINI_API_URL: &str = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-exp-03-07:batchEmbedContents";

pub async fn batch_embed(
    client: &Client,
    api_key: &str,
    requests: Vec<EmbedRequest>,
) -> Result<Vec<Vec<f32>>> {
    if requests.is_empty() {
        return Ok(Vec::new());
    }

    let url = format!("{}?key={}", GEMINI_API_URL, api_key);
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
            let body: BatchEmbedResponse = response.json().await.context("Failed to parse Gemini API JSON response")?;
            return Ok(body.embeddings.into_iter().map(|e| e.values).collect());
        }

        if status == StatusCode::TOO_MANY_REQUESTS || status.is_server_error() {
            if retries >= max_retries {
                anyhow::bail!("Gemini API failed after {} retries: {}", retries, status);
            }
            retries += 1;
            // Exponential backoff
            sleep(Duration::from_secs(2_u64.pow(retries))).await;
            continue;
        }

        anyhow::bail!("Gemini API error {}: {:?}", status, response.text().await?);
    }
}
