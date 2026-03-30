import { DragEvent, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FolderPlus, RefreshCw, Trash2, X } from "lucide-react";

interface SettingsPanelProps {
  onClose?: () => void;
  onReindex: () => void;
}

export function SettingsPanel({ onClose, onReindex }: SettingsPanelProps) {
  const [roots, setRoots] = useState<string[]>([]);
  const [newRoot, setNewRoot] = useState("");
  const [syncStatus, setSyncStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const syncStatusLabel = useMemo(() => {
    if (syncStatus === "syncing") return "syncing";
    if (syncStatus === "idle") return "watching";
    return syncStatus;
  }, [syncStatus]);

  const loadRoots = async () => {
    try {
      const nextRoots = await invoke<string[]>("get_indexed_roots");
      setRoots(nextRoots);
    } catch (loadError) {
      setError(String(loadError));
    }
  };

  useEffect(() => {
    loadRoots();
    const interval = window.setInterval(async () => {
      try {
        const status = await invoke<string>("get_sync_status");
        setSyncStatus(status);
      } catch {
        // ignore
      }
    }, 1000);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onClose) onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const handleAdd = async () => {
    if (!newRoot.trim()) return;
    setIsBusy(true);
    setError(null);
    try {
      await invoke("add_indexed_root", { path: newRoot.trim() });
      setNewRoot("");
      await loadRoots();
    } catch (addError) {
      setError(String(addError));
    } finally {
      setIsBusy(false);
    }
  };

  const addPaths = (paths: string[]) => {
    const nextPath = paths.find((p) => p.trim());
    if (!nextPath) return;
    setNewRoot(nextPath);
    void (async () => {
      setIsBusy(true);
      setError(null);
      try {
        await invoke("add_indexed_root", { path: nextPath.trim() });
        setNewRoot("");
        await loadRoots();
      } catch (addError) {
        setError(String(addError));
      } finally {
        setIsBusy(false);
      }
    })();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const paths: string[] = [];
    const items = event.dataTransfer.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind !== "file") continue;
        const file = items[i].getAsFile();
        const path = (file as File & { path?: string | null })?.path;
        if (path) paths.push(path);
      }
    }
    if (paths.length === 0) {
      for (const file of Array.from(event.dataTransfer.files)) {
        const path = (file as File & { path?: string | null })?.path;
        if (path) paths.push(path);
      }
    }
    addPaths(paths);
  };

  const handleRemove = async (path: string) => {
    setIsBusy(true);
    setError(null);
    try {
      await invoke("remove_indexed_root", { path });
      await loadRoots();
    } catch (removeError) {
      setError(String(removeError));
    } finally {
      setIsBusy(false);
    }
  };

  const handleReset = async () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await invoke("reset_index");
      onReindex();
    } catch (resetError) {
      setError(String(resetError));
      setIsBusy(false);
    }
  };

  return (
    <div
      className="settings-drawer-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="settings-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 20px 14px",
            borderBottom: "1px solid var(--border-faint)",
            flexShrink: 0,
          }}
        >
          <h2
            id="settings-title"
            className="inter-ui"
            style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)", margin: 0 }}
          >
            Settings
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border-faint)",
                cursor: "pointer",
                color: "var(--text-dim)",
              }}
              aria-label="Close settings"
            >
              <X style={{ width: 13, height: 13 }} />
            </button>
          )}
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

          {/* Sync status */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <span
              className="mono-ui"
              style={{ fontSize: "0.68rem", letterSpacing: "0.12em", color: "var(--text-dim)", textTransform: "uppercase" }}
            >
              background sync
            </span>
            <span
              className="mono-ui"
              style={{
                fontSize: "0.68rem",
                letterSpacing: "0.1em",
                color: syncStatus === "syncing" ? "rgba(155,255,215,0.8)" : "var(--text-dim)",
                textTransform: "uppercase",
              }}
            >
              {syncStatusLabel}
            </span>
          </div>

          {/* Indexed roots */}
          <div style={{ marginBottom: 20 }}>
            <p
              className="inter-ui"
              style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-soft)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}
            >
              Indexed Folders
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {roots.length === 0 ? (
                <p style={{ fontSize: "0.78rem", color: "var(--text-dim)", padding: "8px 0" }}>
                  No indexed directories yet.
                </p>
              ) : (
                roots.map((root) => (
                  <div
                    key={root}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--border-faint)",
                    }}
                  >
                    <span
                      className="mono-ui"
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--text-soft)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        minWidth: 0,
                        flex: 1,
                      }}
                      title={root}
                    >
                      {root}
                    </span>
                    <button
                      onClick={() => handleRemove(root)}
                      disabled={isBusy}
                      type="button"
                      style={{
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-dim)",
                        opacity: isBusy ? 0.4 : 1,
                        transition: "color 150ms",
                      }}
                      aria-label={`Remove ${root}`}
                    >
                      <Trash2 style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add folder */}
          <div style={{ marginBottom: 20 }}>
            <p
              className="inter-ui"
              style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-soft)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}
            >
              Add Folder
            </p>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: `1px dashed ${isDragOver ? "rgba(155,255,215,0.6)" : "rgba(155,255,215,0.2)"}`,
                borderRadius: 8,
                padding: "12px",
                textAlign: "center",
                fontSize: "0.72rem",
                color: "var(--text-dim)",
                marginBottom: 10,
                transition: "border-color 150ms",
                background: isDragOver ? "rgba(155,255,215,0.04)" : "transparent",
              }}
            >
              drop a folder here
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={newRoot}
                onChange={(e) => setNewRoot(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                disabled={isBusy}
                placeholder="/path/to/folder"
                className="mono-ui"
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: 8,
                  padding: "0 12px",
                  fontSize: "0.75rem",
                  color: "var(--text-main)",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border-faint)",
                  outline: "none",
                  opacity: isBusy ? 0.6 : 1,
                }}
              />
              <button
                onClick={handleAdd}
                disabled={isBusy}
                type="button"
                style={{
                  height: 36,
                  padding: "0 14px",
                  borderRadius: 8,
                  fontSize: "0.75rem",
                  color: "var(--text-soft)",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--border-faint)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  opacity: isBusy ? 0.5 : 1,
                  flexShrink: 0,
                }}
              >
                <FolderPlus style={{ width: 13, height: 13 }} />
                Add
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                borderRadius: 8,
                border: "1px solid rgba(248,113,113,0.3)",
                background: "rgba(248,113,113,0.08)",
                padding: "8px 12px",
                fontSize: "0.75rem",
                color: "#fca5a5",
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Danger zone footer */}
        <div
          style={{
            borderTop: "1px solid rgba(248,113,113,0.2)",
            padding: "16px 20px",
            flexShrink: 0,
          }}
        >
          <p
            className="mono-ui"
            style={{ fontSize: "0.65rem", color: "rgba(248,113,113,0.6)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}
          >
            danger zone
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            {confirmingReset && (
              <button
                onClick={() => setConfirmingReset(false)}
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.72rem",
                  color: "var(--text-dim)",
                  padding: 0,
                }}
              >
                cancel
              </button>
            )}
            <button
              onClick={handleReset}
              disabled={isBusy}
              type="button"
              className="inter-ui"
              style={{
                marginLeft: "auto",
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: isBusy ? "not-allowed" : "pointer",
                opacity: isBusy ? 0.5 : 1,
                background: confirmingReset
                  ? "rgba(248,113,113,0.88)"
                  : "rgba(248,113,113,0.1)",
                border: `1px solid ${confirmingReset ? "rgba(248,113,113,0.8)" : "rgba(248,113,113,0.3)"}`,
                color: confirmingReset ? "#fff" : "rgba(248,113,113,0.85)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 150ms",
              }}
            >
              <RefreshCw style={{ width: 12, height: 12 }} className={isBusy ? "animate-spin" : ""} />
              {confirmingReset ? "Confirm Reset" : "Reset Index"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
