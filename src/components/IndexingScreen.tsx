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

  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

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
      {/* Background glow orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-400/5 blur-[120px] animate-float" />
      <div
        className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-violet-500/5 blur-[100px] animate-float"
        style={{ animationDelay: "1.5s" }}
      />

      {/* Sonar ripples in background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-60 h-60 rounded-full border border-cyan-400/5 animate-sonar" />
        <div
          className="absolute w-60 h-60 rounded-full border border-cyan-400/5 animate-sonar"
          style={{ animationDelay: "0.7s" }}
        />
        <div
          className="absolute w-60 h-60 rounded-full border border-violet-500/5 animate-sonar"
          style={{ animationDelay: "1.4s" }}
        />
      </div>

      <div className="animate-fade-in-up z-10 flex flex-col items-center">
        {/* Progress Ring */}
        <div className="relative mb-6">
          <svg
            width="160"
            height="160"
            viewBox="0 0 120 120"
            className="transform -rotate-90"
          >
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="rgba(0, 245, 255, 0.06)"
              strokeWidth="5"
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="url(#indexing-gradient)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-700 ease-out"
              filter="url(#ring-glow)"
            />
            <defs>
              <linearGradient
                id="indexing-gradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#00F5FF" />
                <stop offset="100%" stopColor="#7000FF" />
              </linearGradient>
              <filter id="ring-glow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold gradient-text">{progress}%</span>
          </div>
        </div>

        {/* Status text */}
        <div className="text-center mb-5">
          <h2 className="text-xl font-semibold text-frost mb-1">
            Mapping the deep...
          </h2>
          <p className="text-frost/40 text-sm">
            {status.files_done.toLocaleString()} of{" "}
            {status.files_total.toLocaleString()} files processed
          </p>
          {status.eta_secs && status.eta_secs > 0 && (
            <p className="text-frost/25 text-xs mt-1">
              ~{Math.ceil(status.eta_secs / 60)} min remaining
            </p>
          )}
        </div>

        {/* Progress bar (secondary) */}
        <div className="w-72 h-1 bg-white/5 rounded-full overflow-hidden mb-6">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #00F5FF, #7000FF)",
              boxShadow: "0 0 10px rgba(0, 245, 255, 0.3)",
            }}
          />
        </div>

        {/* Logo */}
        <div className="flex items-center gap-2 text-frost/25 mb-8">
          <VishLogo size={20} />
          <span className="text-xs font-medium tracking-wider uppercase">
            Vish
          </span>
        </div>

        {/* Cancel */}
        <button
          onClick={handleCancel}
          className="flex items-center gap-2 px-4 py-2 text-sm text-frost/30 hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10"
        >
          <XCircle className="w-4 h-4" />
          Cancel indexing
        </button>
      </div>
    </div>
  );
}
