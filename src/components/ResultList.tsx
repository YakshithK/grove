import { invoke } from "@tauri-apps/api/core";
import { SearchResult } from "../hooks/useSearch";
import {
  FileIcon,
  ImageIcon,
  FileTextIcon,
  FolderOpen,
  VideoIcon,
  CodeIcon,
  ExternalLink,
  FileSpreadsheetIcon,
} from "lucide-react";
import { useState } from "react";

interface ResultListProps {
  results: SearchResult[];
}

// File type icon with colored background
function FileTypeBadge({ type }: { type: string }) {
  const config = getFileTypeConfig(type);
  return (
    <div
      className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: config.bg }}
    >
      <config.icon className="w-6 h-6" style={{ color: config.color }} />
      <span
        className="absolute text-[8px] font-black tracking-wider uppercase mt-9"
        style={{ color: config.color }}
      >
        {config.label}
      </span>
    </div>
  );
}

function getFileTypeConfig(type: string) {
  const t = type.toLowerCase();
  switch (t) {
    case "pdf":
      return {
        icon: FileTextIcon,
        color: "#FF6B6B",
        bg: "rgba(255, 107, 107, 0.12)",
        label: "PDF",
      };
    case "docx":
    case "doc":
      return {
        icon: FileSpreadsheetIcon,
        color: "#4A9EFF",
        bg: "rgba(74, 158, 255, 0.12)",
        label: "DOCX",
      };
    case "txt":
    case "md":
      return {
        icon: FileTextIcon,
        color: "#80FFEA",
        bg: "rgba(128, 255, 234, 0.12)",
        label: t.toUpperCase(),
      };
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":
      return {
        icon: ImageIcon,
        color: "#7CFF7C",
        bg: "rgba(124, 255, 124, 0.12)",
        label: t.toUpperCase(),
      };
    case "rs":
    case "js":
    case "ts":
    case "py":
    case "tsx":
    case "jsx":
    case "go":
    case "c":
    case "cpp":
    case "java":
      return {
        icon: CodeIcon,
        color: "#00F5FF",
        bg: "rgba(0, 245, 255, 0.12)",
        label: `</${">"}`,
      };
    case "mp4":
    case "mov":
      return {
        icon: VideoIcon,
        color: "#C880FF",
        bg: "rgba(200, 128, 255, 0.12)",
        label: t.toUpperCase(),
      };
    default:
      return {
        icon: FileIcon,
        color: "#A0A8B4",
        bg: "rgba(160, 168, 180, 0.08)",
        label: t.toUpperCase(),
      };
  }
}

export function ResultList({ results }: ResultListProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-frost/40 animate-fade-in">
        <p>No results found. Try a different query.</p>
      </div>
    );
  }

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
  const uniqueResults = Array.from(seen.values()).sort(
    (a, b) => b.score - a.score
  );

  const selectedResult =
    selectedIdx !== null ? uniqueResults[selectedIdx] : null;

  return (
    <div className="flex gap-4 px-6 py-3 w-full max-w-5xl mx-auto">
      {/* Result cards */}
      <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto min-w-0">
        <p className="text-xs text-frost/30 mb-1">
          {uniqueResults.length} result{uniqueResults.length !== 1 ? "s" : ""}
        </p>
        {uniqueResults.map((result, idx) => {
          const relevance = (result.score * 100).toFixed(0);
          const fileName =
            result.path.split("/").pop() || result.path.split("\\").pop();
          const isSelected = selectedIdx === idx;

          return (
            <div
              key={`${result.path}-${idx}`}
              className={`relative flex items-start gap-4 p-4 rounded-2xl glass-card cursor-pointer group animate-fade-in transition-all duration-200
                         ${isSelected ? "border-cyan-400/30 glow-cyan" : ""}`}
              style={{ animationDelay: `${idx * 50}ms` }}
              onClick={() => handleOpen(result.path)}
              onMouseEnter={() => setSelectedIdx(idx)}
            >
              {/* Left glow bar */}
              <div
                className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full transition-all duration-300"
                style={{
                  background: isSelected
                    ? "linear-gradient(to bottom, #00F5FF, #7000FF)"
                    : "transparent",
                }}
              />

              {/* File type badge */}
              <div className="relative">
                <FileTypeBadge type={result.file_type} />
              </div>

              {/* Center: filename + snippet */}
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-sm text-frost truncate">
                  {fileName}
                </h3>
                {result.text_excerpt && (
                  <>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/60 mt-1 block">
                      Semantic Snippet
                    </span>
                    <p className="text-xs text-frost/50 mt-0.5 line-clamp-2 leading-relaxed">
                      {result.text_excerpt.substring(0, 200)}
                    </p>
                  </>
                )}
              </div>

              {/* Right: metadata */}
              <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                <span className="text-xs font-mono text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded-full">
                  Relevance: {relevance}%
                </span>
                <div className="flex items-center gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReveal(result.path);
                    }}
                    className="p-1.5 hover:bg-white/5 rounded-lg transition-all"
                    title="Reveal in Explorer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-frost/40" />
                  </button>
                  <div className="p-1.5">
                    <ExternalLink className="w-3.5 h-3.5 text-frost/40" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Look preview panel */}
      {selectedResult && (
        <div className="w-64 shrink-0 glass-card rounded-2xl p-4 animate-fade-in-scale hidden lg:block">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-400/60 mb-3">
            Quick Look
          </h4>
          <div className="w-full aspect-[4/3] rounded-xl bg-deepsea-light/50 flex items-center justify-center mb-3 border border-cyan-400/5 overflow-hidden">
            {/* Placeholder for preview */}
            <div className="text-center p-4">
              <FileTypeBadge type={selectedResult.file_type} />
            </div>
          </div>
          <p className="text-xs text-frost/70 font-medium truncate mb-1">
            {selectedResult.path.split("/").pop() ||
              selectedResult.path.split("\\").pop()}
          </p>
          <p className="text-[10px] text-frost/30 truncate" title={selectedResult.path}>
            {selectedResult.path}
          </p>
          {selectedResult.text_excerpt && (
            <p className="text-[11px] text-frost/40 mt-2 line-clamp-4 leading-relaxed">
              {selectedResult.text_excerpt.substring(0, 300)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
