use tiktoken_rs::cl100k_base;

pub fn chunk_text_for_extension(
    text: &str,
    extension: &str,
    chunk_tokens: usize,
    overlap: usize,
) -> Vec<String> {
    let extension = extension.to_lowercase();
    let structured_sections = if is_code_extension(&extension) {
        split_code_sections(text)
    } else if extension == "md" {
        split_markdown_sections(text)
    } else {
        split_text_sections(text)
    };

    let structured_sections = compact_sections(structured_sections, 240);
    let mut chunks = Vec::new();

    for section in structured_sections {
        let section_chunks = chunk_text(&section, chunk_tokens, overlap);
        if section_chunks.is_empty() && !section.trim().is_empty() {
            chunks.push(section);
        } else {
            chunks.extend(section_chunks);
        }
    }

    chunks
}

/// Splits a long text string into overlapping chunks using cl100k_base tokenization.
pub fn chunk_text(text: &str, chunk_tokens: usize, overlap: usize) -> Vec<String> {
    if text.trim().is_empty() {
        return vec![];
    }

    let Ok(bpe) = cl100k_base() else {
        return vec![text.to_string()];
    };
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

fn is_code_extension(extension: &str) -> bool {
    matches!(
        extension,
        "rs" | "py" | "js" | "ts" | "jsx" | "tsx" | "go" | "c" | "cpp" | "h" | "java" | "cs"
    )
}

fn split_markdown_sections(text: &str) -> Vec<String> {
    let mut sections = Vec::new();
    let mut current = String::new();

    for line in text.lines() {
        if line.trim_start().starts_with('#') && !current.trim().is_empty() {
            sections.push(current.trim().to_string());
            current.clear();
        }

        current.push_str(line);
        current.push('\n');
    }

    if !current.trim().is_empty() {
        sections.push(current.trim().to_string());
    }

    if sections.is_empty() {
        split_text_sections(text)
    } else {
        sections
    }
}

fn split_code_sections(text: &str) -> Vec<String> {
    let mut sections = Vec::new();
    let mut current = String::new();

    for line in text.lines() {
        let trimmed = line.trim_start();
        if is_code_boundary(trimmed) && !current.trim().is_empty() {
            sections.push(current.trim().to_string());
            current.clear();
        }

        current.push_str(line);
        current.push('\n');
    }

    if !current.trim().is_empty() {
        sections.push(current.trim().to_string());
    }

    if sections.is_empty() {
        split_text_sections(text)
    } else {
        sections
    }
}

fn split_text_sections(text: &str) -> Vec<String> {
    let mut sections = Vec::new();
    let mut current = String::new();

    for block in text.split("\n\n") {
        let trimmed = block.trim();
        if trimmed.is_empty() {
            continue;
        }

        if !current.is_empty() && current.len() + trimmed.len() > 1400 {
            sections.push(current.trim().to_string());
            current.clear();
        }

        if !current.is_empty() {
            current.push_str("\n\n");
        }
        current.push_str(trimmed);
    }

    if !current.trim().is_empty() {
        sections.push(current.trim().to_string());
    }

    sections
}

fn compact_sections(sections: Vec<String>, min_chars: usize) -> Vec<String> {
    let mut compacted = Vec::new();
    let mut buffer = String::new();

    for section in sections {
        let trimmed = section.trim();
        if trimmed.is_empty() {
            continue;
        }

        if buffer.is_empty() {
            buffer.push_str(trimmed);
            continue;
        }

        if buffer.len() < min_chars {
            buffer.push_str("\n\n");
            buffer.push_str(trimmed);
            continue;
        }

        compacted.push(std::mem::take(&mut buffer));
        buffer.push_str(trimmed);
    }

    if !buffer.trim().is_empty() {
        compacted.push(buffer);
    }

    compacted
}

fn is_code_boundary(trimmed: &str) -> bool {
    matches!(
        true,
        _ if trimmed.starts_with("fn ")
            || trimmed.starts_with("pub fn ")
            || trimmed.starts_with("async fn ")
            || trimmed.starts_with("pub async fn ")
            || trimmed.starts_with("def ")
            || trimmed.starts_with("class ")
            || trimmed.starts_with("function ")
            || trimmed.starts_with("export function ")
            || trimmed.starts_with("const ")
            || trimmed.starts_with("let ")
            || trimmed.starts_with("var ")
            || trimmed.starts_with("interface ")
            || trimmed.starts_with("type ")
            || trimmed.starts_with("struct ")
            || trimmed.starts_with("enum ")
            || trimmed.starts_with("impl ")
            || trimmed.starts_with("mod ")
            || trimmed.starts_with("trait ")
    )
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

    #[test]
    fn test_markdown_chunking_preserves_headers() {
        let text = "# Intro\nHello\n\n# Details\nMore text";
        let chunks = chunk_text_for_extension(text, "md", 200, 20);
        assert_eq!(chunks.len(), 2);
        assert!(chunks[0].starts_with("# Intro"));
        assert!(chunks[1].starts_with("# Details"));
    }

    #[test]
    fn test_code_chunking_splits_functions() {
        let text = "fn one() {\n  println!(\"one\");\n}\n\nfn two() {\n  println!(\"two\");\n}";
        let chunks = chunk_text_for_extension(text, "rs", 200, 20);
        assert_eq!(chunks.len(), 2);
        assert!(chunks[0].contains("fn one"));
        assert!(chunks[1].contains("fn two"));
    }
}
