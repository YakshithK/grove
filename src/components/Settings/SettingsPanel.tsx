import { useState } from "react";
import { Settings, Database, Brain, Palette, RefreshCw } from "lucide-react";
import { VishLogo } from "../VishLogo";

interface SettingsPanelProps {
  onClose?: () => void;
  onReindex: () => void;
}

type SettingsTab = "general" | "index" | "neural" | "appearance";

export function SettingsPanel({ onReindex }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("index");
  const [deepScan, setDeepScan] = useState(true);
  const [isRescanning, setIsRescanning] = useState(false);

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "General", icon: <Settings className="w-4 h-4" /> },
    { id: "index", label: "Index", icon: <Database className="w-4 h-4" /> },
    { id: "neural", label: "Neural Stats", icon: <Brain className="w-4 h-4" /> },
    { id: "appearance", label: "Appearance", icon: <Palette className="w-4 h-4" /> },
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
      {/* Title bar */}
      <div className="px-6 py-3 glass-strong rounded-xl mx-6 mt-2 mb-4 flex items-center gap-3">
        <VishLogo size={20} />
        <h2 className="text-sm font-semibold text-frost/80 tracking-wide">
          The Tackle Box (Settings)
        </h2>
      </div>

      <div className="flex flex-1 gap-4 px-6 pb-6 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-44 shrink-0 flex flex-col gap-1">
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
          {activeTab === "appearance" && <AppearanceTab />}
        </div>
      </div>
    </div>
  );
}

/* ===== Tab Content Components ===== */

function GeneralTab() {
  return (
    <div className="glass-card rounded-2xl p-5 animate-slide-in-left">
      <h3 className="text-base font-semibold text-frost mb-4">General Settings</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-2 text-frost/40 uppercase tracking-wider">
            Gemini API
          </label>
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-cyan-400/10 bg-deepsea-light/50 text-sm">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-frost/60">API key configured</span>
          </div>
          <p className="text-[11px] text-frost/25 mt-2">
            Embeddings powered by Gemini Embedding 2. All data stays local on your machine.
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
              className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-400 to-cyan-500 text-deepsea hover:from-cyan-300 hover:to-cyan-400 glow-cyan transition-all disabled:opacity-50"
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
      <h3 className="text-base font-semibold text-frost mb-1">Neural Stats</h3>
      <p className="text-xs text-frost/25 mb-4">Your knowledge graph at a glance</p>

      {/* Neural network visualization (stylized) */}
      <div className="relative w-full h-40 rounded-xl bg-deepsea-light/50 border border-cyan-400/5 overflow-hidden mb-4">
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
                stroke="rgba(0, 245, 255, 0.08)"
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
                fill={isCyan ? "rgba(0, 245, 255, 0.4)" : "rgba(112, 0, 255, 0.4)"}
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
            <span className="text-frost font-bold">184,512</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function AppearanceTab() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  return (
    <div className="glass-card rounded-2xl p-5 animate-slide-in-left">
      <h3 className="text-base font-semibold text-frost mb-4">Theme Toggle</h3>
      <div className="flex gap-4">
        {/* Deep Sea (Dark) */}
        <button
          onClick={() => setTheme("dark")}
          className={`flex-1 rounded-xl p-3 border transition-all ${
            theme === "dark"
              ? "border-cyan-400/40 glow-cyan"
              : "border-white/5 hover:border-white/10"
          }`}
        >
          <div className="w-full h-16 rounded-lg mb-2 overflow-hidden flex gap-1">
            <div className="flex-1 bg-[#0A0F14]" />
            <div className="w-8 bg-[#141D28]" />
            <div className="flex-1 bg-[#0F1620] flex flex-col gap-1 p-1">
              <div className="h-1 w-full bg-cyan-400/20 rounded" />
              <div className="h-1 w-3/4 bg-cyan-400/10 rounded" />
            </div>
          </div>
          <p className="text-xs text-frost/60 text-center font-medium">Deep Sea (Dark)</p>
        </button>

        {/* Arctic Ice (Light) */}
        <button
          onClick={() => setTheme("light")}
          className={`flex-1 rounded-xl p-3 border transition-all ${
            theme === "light"
              ? "border-cyan-400/40 glow-cyan"
              : "border-white/5 hover:border-white/10"
          }`}
        >
          <div className="w-full h-16 rounded-lg mb-2 overflow-hidden flex gap-1">
            <div className="flex-1 bg-[#E8EDF2]" />
            <div className="w-8 bg-[#D4DBE5]" />
            <div className="flex-1 bg-[#F0F4F8] flex flex-col gap-1 p-1">
              <div className="h-1 w-full bg-[#0A0F14]/10 rounded" />
              <div className="h-1 w-3/4 bg-[#0A0F14]/5 rounded" />
            </div>
          </div>
          <p className="text-xs text-frost/60 text-center font-medium">Arctic Ice (Light)</p>
        </button>
      </div>
    </div>
  );
}
