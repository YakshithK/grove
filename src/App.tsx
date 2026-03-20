import { SetupScreen } from "./components/SetupScreen";
import { IndexingScreen } from "./components/IndexingScreen";
import { SearchBar } from "./components/SearchBar";
import { ResultList } from "./components/ResultList";
import { SettingsPanel } from "./components/Settings/SettingsPanel";
import { useSearch } from "./hooks/useSearch";
import { useAppState } from "./hooks/useAppState";
import { VishLogo } from "./components/VishLogo";
import { Settings, Loader2 } from "lucide-react";
import { useState } from "react";

import "./App.css";

function App() {
  const { screen, setScreen } = useAppState();
  const { results, isSearching, error, search } = useSearch();
  const [showSettings, setShowSettings] = useState(false);

  // Loading state
  if (screen === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="vish-bg" aria-hidden="true" />
        <div className="flex flex-col items-center gap-4 animate-fade-in z-10">
          <VishLogo size={44} glowing />
          <Loader2 className="w-5 h-5 text-accent/70 animate-spin" />
          <p className="text-xs text-frost/40 font-mono tracking-wide">
            indexing core...
          </p>
        </div>
      </div>
    );
  }

  // Setup screen
  if (screen === "setup") {
    return <SetupScreen onStartIndexing={() => setScreen("indexing")} />;
  }

  // Indexing screen
  if (screen === "indexing") {
    return (
      <IndexingScreen
        onComplete={() => setScreen("search")}
        onCancel={() => setScreen("setup")}
      />
    );
  }

  // Search screen (main app)
  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="vish-bg" aria-hidden="true" />

      {/* Header */}
      <header
        className="flex items-center justify-between px-7 py-5 z-20"
      >
        <div className="flex items-center gap-3">
          <VishLogo size={28} />
          <span className="text-sm font-semibold tracking-widest uppercase text-frost/70">
            Vish
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`glass-strong p-2 rounded-xl transition-all duration-300 ${
              showSettings
                ? "border border-accent/40"
                : "border border-transparent"
            }`}
            aria-label="Settings"
          >
            <Settings className="w-5 h-5 text-accent/80" />
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-6 mb-2 px-4 py-3 rounded-xl glass-strong border border-destructive/25 text-destructive text-sm animate-fade-in">
          {error}
        </div>
      )}

      {showSettings ? (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onReindex={() => {
            setShowSettings(false);
            setScreen("setup");
          }}
        />
      ) : (
        <div className="flex-1 flex flex-col z-10">
          {/* Search section */}
          <div
            className={`flex flex-col transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              results.length === 0 && !isSearching
                ? "flex-1 justify-center -mt-4"
                : "pt-2"
            }`}
          >
            {results.length === 0 && !isSearching && (
              <div className="text-center px-8 animate-fade-in-up">
                <p className="text-[11px] font-mono tracking-[0.25em] text-frost/35 uppercase">
                  semantic sonar
                </p>
                <h2 className="mt-3 text-3xl md:text-4xl font-semibold text-frost/85 tracking-tight">
                  find the thing you meant,
                  <span className="block text-accent/90">not the thing you typed</span>
                </h2>
                <p className="mt-4 text-frost/45 text-sm max-w-xl mx-auto leading-relaxed">
                  Drop a folder, let Vish map it, then ask in natural language.
                </p>
              </div>
            )}
            <SearchBar
              onSearch={search}
              isLoading={isSearching}
              compact={results.length > 0 || isSearching}
            />
          </div>

          {results.length > 0 && (
            <div className="animate-fade-in flex-1 overflow-hidden">
              <ResultList results={results} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}

export default App;
