import { useRef, useState, DragEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Plus, Folder, X } from "lucide-react";

interface SetupScreenProps {
  onStartIndexing: () => void;
}

export function SetupScreen({ onStartIndexing }: SetupScreenProps) {
  const [folderPath, setFolderPath] = useState("");
  const [folders, setFolders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFolder = (path: string) => {
    const trimmed = path.trim();
    if (trimmed && !folders.includes(trimmed)) {
      setFolders((prev) => [...prev, trimmed]);
      setFolderPath("");
    }
  };

  const removeFolder = (path: string) => {
    setFolders((prev) => prev.filter((f) => f !== path));
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const items = e.dataTransfer.items;
    if (!items) return;

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          addFolder((file as { path?: string }).path || file.name);
        }
      }
    }
  };

  const handleContinue = async () => {
    if (folders.length === 0) {
      setError("Choose at least one directory to index.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await invoke("start_indexing", { folders });
      onStartIndexing();
    } catch (e: unknown) {
      setError(String(e));
      setIsLoading(false);
    }
  };

  const handlePickFolders = async () => {
    try {
      const selection = await open({
        directory: true,
        multiple: true,
        title: "Select folders to index",
      });

      if (!selection) return;

      const picked = Array.isArray(selection) ? selection : [selection];
      picked.forEach((path) => addFolder(path));
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        width: "100%",
        maxWidth: 480,
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      {/* Wordmark */}
      <div
        className="mono-ui uppercase"
        style={{
          textAlign: "center",
          fontSize: "0.68rem",
          letterSpacing: "0.4em",
          color: "var(--text-dim)",
        }}
      >
        grove
      </div>

      {/* Headline */}
      <h1
        className="inter-ui"
        style={{
          textAlign: "center",
          fontSize: "1.4rem",
          fontWeight: 300,
          color: "var(--text-main)",
          margin: 0,
        }}
      >
        Where should Grove look?
      </h1>

      {/* Dropzone */}
      <button
        type="button"
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={handlePickFolders}
        className={`grove-dropzone ${isDragOver ? "grove-dropzone-active" : ""}`}
        style={{ width: "100%", padding: "40px 24px", textAlign: "center" }}
      >
        <Folder
          style={{
            width: 32,
            height: 32,
            margin: "0 auto 12px",
            color: isDragOver ? "rgba(155,255,215,0.9)" : "rgba(155,255,215,0.45)",
            transition: "color 150ms ease-out",
          }}
          strokeWidth={1.25}
        />
        <p
          className="mono-ui"
          style={{
            fontSize: "0.8rem",
            color: isDragOver ? "var(--text-soft)" : "var(--text-dim)",
            transition: "color 150ms ease-out",
          }}
        >
          {isDragOver ? "Drop folders here" : "Drag & drop folders here"}
        </p>
      </button>

      {/* Divider */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, height: 1, background: "var(--border-faint)" }} />
        <span
          className="mono-ui"
          style={{ fontSize: "0.68rem", color: "var(--text-dim)", letterSpacing: "0.08em" }}
        >
          or type a path
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--border-faint)" }} />
      </div>

      {/* Path input row */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          type="text"
          value={folderPath}
          onChange={(e) => setFolderPath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && folderPath.trim()) addFolder(folderPath);
          }}
          placeholder="/path/to/folder"
          className="glass-surface mono-ui"
          style={{
            flex: 1,
            height: 40,
            borderRadius: 10,
            padding: "0 14px",
            fontSize: "0.8rem",
            color: "var(--text-main)",
            outline: "none",
            border: "1px solid var(--border-faint)",
            background: "rgba(255,255,255,0.03)",
          }}
        />
        <button
          type="button"
          onClick={() => addFolder(folderPath)}
          className="glass-surface"
          style={{
            height: 40,
            padding: "0 16px",
            borderRadius: 10,
            fontSize: "0.8rem",
            color: "var(--text-soft)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            border: "1px solid var(--border-faint)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <Plus style={{ width: 14, height: 14 }} />
          Add
        </button>
      </div>

      {/* Folder chips */}
      {folders.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {folders.map((folder) => (
            <div key={folder} className="grove-folder-chip" title={folder}>
              <Folder style={{ width: 11, height: 11, flexShrink: 0 }} />
              <span
                style={{
                  maxWidth: 260,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {folder}
              </span>
              <button
                type="button"
                onClick={() => removeFolder(folder)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "inherit",
                  opacity: 0.6,
                  marginLeft: 2,
                }}
                aria-label={`Remove ${folder}`}
              >
                <X style={{ width: 11, height: 11 }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            borderRadius: 10,
            border: "1px solid rgba(248,113,113,0.3)",
            background: "rgba(248,113,113,0.08)",
            padding: "10px 14px",
            fontSize: "0.8rem",
            color: "#fca5a5",
          }}
        >
          {error}
        </div>
      )}

      {/* CTA */}
      <button
        type="button"
        onClick={handleContinue}
        disabled={isLoading || folders.length === 0}
        className="inter-ui"
        style={{
          width: "100%",
          height: 48,
          borderRadius: 12,
          background: folders.length === 0 ? "rgba(155,255,215,0.15)" : "rgba(168,255,221,0.96)",
          color: folders.length === 0 ? "rgba(155,255,215,0.35)" : "var(--ink)",
          fontSize: "0.95rem",
          fontWeight: 600,
          border: "none",
          cursor: folders.length === 0 ? "not-allowed" : "pointer",
          transition: "all 150ms ease-out",
          boxShadow: folders.length > 0 ? "0 0 22px rgba(155,255,215,0.32)" : "none",
        }}
      >
        {isLoading ? "Starting…" : "Start indexing →"}
      </button>
    </div>
  );
}
