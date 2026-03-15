use std::collections::HashMap;
use std::sync::Mutex;

pub struct VectorStore {
    chunks: Mutex<HashMap<String, Vec<f32>>>,
}

impl VectorStore {
    pub fn new() -> Self {
        VectorStore {
            chunks: Mutex::new(HashMap::new()),
        }
    }

    pub fn insert_chunk(&self, chunk_id: String, embedding: Vec<f32>) {
        self.chunks.lock().unwrap().insert(chunk_id, embedding);
    }

    pub fn search(&self, query_embedding: Vec<f32>, limit: usize) -> Vec<(String, f32)> {
        let chunks = self.chunks.lock().unwrap();
        let mut results: Vec<(String, f32)> = chunks.iter()
            .map(|(id, emb)| (id.clone(), cosine_similarity(&query_embedding, emb)))
            .collect();
        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        results.into_iter().take(limit).collect()
    }
}

fn cosine_similarity(a: &Vec<f32>, b: &Vec<f32>) -> f32 {
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        0.0
    } else {
        dot / (norm_a * norm_b)
    }
}