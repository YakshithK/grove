import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface IndexerStatus {
  status: "idle" | "running" | "paused";
  files_done: number;
  files_total: number;
  eta_secs?: number;
}

export function useIndexerStatus() {
  const [status, setStatus] = useState<IndexerStatus>({
    status: "idle",
    files_done: 0,
    files_total: 0,
  });

  const fetchStatus = async () => {
    try {
      const res: IndexerStatus = await invoke("get_indexer_status");
      setStatus(res);
    } catch (e) {
      console.error("Failed to fetch indexer status", e);
    }
  };

  useEffect(() => {
    // Poll indexer status every 2 seconds roughly.
    // Real implementation would subscribe to Tauri events instead of polling for performance.
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const startIndexing = async (folders: string[]) => {
    await invoke("start_indexing", { folders });
    fetchStatus();
  };

  const pauseIndexing = async () => {
    await invoke("pause_indexing");
    fetchStatus();
  };

  const resumeIndexing = async () => {
    await invoke("resume_indexing");
    fetchStatus();
  };

  const stopIndexing = async () => {
    await invoke("stop_indexing");
    fetchStatus();
  };

  return {
    ...status,
    startIndexing,
    pauseIndexing,
    resumeIndexing,
    stopIndexing,
    refreshStatus: fetchStatus,
  };
}
