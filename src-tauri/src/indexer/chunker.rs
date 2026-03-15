pub fn chunk_text(text: &str, max_tokens: usize) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let mut chunks = Vec::new();
    let mut start = 0;
    while start < text.len() {
        let end = (start + max_tokens * 4).min(text.len()); // approx 4 chars per token
        chunks.push(text[start..end].to_string());
        start = end;
    }
    Ok(chunks)
}