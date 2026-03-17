import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export type AppScreen = "loading" | "setup" | "indexing" | "search";

export function useAppState() {
  const [screen, setScreen] = useState<AppScreen>("loading");

  const checkState = async () => {
    try {
      // Check if currently indexing
      const status: { status: string } = await invoke("get_indexer_status");

      if (status.status === "running" || status.status === "paused") {
        setScreen("indexing");
        return;
      }

      // Check if we have a persisted index on disk
      const hasIndex: boolean = await invoke("check_index_exists");

      if (hasIndex) {
        setScreen("search");
      } else {
        setScreen("setup");
      }
    } catch (e) {
      console.error("Failed to check app state:", e);
      setScreen("setup");
    }
  };

  useEffect(() => {
    checkState();
  }, []);

  return {
    screen,
    setScreen,
    refreshState: checkState,
  };
}
