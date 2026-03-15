-- Create files table
CREATE TABLE files (
  id          TEXT PRIMARY KEY,
  path        TEXT UNIQUE NOT NULL,
  file_type   TEXT NOT NULL,
  size_bytes  INTEGER,
  modified_at INTEGER,
  indexed_at  INTEGER,
  status      TEXT DEFAULT 'pending'
);

-- Create chunks table
CREATE TABLE chunks (
  id            TEXT PRIMARY KEY,
  file_id       TEXT REFERENCES files(id) ON DELETE CASCADE,
  chunk_index   INTEGER,
  modality      TEXT,
  text_excerpt  TEXT,
  thumbnail_path TEXT,
  qdrant_point_id TEXT UNIQUE,
  created_at    INTEGER
);

-- Create indexer_state table
CREATE TABLE indexer_state (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Create api_usage table
CREATE TABLE api_usage (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         INTEGER,
  tokens     INTEGER,
  cost_usd   REAL
);