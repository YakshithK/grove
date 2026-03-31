# Grove

Grove is a local-first semantic desktop search app built with Tauri v2, Rust, React, Vite, and TypeScript. It indexes files from folders you choose, generates Gemini embeddings for their contents, and lets you search them with natural language instead of exact filenames or keywords.

The app is designed for documents, code, PDFs, images, and small media files. Index data stays on the local machine; file content is only sent to Gemini when embeddings are generated.

## What It Does

- Indexes selected folders recursively.
- Supports semantic search across text, code, PDFs, images, audio, and video.
- Uses Gemini Embedding 2 for both document embeddings and query embeddings.
- Keeps a live filesystem watcher running after indexing so changes can be synced automatically.
- Opens files directly from search results or reveals them in the system file explorer.

## Current Stack

- Frontend: React 19, Vite 7, TypeScript, Tailwind CSS
- Desktop shell: Tauri v2
- Backend: Rust + Tokio
- Embeddings: Gemini Embedding 2
- Local storage:
  - `vectors.json` for vector payloads
  - `indexed-roots.json` for watched folders
  - there is also a SQLite metadata layer in the repo, but the active search flow currently uses the JSON vector store

## High-Level Architecture

- `src/`: React UI, search UX, setup flow, indexing status screens, settings panel
- `src-tauri/src/commands.rs`: Tauri commands, indexing orchestration, search pipeline, watcher bootstrap, API key resolution
- `src-tauri/src/indexer/`: crawling, extraction, chunking, media/PDF helpers, filesystem watcher
- `src-tauri/src/embedding/`: Gemini request builders and HTTP client logic
- `src-tauri/src/store/vector.rs`: in-memory vector store with JSON persistence, dense search, lexical search, and pruning helpers
- `.github/workflows/release.yml`: tagged release builds for Linux, Windows, and macOS

## Supported Files

Allowed extensions currently include:

- Text and code: `txt`, `md`, `rs`, `py`, `js`, `ts`, `jsx`, `tsx`, `go`, `c`, `cpp`, `h`, `java`, `cs`, `json`, `yaml`, `yml`, `toml`
- Documents: `pdf`, `docx`, `pptx`
- Images: `png`, `jpg`, `jpeg`, `webp`
- Media: `mp4`, `mov`, `mp3`, `wav`, `m4a`

Ignored directories include common large/generated folders such as `node_modules`, `.git`, `target`, `dist`, `build`, `.cache`, `.next`, `.svelte-kit`, and virtual environments.

## How Indexing Works

1. The app recursively crawls the selected root folders.
2. Files are processed with up to 8 concurrent workers.
3. Text/code files are extracted and chunked into 512-token chunks with 64-token overlap.
4. Text chunks are embedded in batches of up to 100 requests.
5. PDFs/images/audio/video use Gemini's native multimodal embedding path.
6. Binary files larger than 10 MB are skipped.
7. Vectors are normalized and stored in a local JSON-backed vector store.
8. After indexing, a filesystem watcher keeps the index in sync for watched roots.

Important implementation detail: a full re-index clears the existing vector store and rebuilds it. Live watcher updates handle subsequent file creates, edits, renames, and deletes.

## How Search Works

Search is currently hybrid:

- Dense semantic retrieval using a Gemini query embedding with `taskType: RETRIEVAL_QUERY`
- Lexical retrieval over filename, path, file type, and stored text excerpts
- Reciprocal-rank fusion plus a small reranking bonus for filename, path, snippet, code intent, and file-type hints

Other current search behavior:

- Dense vector threshold is `0.35`
- The backend works from up to 100 chunk candidates
- Results are merged to file-level results and truncated to the top 20 files
- Image results can include inline base64 thumbnails

## Data Location

The app stores data under the OS local app data directory in a `grove` folder.

On Linux this resolves to:

```text
~/.local/share/grove
```

Key files:

