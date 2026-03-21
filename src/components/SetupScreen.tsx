import { useState, useRef, DragEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowRight, FolderOpen, Check, X } from "lucide-react";
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

  const removeFolder = (path: string) => {
    setFolders((prev) => prev.filter((f) => f !== path));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && folderPath.trim()) {
      addFolder(folderPath);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const items = e.dataTransfer.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            addFolder((file as any).path || file.name);
          }
        }
      }
    }
  };

  const handleContinue = async () => {
    if (folders.length === 0) {
      setError("Please add at least one folder to index.");
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await invoke("start_indexing", { folders });
      onStartIndexing();
    } catch (e: any) {
      setError(e.toString());
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="vish-bg" aria-hidden="true" />

      <div className="animate-fade-in-up relative z-10 flex flex-col items-center max-w-2xl w-full">
        <div className="w-full glass-strong rounded-[2.2rem] p-8">
          <div className="flex items-center justify-between gap-6 mb-6">
            <div className="flex items-center gap-3">
              <VishLogo size={28} glowing />
              <div>
                <p className="text-xs font-mono tracking-[0.28em] text-frost/35 uppercase">
                  setup
                </p>
                <h1 className="text-2xl font-semibold gradient-text">
                  Cast roots into Vish
                </h1>
              </div>
            </div>
            <p className="text-xs font-mono text-frost/35">
              local-first indexing
            </p>
          </div>

          {/* Drop Zone */}
          <div
            className={`w-full rounded-[1.6rem] p-6 flex items-center justify-between cursor-pointer transition-all duration-500 drop-zone ${isDragOver ? "drag-over" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.focus()}
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-secondary/10 border border-secondary/20 flex items-center justify-center shadow-inner">
                <FolderOpen className="w-6 h-6 text-gold/90" />
              </div>
              <p className="text-sm text-frost/65 font-body truncate">
                Drop folders here (or type a path below).
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-primary/80 shrink-0" />
          </div>

          {/* Manual path input */}
          <div className="w-full mt-5 relative">
            <input
              ref={inputRef}
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Directory path (e.g., /home/you/Documents)"
              className="w-full px-5 py-4 rounded-2xl border border-primary/20 bg-black/10 text-frost placeholder:text-frost/25 focus:outline-none focus:border-gold/65 focus:ring-1 focus:ring-secondary/25 transition-all text-base font-mono shadow-inner"
            />
            {folderPath.trim() && (
              <button
                onClick={() => addFolder(folderPath)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl glass-strong border border-secondary/22 hover:border-gold/40 transition-all font-bold"
                aria-label="Add folder"
              >
                <ArrowRight className="w-5 h-5 text-gold/90" />
              </button>
            )}
          </div>

          {/* Folder list */}
          {folders.length > 0 && (
            <div className="w-full mt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-mono tracking-[0.22em] text-frost/35 uppercase">
                  roots
                </p>
                <span className="text-xs text-frost/30">
                  {folders.length} selected
                </span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {folders.map((folder) => (
                  <div
                    key={folder}
                    className="group inline-flex items-center gap-2 px-3 py-2 rounded-xl glass-card border border-secondary/15"
                  >
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs text-frost/75 font-mono max-w-[320px] truncate">
                      {folder}
                    </span>
                    <button
                      onClick={() => removeFolder(folder)}
                      className="p-1 rounded-lg hover:bg-white/5 text-frost/35 hover:text-frost/60 transition-all"
                      aria-label="Remove folder"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="w-full mt-4 px-4 py-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs animate-fade-in">
              {error}
            </div>
          )}

          {/* Continue Button */}
          <div className="mt-8 flex items-center justify-end">
            <button
              onClick={handleContinue}
              disabled={isLoading || folders.length === 0}
              className="px-10 py-3 rounded-2xl font-semibold text-sm tracking-[0.22em] uppercase disabled:opacity-35 disabled:cursor-not-allowed
                         glass-strong border border-secondary/24 hover:border-gold/50 transition-all flex items-center gap-2"
            >
              {isLoading ? "initializing" : "continue"}
              {!isLoading && <ArrowRight className="w-4 h-4 text-gold/90" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
