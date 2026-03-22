import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { XCircle } from "lucide-react";
import { VishLogo } from "./VishLogo";

interface IndexingScreenProps {
  onComplete: () => void;
  onCancel: () => void;
}

interface IndexerStatus {
  status: string;
  files_done: number;
  files_total: number;
  eta_secs?: number;
}

export function IndexingScreen({ onComplete, onCancel }: IndexingScreenProps) {
  const [status, setStatus] = useState<IndexerStatus>({
    status: "running",
    files_done: 0,
    files_total: 0,
  });

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res: IndexerStatus = await invoke("get_indexer_status");
        setStatus(res);

        if (
          res.status === "idle" &&
          res.files_done > 0 &&
          res.files_done >= res.files_total
        ) {
          onComplete();
        }
      } catch (error) {
        console.error("Failed to fetch status:", error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [onComplete]);

  const progress =
    status.files_total > 0
      ? Math.round((status.files_done / status.files_total) * 100)
      : 0;

  const handleCancel = async () => {
    try {
      await invoke("stop_indexing");
      onCancel();
    } catch (error) {
      console.error("Failed to stop indexing:", error);
    }
  };

  return (
    <section className="window-shell animate-fade-in">
      <div className="window-titlebar">
        <div className="traffic-lights" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="text-[1.02rem] font-medium tracking-tight">Vish</div>
      </div>

      <div className="window-panel grid min-h-[680px] grid-cols-1 md:grid-cols-[370px_1fr]">
        <aside className="border-b border-white/10 px-8 py-9 md:border-b-0 md:border-r">
          <div className="max-w-[240px]">
            <h1 className="text-[3rem] font-semibold leading-[0.95] text-[var(--text-main)] md:text-[3.25rem]">
              Indexing
            </h1>
            <p className="mt-4 max-w-[240px] text-[1rem] leading-8 text-[var(--text-soft)]">
              Vish is mapping your files into semantic space.
            </p>
          </div>

          <ol className="relative mt-16 space-y-6 pl-7 text-[1.2rem] text-[var(--text-soft)]">
            <li>1. Choose Directories</li>
            <li>2. Configure Settings</li>
            <li className="sidebar-step-active relative font-medium text-[var(--text-main)]">
              <span className="mr-2">✓</span>3. Indexing
            </li>
          </ol>
        </aside>

        <section className="flex flex-col justify-center px-8 py-9 md:px-12">
          <div className="glass-surface-strong mx-auto w-full max-w-2xl rounded-[1.7rem] p-8 md:p-10">
            <div className="flex items-center gap-5">
              <VishLogo size={74} glowing />
              <div>
                <p className="mono-ui text-sm uppercase tracking-[0.24em] text-[var(--text-dim)]">
                  semantic indexing
                </p>
                <h2 className="mt-2 text-[2rem] font-semibold text-[var(--ink)]">
                  Building your local search map
                </h2>
              </div>
            </div>

            <div className="mt-10">
              <div className="mb-3 flex items-center justify-between text-[var(--ink)]">
                <span className="text-lg font-medium">{progress}% complete</span>
                <span className="mono-ui text-sm">
                  {status.files_done.toLocaleString()} / {status.files_total.toLocaleString()}
                </span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-black/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,rgba(130,255,207,0.96),rgba(181,255,229,0.98))] shadow-[0_0_18px_rgba(155,255,215,0.42)] transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <p className="mt-6 text-base leading-8 text-[rgba(36,49,38,0.78)]">
              {status.eta_secs && status.eta_secs > 0
                ? `Estimated time remaining: ${Math.ceil(status.eta_secs / 60)} minute(s).`
                : "Estimating remaining time..."}
            </p>

            <div className="mt-8 flex justify-end">
              <button
                onClick={handleCancel}
                className="glass-surface flex items-center gap-2 rounded-2xl px-5 py-3 text-[var(--ink)] transition hover:bg-white/20"
              >
                <XCircle className="h-4 w-4" />
                Cancel
              </button>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
