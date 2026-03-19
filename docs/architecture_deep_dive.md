# SenseDesk / Vish Architecture Deep Dive

This document outlines the complete mechanics of the Vish application, from the frontend React interface down to the raw JSON payloads hitting the Google Gemini embedding API, and how vector math performs the final search.

---

## 1. The Big Picture

Vish is a desktop semantic search application built on the **Tauri v2** framework.
- **Frontend:** React + Vite + Tailwind CSS + TypeScript. It handles UI state, folder selection, and parsing search queries.
- **Backend:** Rust (`src-tauri`). It handles file crawling, chunking, binary extraction, REST API communication with Gemini, and in-memory vector storage/search.

The core premise is **Local-First Search backed by Cloud Embeddings**. Your files never leave your machine *unless* they are being sent as an ephemeral payload to the Gemini API to compute their mathematical representation (an embedding). 

---

## 2. The Indexing Pipeline (`commands::start_indexing`)

When you drag a folder into the Setup screen and click "Continue," the frontend invokes the Tauri command [start_indexing([folders])](file:///home/yakshith/sensedesk/src-tauri/src/commands.rs#130-346). Here is the exact, step-by-step lifecycle of that request.

### Step A: Wiping the Slate
The very first action is `vector_store.clear().await`. This completely wipes the in-memory array of vectors to ensure no "ghost files" remain if you deleted files from your disk since the last scan.

### Step B: The Crawler
The app uses the `walkdir` crate to recursively traverse the folders you provided. It collects every single file path into an in-memory `Vec<PathBuf>`.

### Step C: Concurrent Processing
A Tokio asynchronous task is spawned. To prevent overflowing your RAM or hitting Gemini API rate limits too quickly, the backend uses a `tokio::sync::Semaphore` set to `MAX_CONCURRENT_FILES = 8`. This means exactly 8 files are processed in parallel at any given moment.

### Step D: The Extractor & Multimodal Fork
For each file, the application looks at the file extension. This is the **most critical fork in the entire app**.

#### Branch 1: Native Multimodal (Images, Videos, Audio, PDFs)
If the extension matches `pdf`, `png`, `jpg`, `webp`, `mp4`, [mov](file:///home/yakshith/sensedesk/src/components/SetupScreen.tsx#30-33), `mp3`, `wav`, or `m4a`, the app takes advantage of Gemini Embedding 2's native multimodal capabilities.
1. It reads the raw physical bytes of the file into RAM (`std::fs::read`).
2. It completely skips files over 10MB to avoid breaking the API limits.
3. It converts those physical bytes into a Base64 encoded string.
4. It calls [make_binary_request()](file:///home/yakshith/sensedesk/src-tauri/src/embedding/client.rs#28-46) with the specified MIME type (e.g., `image/jpeg`).

#### Branch 2: Text Extraction
If the extension is [.txt](file:///home/yakshith/sensedesk/test_data/animals/honey_bees.txt), [.md](file:///home/yakshith/sensedesk/README.md), [.rs](file:///home/yakshith/sensedesk/src-tauri/build.rs), [.py](file:///home/yakshith/sensedesk/test_data/code/fibonacci.py) or any other code/text format:
1. It attempts to read the file into a pure UTF-8 string.
2. It passes that string to the **Chunker**.
3. Because Gemini Embedding 2 has an 8192-token window limit, large text files *must* be sliced. The app uses the `tiktoken-rs` crate (using the `cl100k_base` tokenizer) to chunk the text into blocks of exactly **512 tokens**, with an **overlap of 64 tokens**. This overlap ensures that a sentence split down the middle doesn't lose its meaning.
4. It collects these chunks into batches of **100** (the `EMBED_BATCH_SIZE`), which is the maximum batch size Gemini allows per request.
5. It maps each chunk to a [make_text_request()](file:///home/yakshith/sensedesk/src-tauri/src/embedding/client.rs#12-27).

---

## 3. The Embedding Client — Nitty Gritty Detail

The [src-tauri/src/embedding/client.rs](file:///home/yakshith/sensedesk/src-tauri/src/embedding/client.rs) file forms the JSON requests that are fired via HTTP (`reqwest`) to Google's servers.

**Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2-preview:batchEmbedContents`
**Dimensions:** `768` floats per vector.

### 3.1 Text Embeddings ([make_text_request](file:///home/yakshith/sensedesk/src-tauri/src/embedding/client.rs#12-27))
For text chunks, the JSON structure is dead simple:
```json
{
  "requests": [
    {
      "model": "models/gemini-embedding-2-preview",
      "content": {
        "parts": [{ "text": "This is a chunk of my text file..." }]
      },
      "taskType": "RETRIEVAL_DOCUMENT",
      "outputDimensionality": 768
    }
  ]
}
```
**Important:** We set `taskType: "RETRIEVAL_DOCUMENT"`. This signals to Gemini's neural network, "I am storing this in a database to be searched against later."

### 3.2 Binary / Multimodal Embeddings ([make_binary_request](file:///home/yakshith/sensedesk/src-tauri/src/embedding/client.rs#28-46))
For images, audio, video, and PDFs, the JSON structure shifts completely. We use the `inlineData` property.

```json
{
  "requests": [
    {
      "model": "models/gemini-embedding-2-preview",
      "content": {
        "parts": [
          {
            "inlineData": {
              "mimeType": "image/jpeg",
              "data": "iVBORw0KGgoAAAANSUhEUgAAA..." 
            }
          }
        ]
      },
      "taskType": "RETRIEVAL_DOCUMENT",
      "outputDimensionality": 768
    }
  ]
}
```
Gemini's multimodal engine parses the raw pixels, video frames, or audio waveforms directly from the base64, creating an incredibly rich mathematical snapshot of the *contents* of that media, completely independent of text.

### 3.3 HTTP Dispatch and Retries
The [batch_embed](file:///home/yakshith/sensedesk/src-tauri/src/embedding/client.rs#63-106) function sends the payload. If the Google API responds with a `429 Too Many Requests` (common when processing thousands of files concurrently), the app automatically applies an **Exponential Backoff**: it waits 2 seconds, retries, waits 4 seconds, retries, waits 8 seconds, retries, before giving up.

---

## 4. The Custom Vector Database ([store/vector.rs](file:///home/yakshith/sensedesk/src-tauri/src/store/vector.rs))

Once the API responds with an array of `768` floats for each chunk/file, those vectors must be saved. 

Rather than running a heavy database process like Qdrant or Milvus, the app implements a **custom, totally in-memory JSON vector store** stored physically at `~/.local/share/vish/vectors/vectors.json`.

### 4.1 The [StoredPoint](file:///home/yakshith/sensedesk/src-tauri/src/store/vector.rs#7-12) Struct
Every embedded chunk becomes a [StoredPoint](file:///home/yakshith/sensedesk/src-tauri/src/store/vector.rs#7-12):
- [id](file:///home/yakshith/sensedesk/src-tauri/src/store/vector.rs#172-177): A unique `u64` identifier.
- `vector`: The `Vec<f32>` containing exactly 768 floats.
- [payload](file:///home/yakshith/sensedesk/src-tauri/src/store/vector.rs#63-76): A HashMap string dictionary containing metadata:
  - `path`: The absolute path to the file.
  - `file_type`: The extension (e.g., [md](file:///home/yakshith/sensedesk/README.md), `jpg`).
  - [chunk_text](file:///home/yakshith/sensedesk/src-tauri/src/indexer/chunker.rs#3-37): An excerpt. For images, it's just `[JPG file: cat.jpg]`. For text files, it's the first 500 characters of the chunk.

### 4.2 Background Persistence
When points are added, they are pushed into a running [Vec](file:///home/yakshith/sensedesk/src-tauri/src/store/vector.rs#24-29) in your computer's RAM, and a `dirty` flag is set to `true`.
A background loop (`tokio::spawn` in [main.rs](file:///home/yakshith/sensedesk/src-tauri/src/main.rs)) ticks every **5 seconds**. If `dirty == true`, it locks the in-memory array, serializes the *entire* array to JSON, writes it to `vectors.json`, and resets the flag. This keeps indexing lightning fast because writes are buffered into memory.

---

## 5. The Search Mechanics ([search](file:///home/yakshith/sensedesk/src-tauri/src/store/vector.rs#131-167) command)

When you type "a recipe for chicken" into the frontend search bar, the UI calls the Tauri command [search(query)](file:///home/yakshith/sensedesk/src-tauri/src/store/vector.rs#131-167).

### Step 1: Query Embedding
The backend fires your query to Gemini using [make_query_request](file:///home/yakshith/sensedesk/src-tauri/src/embedding/client.rs#47-62). 
Crucially, the API payload looks like this:
```json
{
  "content": { "parts": [{ "text": "a recipe for chicken" }] },
  "taskType": "RETRIEVAL_QUERY",
  "outputDimensionality": 768
}
```
Setting `taskType: "RETRIEVAL_QUERY"` is vital. The neural network optimizes the 768 numbers slightly differently to match *against* the documents you saved earlier.

### Step 2: The Math (Cosine Similarity)
The backend loops through **every single vector currently loaded in RAM**. Because the database is custom and simple, there are no HNSW graphs or indexes—it's a brute-force sweep.

For every document vector $A$ and the query vector $B$, it computes the **Cosine Similarity**:
$$\text{Similarity} = \frac{\sum (A \cdot B)}{\sqrt{\sum A^2} \cdot \sqrt{\sum B^2}}$$

In perfectly normalized models, this is just the dot product `A.iter().zip(B.iter()).map(|(a, b)| a * b).sum()`.

### Step 3: Threshold Filtering
It tosses out any result where the Cosine Similarity score is below **0.35**. (This prevents wildly unrelated files from showing up at the bottom of the list).

### Step 4: Sorting and Frontend Normalization
The backend sorts the remaining results highest-to-lowest and sends the top 20 matches back to the React UI as JSON.

Once in React ([ResultList.tsx](file:///home/yakshith/sensedesk/src/components/ResultList.tsx)):
1. **Deduplication:** Because a single text file might have been broken into 50 chunks, 10 chunks from the *same file* might appear in the top 20. The UI filters them so only the highest scoring chunk from a specific file is displayed.
2. **Min-Max Score Normalization:** A cosine similarity of `0.60` is mathematically excellent for an embedding, but to a human user, "60% relevance" feels like a failure. The UI takes the highest score returned (e.g. `0.65`) and scales it to `~98%`, and scales the lowest returned score (e.g. `0.35`) down to `~40%`. This visually spreads the results out into a much more understandable "Relevance" metric for you to look at.
