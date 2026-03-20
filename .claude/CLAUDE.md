# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Vish** is a semantic desktop search application built with **Tauri v2**. It uses Google's Gemini Embedding API to create vector representations of local files, enabling natural language search across documents, images, videos, audio, and PDFs.

### Architecture
- **Frontend**: React 19 + Vite + Tailwind CSS + TypeScript (`src/`)
- **Backend**: Rust (`src-tauri/src/`)
- **Vector Store**: Custom in-memory JSON store with cosine similarity search (no external database)
- **Embeddings**: Gemini Embedding 2 API (768 dimensions)

## Common Commands

### Development
```bash
# Run dev server (starts both Vite and Tauri)
npm run tauri dev

# Build production bundle
npm run tauri build

# Frontend only (for UI development without Rust)
npm run dev
```

### Version Management
When bumping versions, update all three files:
- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

Use `scripts/bump-version.sh` to automate this.

### Releases
Releases are built via GitHub Actions when pushing a version tag:
```bash
git tag v0.4.2
git push origin v0.4.2
```

The CI workflow (`.github/workflows/release.yml`) builds for Linux, Windows, and macOS (both ARM64 and x86_64).

## Key Architecture Details

### Frontend Structure
- `App.tsx` - Main component with screen state machine (`loading` → `setup` → `indexing` → `search`)
- `components/SetupScreen.tsx` - Folder selection for indexing
- `components/IndexingScreen.tsx` - Progress tracking during indexing
- `components/SearchBar.tsx` + `ResultList.tsx` - Search UI
- `hooks/useSearch.ts` - Search invocation via Tauri commands
- `hooks/useAppState.ts` - App screen state management

### Backend Rust Modules
- `commands.rs` - Tauri command handlers (indexing, search, settings)
- `embedding/client.rs` - Gemini API communication (text + binary embeddings)
- `store/vector.rs` - Custom vector store with cosine similarity search
- `indexer/` - File crawling, text extraction, chunking (512 tokens with 64 token overlap)

### Vector Store
Vectors are stored in `~/.local/share/vish/vectors/vectors.json`. The store:
- Uses brute-force cosine similarity (no HNSW/index)
- Filters results below score threshold of 0.35
- Auto-flushes every 200 points during indexing
- Persists to JSON on disk

### Indexing Pipeline
1. Clears existing index
2. Crawls folders recursively (`walkdir`)
3. Processes up to 8 files concurrently (semaphore)
4. **Multimodal branch** (images/PDFs/video/audio): Base64 → Gemini native embedding
5. **Text branch**: Extract → Chunk (512 tokens, 64 overlap) → Batch embed (100/request max)
6. Stores vectors with metadata payload (path, file_type, chunk_text)

### Search Flow
1. Query embedded via Gemini with `taskType: RETRIEVAL_QUERY`
2. Cosine similarity against all stored vectors
3. Results sorted by score, filtered below 0.35, top 20 returned
4. Frontend deduplicates by file path and normalizes scores for display

## API Key Resolution
The Gemini API key is resolved in this priority order:
1. `VISH_API_KEY` compile-time env var (CI builds)
2. `GEMINI_API_KEY` compile-time env var (dev builds)
3. `GEMINI_API_KEY` runtime env var
4. `.env` file in project root

For CI releases, the key is baked into the binary via the `VISH_API_KEY` secret.

## Styling

The app uses a "Deep Sea Neon" palette defined in `tailwind.config.js`:
- Background: Deep navy (`#0A0F14`)
- Accent: Electric cyan (`#00F5FF`)
- Secondary: Digital violet (`#7000FF`)

Custom CSS classes in `index.css` use HSL variables and glassmorphism effects (`backdrop-filter`, translucent backgrounds).

## Important Implementation Notes

- **Binary files** (PDF, PNG, JPG, WEBP, MP4, MOV, MP3, WAV, M4A) are embedded natively by Gemini; files >10MB are skipped
- **Text files** are chunked using `tiktoken-rs` (cl100k_base tokenizer)
- Vector store operations are async and use `tokio::sync::Mutex`
- Re-indexing completely wipes and rebuilds the index (no incremental updates)
- Search results are deduplicated in the UI—only the highest-scoring chunk per file is shown
