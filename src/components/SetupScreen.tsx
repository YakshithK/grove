import { useRef, useState, DragEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus } from "lucide-react";
import { VishLogo } from "./VishLogo";

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

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const items = e.dataTransfer.items;
    if (!items) {
      return;
    }

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

  return (
    <section className="window-shell animate-fade-in">
      <div className="window-titlebar">
        <div className="traffic-lights" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="text-[1.02rem] font-medium tracking-tight">Vish</div>
      </div>

      <div className="window-panel grid min-h-[680px] grid-cols-1 md:grid-cols-[370px_1fr]">
        <aside className="border-b border-white/10 px-8 py-9 md:border-b-0 md:border-r">
          <div className="max-w-[240px]">
            <h1 className="text-[3rem] font-semibold leading-[0.95] text-[var(--text-main)] md:text-[3.25rem]">
              Initial Setup
            </h1>
            <p className="mt-4 max-w-[220px] text-[1rem] leading-8 text-[var(--text-soft)]">
              Get started by choosing directories to index.
            </p>
          </div>

          <ol className="relative mt-16 space-y-6 pl-7 text-[1.2rem] text-[var(--text-soft)]">
            <li className="sidebar-step-active relative font-medium text-[var(--text-main)]">
              <span className="mr-2">✓</span>1. Choose Directories
            </li>
            <li>2. Configure Settings</li>
            <li className="text-[var(--text-dim)]">3. Indexing</li>
          </ol>
        </aside>

        <section className="px-8 py-9 md:px-9 md:py-10">
          <h2 className="text-[2rem] font-semibold tracking-tight text-[var(--text-main)] md:text-[2.2rem]">
            Choose Directories to Index
          </h2>
          <p className="mt-2 text-[1rem] leading-8 text-[var(--text-soft)]">
            Drag and drop folders into the drop zone or manually input directory paths below.
          </p>

          <button
            type="button"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.focus()}
            className={`glass-surface-strong glow-border mt-8 flex min-h-[300px] w-full flex-col items-center justify-center rounded-[1.7rem] px-6 text-center transition ${
              isDragOver ? "scale-[1.01]" : ""
            }`}
          >
            <VishLogo size={86} glowing />
            <div className="mono-ui mt-7 text-[1.2rem] tracking-tight text-[rgba(31,42,33,0.88)] md:text-[1.7rem]">
              Drag &amp; Drop Folders Here
            </div>
          </button>

          <div className="mt-9">
            <h3 className="text-[1.2rem] font-semibold text-[var(--text-main)] md:text-[1.55rem]">
              Manually Input Directories (Optional)
            </h3>

            <div className="mt-4 flex flex-col gap-3 md:flex-row">
              <input
                ref={inputRef}
                type="text"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && folderPath.trim()) {
                    addFolder(folderPath);
                  }
                }}
                placeholder="/path/to/your/folder"
                className="glass-surface h-14 flex-1 rounded-2xl px-5 text-lg text-[var(--ink)] outline-none placeholder:text-[rgba(36,49,38,0.42)]"
              />
              <button
                type="button"
                onClick={() => addFolder(folderPath)}
                className="glass-surface flex h-14 items-center justify-center gap-2 rounded-2xl px-6 text-lg text-[var(--text-main)]"
              >
                <Plus className="h-5 w-5" />
                Add
              </button>
            </div>
          </div>

          {folders.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {folders.map((folder) => (
                <div
                  key={folder}
                  className="glass-surface rounded-xl px-3 py-2 text-sm text-white/90"
                  title={folder}
                >
                  {folder}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <div className="mt-10 flex items-center justify-end gap-5 text-[1rem] text-[var(--text-soft)]">
            <button type="button" className="transition hover:text-white">
              Skip for Now
            </button>
            <span className="text-white/36">|</span>
            <button type="button" className="transition hover:text-white">
              Configure Later
            </button>
            <button
              type="button"
              onClick={handleContinue}
              disabled={isLoading}
              className="rounded-2xl bg-[rgba(168,255,221,0.96)] px-7 py-3 text-lg font-semibold text-[var(--ink)] shadow-[0_0_22px_rgba(155,255,215,0.42)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Starting..." : "Continue"}
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
