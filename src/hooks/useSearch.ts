import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface SearchResult {
  chunk_id: string;
  file_id: string;
  path: string;
  file_type: string;
  text_excerpt?: string;
  thumbnail_path?: string;
  score: number;
  rank: number;
}

export function useSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    const trimmed = query.trim();
    setQuery(query);

    if (!trimmed) {
      setResults([]);
      return;
    }

    try {
      setIsSearching(true);
      setError(null);
      
      const res: SearchResult[] = await invoke("search", {
        query: trimmed,
        filters: null, // Stubbed out filters for v1. Can add UI binding later.
      });

      setResults(res);
    } catch (e: any) {
      console.error("Search failed:", e);
      setError(e.toString());
    } finally {
      setIsSearching(false);
    }
  }, []);

  return {
    query,
    setQuery,
    results,
    isSearching,
    error,
    search,
  };
}
