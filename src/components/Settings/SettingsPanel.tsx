import { useState, type ReactNode } from "react";
import { Brain, Database, RefreshCw, Settings, X } from "lucide-react";

interface SettingsPanelProps {
  onClose?: () => void;
  onReindex: () => void;
}

type SettingsTab = "general" | "index" | "neural";

export function SettingsPanel({ onClose, onReindex }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("index");
  const [deepScan, setDeepScan] = useState(true);
  const [isRescanning, setIsRescanning] = useState(false);

  const tabs: { id: SettingsTab; label: string; icon: ReactNode }[] = [
    { id: "general", label: "General", icon: <Settings className="h-4 w-4" /> },
    { id: "index", label: "Index", icon: <Database className="h-4 w-4" /> },
    { id: "neural", label: "Neural", icon: <Brain className="h-4 w-4" /> },
  ];

  const handleRescan = async () => {
    setIsRescanning(true);
    try {
      onReindex();
    } finally {
      setIsRescanning(false);
    }
  };

  return (
    <div className="flex min-h-[680px] flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
        <div>
          <p className="mono-ui text-xs uppercase tracking-[0.24em] text-[var(--text-dim)]">
            settings
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-[var(--text-main)]">
            Configure Vish
          </h2>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="glass-surface flex h-11 w-11 items-center justify-center rounded-2xl text-[var(--text-main)]"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid flex-1 grid-cols-1 md:grid-cols-[220px_1fr]">
        <nav className="border-b border-white/10 px-4 py-4 md:border-b-0 md:border-r">
          <div className="flex gap-2 md:flex-col">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                  activeTab === tab.id
                    ? "glass-surface text-[var(--text-main)]"
                    : "text-[var(--text-soft)] hover:bg-white/5"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="p-6">
          {activeTab === "general" && <GeneralTab />}
          {activeTab === "index" && (
            <IndexTab
              deepScan={deepScan}
              onDeepScanToggle={() => setDeepScan((value) => !value)}
              onRescan={handleRescan}
              isRescanning={isRescanning}
            />
          )}
          {activeTab === "neural" && <NeuralStatsTab />}
        </div>
      </div>
    </div>
  );
}

function PanelCard({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <div className="glass-surface rounded-[1.4rem] p-6">
      <h3 className="text-xl font-semibold text-[var(--text-main)]">{title}</h3>
      {body && <p className="mt-2 max-w-xl text-[var(--text-soft)]">{body}</p>}
      {children}
    </div>
  );
}

function GeneralTab() {
  return (
    <PanelCard
      title="General"
      body="Embeddings are generated through Gemini while your indexed files remain local to this device."
    >
      <div className="mt-6 rounded-2xl bg-white/6 px-4 py-4 text-[var(--text-soft)]">
        API key resolution is handled by the backend using compile-time and runtime fallbacks.
      </div>
    </PanelCard>
  );
}

function IndexTab({
  deepScan,
  onDeepScanToggle,
  onRescan,
  isRescanning,
}: {
  deepScan: boolean;
  onDeepScanToggle: () => void;
  onRescan: () => void;
  isRescanning: boolean;
}) {
  return (
    <PanelCard
      title="Index"
      body="Rebuild the vector store or change scan behavior for future indexing runs."
    >
      <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <button
          onClick={onRescan}
          disabled={isRescanning}
          className="rounded-2xl bg-[rgba(168,255,221,0.96)] px-5 py-3 text-base font-semibold text-[var(--ink)] shadow-[0_0_22px_rgba(155,255,215,0.32)] transition hover:brightness-105 disabled:opacity-60"
        >
          <span className="flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${isRescanning ? "animate-spin" : ""}`} />
            Rebuild Index
          </span>
        </button>

        <button
          onClick={onDeepScanToggle}
          className="glass-surface flex items-center justify-between gap-6 rounded-2xl px-4 py-3 text-[var(--text-main)]"
        >
          <span>
            <span className="block font-medium">Deep Scan</span>
            <span className="text-sm text-[var(--text-dim)]">OCR images and PDFs when available</span>
          </span>
          <span
            className={`relative h-7 w-14 rounded-full transition ${
              deepScan ? "bg-[rgba(168,255,221,0.92)]" : "bg-white/20"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                deepScan ? "left-8" : "left-1"
              }`}
            />
          </span>
        </button>
      </div>
    </PanelCard>
  );
}

function NeuralStatsTab() {
  return (
    <PanelCard
      title="Neural Stats"
      body="This is still a stylized placeholder panel, but it has been aligned with the new interface."
    >
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white/6 px-4 py-5">
          <p className="mono-ui text-xs uppercase tracking-[0.22em] text-[var(--text-dim)]">
            concepts mapped
          </p>
          <p className="mt-3 text-4xl font-semibold text-[var(--text-main)]">14,203</p>
        </div>
        <div className="rounded-2xl bg-white/6 px-4 py-5">
          <p className="mono-ui text-xs uppercase tracking-[0.22em] text-[var(--text-dim)]">
            embeddings created
          </p>
          <p className="mt-3 text-4xl font-semibold text-[var(--text-main)]">184,512</p>
        </div>
      </div>
    </PanelCard>
  );
}
