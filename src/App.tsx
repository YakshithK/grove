import { useState } from "react";
import { Loader2, Settings } from "lucide-react";
import { SetupScreen } from "./components/SetupScreen";
import { IndexingScreen } from "./components/IndexingScreen";
import { SearchBar } from "./components/SearchBar";
import { ResultList } from "./components/ResultList";
import { SettingsPanel } from "./components/Settings/SettingsPanel";
import { VishLogo } from "./components/VishLogo";
import { useSearch } from "./hooks/useSearch";
import { useAppState } from "./hooks/useAppState";
import "./App.css";

function App() {
  const { screen, setScreen } = useAppState();
  const { results, isSearching, error, search, query, setQuery } = useSearch();
  const [showSettings, setShowSettings] = useState(false);

  const hasResults = results.length > 0;
  const searchView = screen === "search";

  return (
    <main className="forest-app flex min-h-screen items-center justify-center px-4 py-6 md:px-6 md:py-8">
      <div className="backdrop-orb" aria-hidden="true" />

      {screen === "loading" && (
        <div className="relative z-10 flex flex-col items-center gap-5 animate-fade-in">
          <VishLogo size={62} glowing />
          <Loader2 className="h-6 w-6 animate-spin text-white/80" />
          <p className="mono-ui text-sm tracking-[0.22em] text-[var(--text-soft)] uppercase">
            loading index
          </p>
        </div>
      )}

      {screen === "setup" && (
        <SetupScreen onStartIndexing={() => setScreen("indexing")} />
      )}

      {screen === "indexing" && (
        <IndexingScreen
          onComplete={() => setScreen("search")}
          onCancel={() => setScreen("setup")}
        />
      )}

      {searchView && !showSettings && !hasResults && !isSearching && (
        <section className="relative z-10 flex min-h-[78vh] w-full flex-col">
          <div className="flex items-start justify-between px-2 pt-1 md:px-4">
            <div className="text-[2rem] font-light uppercase tracking-tight text-[var(--text-main)]">
              VISH
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="glass-surface flex h-11 w-11 items-center justify-center rounded-2xl text-white/85 transition hover:text-white"
              aria-label="Open settings"
            >
              <Settings className="h-[18px] w-[18px]" />
            </button>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <SearchBar
              onSearch={search}
              isLoading={isSearching}
              value={query}
              onValueChange={setQuery}
              variant="hero"
            />
          </div>
        </section>
      )}

      {searchView && !showSettings && (hasResults || isSearching) && (
        <section className="window-shell animate-fade-in">
          <div className="window-titlebar">
            <div className="traffic-lights traffic-lights-results" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="text-[1.05rem] font-medium tracking-tight">
              Vish Search Results
            </div>
            <div className="ml-auto">
              <button
                onClick={() => setShowSettings(true)}
                className="rounded-xl px-3 py-1.5 text-sm text-black/65 transition hover:bg-white/20 hover:text-black"
                aria-label="Open settings"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="window-panel flex flex-col gap-4 p-4 md:p-6">
            <SearchBar
              onSearch={search}
              isLoading={isSearching}
              value={query}
              onValueChange={setQuery}
              variant="window"
            />

            {error && (
              <div className="rounded-2xl border border-red-200/35 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}

            <ResultList results={results} />
          </div>
        </section>
      )}

      {searchView && showSettings && (
        <section className="window-shell animate-fade-in">
          <div className="window-titlebar">
            <div className="traffic-lights" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="text-[1.05rem] font-medium tracking-tight">Vish</div>
          </div>
          <div className="window-panel min-h-[680px]">
            <SettingsPanel
              onClose={() => setShowSettings(false)}
              onReindex={() => {
                setShowSettings(false);
                setScreen("setup");
              }}
            />
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
