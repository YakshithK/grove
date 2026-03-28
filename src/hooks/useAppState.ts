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

      // Show setup only if the user has never configured any folders.
      // Checking vectors (check_index_exists) is wrong — an empty index still
      // means the user has been through setup. Roots are the source of truth.
      const roots: string[] = await invoke("get_indexed_roots");

      if (roots.length > 0) {
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
