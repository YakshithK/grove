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

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto">
      {results.map((result, idx) => (
        <div
          key={`${result.file_id}-${idx}`}
          className="flex flex-col gap-2 p-4 border rounded-xl bg-card hover:bg-accent/50 transition-colors shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getIcon(result.file_type)}
              <div>
                <h3 className="font-semibold text-foreground truncate max-w-[400px]">
                  {result.path.split("/").pop() || result.path.split("\\").pop()}
                </h3>
                <p className="text-xs text-muted-foreground truncate max-w-[400px]" title={result.path}>
                  {result.path}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded-full">
                Score: {(result.score * 100).toFixed(1)}%
              </span>
              <button
                onClick={() => handleReveal(result.path)}
                className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
                title="Reveal in Explorer"
              >
                <LinkIcon className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          
          {result.text_excerpt && (
            <div className="mt-2 text-sm text-muted-foreground line-clamp-3 bg-black/5 dark:bg-white/5 p-3 rounded-lg border-l-4 border-primary">
              {result.text_excerpt}
            </div>
          )}
          
          <button
            onClick={() => handleOpen(result.path)}
            className="mt-2 w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Open File
          </button>
        </div>
      ))}
    </div>
  );
}
