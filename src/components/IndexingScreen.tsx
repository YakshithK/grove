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
      } catch (e) {
        console.error("Failed to fetch status:", e);
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
    } catch (e) {
      console.error("Failed to stop:", e);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="vish-bg" aria-hidden="true" />

      <div className="animate-fade-in-up relative z-10 flex flex-col items-center w-full max-w-xl">
        <div className="glass-strong rounded-[2.2rem] p-8 w-full">
          <div className="flex items-start justify-between gap-6 mb-6">
            <div className="flex items-center gap-3">
              <VishLogo size={22} />
              <div>
                <p className="text-xs font-mono tracking-[0.28em] text-frost/35 uppercase">
                  indexing
                </p>
                <h2 className="text-lg font-semibold text-frost/90">
                  Mapping roots into vectors
                </h2>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-frost/55 font-mono">{progress}%</p>
              <p className="text-[11px] text-frost/30 font-mono mt-1">
                {status.files_done.toLocaleString()} / {status.files_total.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="glass-card rounded-[1.6rem] p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-mono text-frost/35 uppercase tracking-[0.18em]">
                signal
              </p>
              <p className="text-xs font-mono text-frost/25">
                cosine scan
              </p>
            </div>
            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, rgba(145, 249, 229, 0.95), rgba(95, 221, 157, 0.65))",
                  boxShadow: "0 0 18px rgba(145, 249, 229, 0.18)",
                }}
              />
            </div>
            {status.eta_secs && status.eta_secs > 0 && (
              <p className="mt-3 text-[11px] text-frost/25 font-mono">
                ~{Math.ceil(status.eta_secs / 60)} min remaining
              </p>
            )}
          </div>

          <div className="flex items-center justify-end mt-6">
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 text-sm text-frost/40 hover:text-destructive transition-colors rounded-xl glass border border-transparent hover:border-destructive/20"
            >
              <XCircle className="w-4 h-4" />
              cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
