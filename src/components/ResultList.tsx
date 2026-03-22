import { Fragment } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  Folder,
  File as FileIcon,
} from "lucide-react";
import { SearchResult } from "../hooks/useSearch";

interface ResultListProps {
  results: SearchResult[];
}

function getFileName(path: string) {
  return path.split("/").pop() || path.split("\\").pop() || path;
}

function getTypeIcon(type: string) {
  const normalized = type.toLowerCase();

  if (normalized.includes("pdf")) {
    return FileType2;
  }
  if (normalized.includes("image") || ["png", "jpg", "jpeg", "webp"].includes(normalized)) {
    return FileImage;
  }
  if (normalized.includes("sheet") || ["xls", "xlsx", "csv"].includes(normalized)) {
    return FileSpreadsheet;
  }
  if (normalized.includes("folder")) {
    return Folder;
  }
  if (normalized.includes("text") || normalized.includes("doc")) {
    return FileText;
  }

  return FileIcon;
}

function highlightSnippet(text: string) {
  const terms = ["semantic", "match", "contains", "budget", "references", "explores", "opportunities"];
  const matcher = new RegExp(`(${terms.join("|")})`, "ig");

  return text.split(matcher).map((part, index) => {
    const isMatch = terms.some((term) => term.toLowerCase() === part.toLowerCase());
    return isMatch ? <mark key={`${part}-${index}`}>{part}</mark> : <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

export function ResultList({ results }: ResultListProps) {
  const visibleResults = results.slice(0, 6);
  const centeredSparseLayout = visibleResults.length < 3;

  const handleOpen = async (path: string) => {
    try {
      await invoke("open_file", { path });
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  };

  if (results.length === 0) {
    return (
      <div className="glass-surface flex min-h-[420px] items-center justify-center rounded-[1.35rem] px-6 text-center">
        <div>
          <p className="mono-ui text-sm uppercase tracking-[0.22em] text-[var(--text-dim)]">
            no results yet
          </p>
          <p className="mt-3 text-lg text-[var(--text-soft)]">
            Submit a query to see semantic matches across your indexed files.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        centeredSparseLayout
          ? "flex flex-col items-center gap-5 md:flex-row md:flex-wrap md:justify-center"
          : "grid grid-cols-1 gap-5 md:grid-cols-3"
      }
    >
      {visibleResults.map((result, idx) => {
        const fileName = getFileName(result.path);
        const Icon = getTypeIcon(result.file_type);
        const snippet = result.text_excerpt
          ? result.text_excerpt.trim()
          : "contains key design documents and related semantic matches...";

        return (
          <button
            type="button"
            key={`${result.path}-${idx}`}
            onClick={() => {
              handleOpen(result.path);
            }}
            className={`result-card glass-surface text-center ${
              centeredSparseLayout ? "w-full md:w-[352px]" : "w-full"
            }`}
          >
            <div className="flex h-full flex-col items-center justify-center">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-[1.1rem] bg-[rgba(161,255,218,0.12)] text-[rgba(156,255,216,0.94)] shadow-[0_0_28px_rgba(155,255,215,0.22)]"
              >
                <Icon className="h-10 w-10" strokeWidth={1.75} />
              </div>

              <div className="mt-6 flex w-full flex-col items-center">
                <h3
                  className="result-title inter-ui max-w-[240px] text-[1.15rem] font-semibold tracking-tight text-[rgba(32,42,33,0.92)]"
                  title={fileName}
                >
                  {fileName}
                </h3>

                <p className="mt-5 max-w-[300px] text-[rgba(236,242,237,0.96)]">
                  <span className="text-[rgba(236,242,237,0.86)]">semantic match: </span>
                  <span className="result-snippet-copy mono-ui">
                    {highlightSnippet(`${snippet}...`)}
                  </span>
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