- `vectors/vectors.json`: persisted vector store
- `indexed-roots.json`: watched/indexed root folders

## API Key Resolution

Gemini API keys are resolved in this order:

1. `GROVE_API_KEY` baked in at compile time
2. `VISH_API_KEY` baked in at compile time for backward compatibility
3. `GEMINI_API_KEY` baked in at compile time
4. Runtime `GEMINI_API_KEY`
5. `GEMINI_API_KEY` from a root `.env` file
6. Empty value, which means the user must set a key in the app

Example `.env`:

```bash
GEMINI_API_KEY=your_key_here
```

## Local Development

### Prerequisites

- Node.js 18+ with `npm`
- Rust stable toolchain
- Tauri system dependencies for your platform
- A Gemini API key unless you are building with a baked-in key

### Install

```bash
npm install
```

### Run the app in development

```bash
npm run tauri dev
```

### Run only the frontend

```bash
npm run dev
```

### Production build

```bash
npm run tauri build
```

## Linux Notes

Tauri on Linux typically needs WebKitGTK and related native packages. The CI workflow installs:

```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libsqlite3-dev
```

If `npm run tauri dev` or `npm run tauri build` fails on Linux, missing native Tauri dependencies are the first thing to check.

## Common Commands

```bash
# desktop app dev
npm run tauri dev

# frontend only
npm run dev

# frontend production build
npm run build

# tauri CLI passthrough
npm run tauri
```

## Versioning

When bumping versions, keep these three files in sync:

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

Use the helper script:

```bash
./scripts/bump-version.sh 0.8.1
```

## Releases

Releases are built by GitHub Actions on pushed tags matching `v*`.

Example:

```bash
git tag v0.8.0
git push origin v0.8.0
```

The workflow in `.github/workflows/release.yml` builds for:

- Linux
- Windows
- macOS Apple Silicon
- macOS Intel

The release workflow currently injects the compile-time key through `GROVE_API_KEY`.

## Project Layout

```text
.
├── src/                     # React frontend
├── src-tauri/               # Rust backend and Tauri config
├── scripts/                 # repo scripts, including version bump helper
├── .github/workflows/       # CI and release automation
├── docs/                    # project docs and planning notes
└── .claude/                 # Claude-specific product, design, and mockup context
```

## `.claude/` At A High Level

The `.claude/` directory is support material for repository context, not runtime app code. It currently contains:

- `CLAUDE.md`: repo guidance and architecture summary for Claude Code
- `docs/prd.md`: product requirements and original product framing
- `docs/architecture_deep_dive.md`: a long-form explanation of indexing, embedding, search, and watching
- `docs/eng_design.md`, `docs/implementation_plan.md`, `docs/soul.md`: planning, design direction, and product intent
- `docs/SHIPPING.md`: release/distribution notes
- `mockups/`: visual references for setup/search/results screens
- `settings.local.json`: local Claude tool settings

Those docs are useful for intent and planning, but the Rust and React code are the source of truth for current behavior.

## Important Caveats

- `docx` and `pptx` are allowed by the crawler, but extraction is still placeholder-based rather than full structured parsing.
- The repo includes a SQLite metadata store module, but the active search path is powered by the JSON vector store.
- Full rebuild indexing clears previous vectors first.
- Files over 10 MB on the multimodal path are skipped.

## Recommended Repo Entry Points

If you are new to the codebase, start here:

- `src/App.tsx`
- `src/hooks/useAppState.ts`
- `src/hooks/useSearch.ts`
- `src-tauri/src/commands.rs`
- `src-tauri/src/store/vector.rs`
- `src-tauri/src/indexer/crawler.rs`
- `src-tauri/src/indexer/extractor.rs`
- `src-tauri/src/indexer/watcher.rs`

## Status

Current version in the repo:

- App version: `0.8.0`

This README documents the codebase as it exists in the repository now, not just the older planning docs.
