import { invoke } from "@tauri-apps/api/core";
import { SearchResult } from "../hooks/useSearch";
import { FileIcon, ImageIcon, FileTextIcon, LinkIcon, VideoIcon, CodeIcon } from "lucide-react";

interface ResultListProps {
  results: SearchResult[];
}

export function ResultList({ results }: ResultListProps) {
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
        <p>No results found. Try adjusting your query or indexing more folders.</p>
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "pdf":
      case "docx":
      case "txt":
      case "md":
        return <FileTextIcon className="w-5 h-5 text-blue-500" />;
      case "png":
      case "jpg":
      case "jpeg":
      case "webp":
        return <ImageIcon className="w-5 h-5 text-green-500" />;
      case "rs":
      case "js":
      case "ts":
      case "py":
        return <CodeIcon className="w-5 h-5 text-yellow-500" />;
      case "mp4":
      case "mov":
        return <VideoIcon className="w-5 h-5 text-purple-500" />;
      default:
        return <FileIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const handleOpen = async (path: string) => {
    try {
      await invoke("open_file", { path });
    } catch (e) {
      console.error("Failed to open file:", e);
    }
  };

  const handleReveal = async (path: string) => {
    try {
      await invoke("reveal_in_explorer", { path });
    } catch (e) {
      console.error("Failed to reveal file:", e);
    }
  };

  // Deduplicate: keep only the highest-scoring result per file path
  const seen = new Map<string, SearchResult>();
  for (const r of results) {
    const existing = seen.get(r.path);
    if (!existing || r.score > existing.score) {
      seen.set(r.path, r);
    }
  }
  const uniqueResults = Array.from(seen.values())
    .sort((a, b) => b.score - a.score);

  return (
    <div className="flex flex-col gap-3 p-4 overflow-y-auto">
      {uniqueResults.map((result, idx) => (
        <div
          key={`${result.path}-${idx}`}
          className="flex items-center justify-between gap-3 p-4 border rounded-xl bg-card hover:bg-accent/50 transition-colors shadow-sm"
        >
          <div className="flex items-center gap-3 min-w-0">
            {getIcon(result.file_type)}
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate max-w-[400px]">
                {result.path.split("/").pop() || result.path.split("\\").pop()}
              </h3>
              <p className="text-xs text-muted-foreground truncate max-w-[400px]" title={result.path}>
                {result.path}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded-full">
              {(result.score * 100).toFixed(1)}%
            </span>
            <button
              onClick={() => handleReveal(result.path)}
              className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
              title="Reveal in Explorer"
            >
              <LinkIcon className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => handleOpen(result.path)}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Open
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
