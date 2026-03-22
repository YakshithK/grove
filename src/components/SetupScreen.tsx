import { useRef, useState, DragEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus } from "lucide-react";
import { VishLogo } from "./VishLogo";

interface SetupScreenProps {
  onStartIndexing: () => void;
}

function SelectedFolders({
  folders,
  className = "",
}: {
  folders: string[];
  className?: string;
}) {
  if (folders.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <p className="inter-ui text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-main)]/88">
        Added Directories
      </p>
      <div className="setup-folder-list mt-3 flex flex-wrap gap-2 pr-1">
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
    </div>
  );
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
    <section className="window-shell setup-shell animate-fade-in">
      <div className="window-panel grid h-full grid-cols-1 overflow-hidden md:grid-cols-[clamp(260px,28vw,340px)_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/10 px-8 py-9 md:block">
          <div className="max-w-[290px]">
            <h1 className="setup-hero-title inter-ui text-[3.5rem] font-semibold leading-[0.92] text-[var(--text-main)] md:text-[4rem]">
              Initial Setup
            </h1>
            <p className="mt-5 max-w-[260px] text-[1.03rem] leading-8 text-[var(--text-soft)]">
              Choose the directories Vish should index first so search is ready as soon as setup completes.
            </p>
          </div>

          <SelectedFolders folders={folders} className="mt-8 max-w-[290px]" />
        </aside>

        <section className="setup-main-section px-5 py-5 md:px-9 md:py-10">
          <div className="setup-mobile-summary glass-surface mb-6 rounded-[1.4rem] px-5 py-4 md:hidden">
            <p className="setup-mobile-title inter-ui text-[2rem] font-semibold leading-tight text-[var(--text-main)]">
              Initial Setup
            </p>
            <p className="mt-3 max-w-[30rem] text-[0.98rem] leading-7 text-[var(--text-soft)]">
              Choose the directories Vish should index first so search can start immediately.
            </p>

            <SelectedFolders folders={folders} className="mt-5" />
          </div>

          <div className="setup-copy-column">
            <h2 className="setup-primary-heading inter-ui text-[1.9rem] font-semibold tracking-tight text-[var(--text-main)] md:text-[2.2rem]">
              Choose Directories to Index
            </h2>
            <p className="setup-primary-copy mt-3 max-w-[44rem] text-[1rem] leading-7 text-[var(--text-soft)] md:leading-8">
              Drag and drop folders into the drop zone or manually input directory paths below.
              Vish needs these locations now so indexing can start immediately.
            </p>
          </div>

          <button
            type="button"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.focus()}
            className={`setup-dropzone glass-surface-strong glow-border mt-7 flex w-full flex-col items-center justify-center rounded-[1.7rem] px-6 text-center transition md:mt-8 ${
              isDragOver ? "scale-[1.01]" : ""
            }`}
          >
            <VishLogo size={72} glowing className="setup-dropzone-logo" />
            <div className="setup-dropzone-copy mono-ui mt-6 tracking-tight text-[rgba(31,42,33,0.88)] md:mt-7">
              Drag &amp; Drop Folders Here
            </div>
          </button>

          <div className="mt-8 md:mt-9">
            <h3 className="setup-section-heading inter-ui setup-copy-column text-[1.15rem] font-semibold text-[var(--text-main)] md:text-[1.55rem]">
              Manually Input Directories (Optional)
            </h3>

            <div className="setup-input-row setup-copy-column mt-4 flex flex-col gap-3 md:flex-row">
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
                className="setup-directory-input glass-surface mono-ui h-14 flex-1 rounded-2xl px-5 text-base outline-none md:text-lg"
              />
              <button
                type="button"
                onClick={() => addFolder(folderPath)}
                className="glass-surface inter-ui flex h-14 items-center justify-center gap-2 rounded-2xl px-6 text-base font-medium text-[var(--text-main)] md:text-lg"
              >
                <Plus className="h-5 w-5" />
                Add
              </button>
            </div>
          </div>

          {error && (
            <div className="setup-copy-column mt-4 rounded-2xl border border-red-200/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <div className="setup-copy-column mt-auto flex justify-stretch pt-6 pb-8 md:justify-end md:pb-10">
            <button
              type="button"
              onClick={handleContinue}
              disabled={isLoading}
              className="inter-ui w-full rounded-2xl bg-[rgba(168,255,221,0.96)] px-7 py-3 text-lg font-semibold text-[var(--ink)] shadow-[0_0_22px_rgba(155,255,215,0.42)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
            >
              {isLoading ? "Starting..." : "Continue"}
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
