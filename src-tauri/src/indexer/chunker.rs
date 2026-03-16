use tiktoken_rs::cl100k_base;

/// Splits a long text string into overlapping chunks using cl100k_base tokenization.
pub fn chunk_text(text: &str, chunk_tokens: usize, overlap: usize) -> Vec<String> {
    if text.trim().is_empty() {
        return vec![];
    }

    let bpe = cl100k_base().unwrap();
    let tokens = bpe.encode_ordinary(text);
    let mut chunks = Vec::new();

    if tokens.is_empty() {
        return chunks;
    }

    let mut start = 0;
    while start < tokens.len() {
        let end = (start + chunk_tokens).min(tokens.len());
        let chunk_tokens_slice = &tokens[start..end];
        
        if let Ok(decoded) = bpe.decode(chunk_tokens_slice.to_vec()) {
            chunks.push(decoded);
        }

        if end == tokens.len() {
            break;
        }

        // Avoid infinite loop if overlap >= chunk_tokens
        let step = chunk_tokens.saturating_sub(overlap).max(1);
        start += step;
    }

    chunks
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chunking_short_text() {
        let text = "Hello world this is a test";
        let chunks = chunk_text(text, 10, 2);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], text);
    }
}
