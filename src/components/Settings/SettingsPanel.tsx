import { useState } from "react";
import { Settings, Database, Brain, RefreshCw } from "lucide-react";
import { VishLogo } from "../VishLogo";

interface SettingsPanelProps {
  onClose?: () => void;
  onReindex: () => void;
}

type SettingsTab = "general" | "index" | "neural";

export function SettingsPanel({ onReindex }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("index");
  const [deepScan, setDeepScan] = useState(true);
  const [isRescanning, setIsRescanning] = useState(false);

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "General", icon: <Settings className="w-4 h-4" /> },
    { id: "index", label: "Index", icon: <Database className="w-4 h-4" /> },
    { id: "neural", label: "Neural Stats", icon: <Brain className="w-4 h-4" /> },
  ];

  const handleRescan = async () => {
    try {
      setIsRescanning(true);
      onReindex();
    } catch (e) {
      console.error("Failed to re-scan:", e);
    } finally {
      setIsRescanning(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col animate-fade-in overflow-hidden">
      {/* Minimal top strip */}
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <VishLogo size={22} />
          <div>
            <p className="text-xs font-mono tracking-[0.28em] text-frost/35 uppercase">vish</p>
            <p className="text-sm font-semibold text-frost/85">settings</p>
          </div>
        </div>
        <div className="text-xs font-mono text-frost/25 tracking-[0.12em]">
          local only
        </div>
      </div>

      <div className="flex flex-1 gap-4 px-6 pb-6 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-36 shrink-0 flex flex-col gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`sidebar-item flex items-center gap-2.5 ${
                activeTab === tab.id ? "active" : ""
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {activeTab === "general" && <GeneralTab />}
          {activeTab === "index" && (
            <IndexTab
              deepScan={deepScan}
              onDeepScanToggle={() => setDeepScan(!deepScan)}
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

/* ===== Tab Content Components ===== */

function GeneralTab() {
  return (
    <div className="glass-card rounded-2xl p-5 animate-slide-in-left">
      <h3 className="text-base font-semibold text-frost/90 mb-4">General</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-2 text-frost/35 uppercase tracking-wider">
            Gemini embeddings
          </label>
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-primary/12 bg-primary/5 text-sm">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-frost/60">API key handled in backend</span>
          </div>
          <p className="text-[11px] text-frost/25 mt-2">
            Vish sends only what it needs to embed. Your files remain local.
          </p>
        </div>
      </div>
    </div>
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
    <div className="space-y-4">
      {/* Index Management */}
      <div className="glass-card rounded-2xl p-5 animate-slide-in-left">
        <h3 className="text-base font-semibold text-frost mb-4">Index Management</h3>
        <div className="flex items-start justify-between gap-4">
          <div>
            <button
              onClick={onRescan}
              disabled={isRescanning}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm glass-strong border border-primary/20 hover:border-primary/35 transition-all disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 ${isRescanning ? "animate-spin" : ""}`} />
                Re-scan Index
              </span>
            </button>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs text-frost/50">Deep Scan (OCR for Images)</span>
              <button
                onClick={onDeepScanToggle}
                className={`toggle-switch ${deepScan ? "active" : ""}`}
                aria-label="Toggle Deep Scan"
              />
            </div>
            <p className="text-[10px] text-frost/25 max-w-[200px]">
              Deep Scan analyzes text within images and PDFs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NeuralStatsTab() {
  return (
    <div className="glass-card rounded-2xl p-5 animate-slide-in-left">
      <h3 className="text-base font-semibold text-frost/90 mb-1">Neural Stats</h3>
      <p className="text-xs text-frost/25 mb-4">Stylized signal (UI placeholder)</p>

      {/* Neural network visualization (stylized) */}
      <div className="relative w-full h-40 rounded-xl bg-primary/5 border border-primary/12 overflow-hidden mb-4">
        {/* Animated dots representing neural nodes */}
        <svg className="w-full h-full" viewBox="0 0 400 160">
          {/* Connection lines */}
          {[...Array(12)].map((_, i) => {
            const x1 = 30 + (i % 4) * 100;
            const y1 = 30 + Math.floor(i / 4) * 50;
            const x2 = 70 + ((i + 1) % 4) * 100;
            const y2 = 50 + Math.floor((i + 2) / 4) * 40;
            return (
              <line
                key={`line-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(145, 249, 229, 0.10)"
                strokeWidth="1"
              />
            );
          })}
          {/* Nodes */}
          {[...Array(15)].map((_, i) => {
            const cx = 20 + (i % 5) * 80 + Math.random() * 20;
            const cy = 20 + Math.floor(i / 5) * 50 + Math.random() * 15;
            const r = 2 + Math.random() * 3;
            const isCyan = i % 3 !== 0;
            return (
              <circle
                key={`node-${i}`}
                cx={cx}
                cy={cy}
                r={r}
                fill={isCyan ? "rgba(145, 249, 229, 0.35)" : "rgba(95, 221, 157, 0.35)"}
                className="animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            );
          })}
        </svg>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-end gap-6">
        <div className="text-right">
          <p className="text-2xl font-bold gradient-text">14,203</p>
          <p className="text-[10px] text-frost/30 uppercase tracking-wider">
            concepts mapped
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-frost/60">
            Embeddings created:{" "}
            <span className="text-frost/90 font-bold">184,512</span>
          </p>
        </div>
      </div>
    </div>
  );
}
