import { useEffect, useState } from "react";
import { Loader2, Settings } from "lucide-react";
import { SetupScreen } from "./components/SetupScreen";
import { IndexingScreen } from "./components/IndexingScreen";
import { SearchBar } from "./components/SearchBar";
import { ResultList } from "./components/ResultList";
import { SettingsPanel } from "./components/Settings/SettingsPanel";
import { GroveLogo } from "./components/GroveLogo";
import { PreviewPane } from "./components/PreviewPane";
import { useSearch, type SearchResult } from "./hooks/useSearch";
import { useAppState } from "./hooks/useAppState";
import "./App.css";

const SEARCH_SUGGESTIONS = [
  "meeting notes",
  "project proposals",
  "screenshots with errors",
  "contracts or agreements",
  "code about authentication",
];

function App() {
  const { screen, setScreen } = useAppState();
  const { results, isSearching, error, search, query, setQuery } = useSearch();
  const [showSettings, setShowSettings] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [isPreviewOverlayOpen, setIsPreviewOverlayOpen] = useState(false);
  const [isCompactPreview, setIsCompactPreview] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1100 : false
  );

  const handleSearch = (q: string) => {
    setHasSubmitted(true);
    search(q);
  };

  const handleSelectResult = (result: SearchResult) => {
    if (selectedResult?.path === result.path) {
      if (isCompactPreview) {
        setIsPreviewOverlayOpen(true);
      }
      return;
    }
    setSelectedResult(result);
    if (isCompactPreview) {
      setIsPreviewOverlayOpen(true);
    }
  };

  const closePreviewOverlay = () => setIsPreviewOverlayOpen(false);

  const showResults = screen === "search" && hasSubmitted;
  const showHero = screen === "search" && !hasSubmitted;
  const isSetupView = screen === "setup" || screen === "indexing";

  useEffect(() => {
    const onResize = () => setIsCompactPreview(window.innerWidth < 1100);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (results.length === 0) {
      setSelectedResult(null);
      setIsPreviewOverlayOpen(false);
      return;
    }

    setSelectedResult((current) => {
      if (current) {
        const stillPresent = results.find((result) => result.path === current.path);
        if (stillPresent) return stillPresent;
      }
      return results[0];
    });
  }, [results]);

  useEffect(() => {
    if (!isCompactPreview) {
      setIsPreviewOverlayOpen(false);
    }
  }, [isCompactPreview]);

  return (
    <main
      className={`forest-app ${
        showResults
          ? "flex h-screen flex-col overflow-hidden"
          : isSetupView
          ? "flex h-screen items-center justify-center px-2 py-2 md:px-3 md:py-3"
          : "flex h-screen items-center justify-center overflow-hidden px-4 py-4 md:px-6 md:py-6"
      }`}
    >
      {/* Loading */}
      {screen === "loading" && (
        <div className="relative z-10 flex flex-col items-center gap-5 animate-fade-in">
          <GroveLogo size={62} glowing />
          <Loader2 className="h-6 w-6 animate-spin text-white/80" />
          <p className="mono-ui text-sm tracking-[0.22em] text-[var(--text-soft)] uppercase">
            loading index
          </p>
        </div>
      )}

      {/* Setup */}
      {screen === "setup" && (
        <SetupScreen onStartIndexing={() => setScreen("indexing")} />
      )}

      {/* Indexing */}
      {screen === "indexing" && (
        <IndexingScreen
          onComplete={() => setScreen("search")}
          onCancel={() => setScreen("setup")}
        />
      )}

      {/* Search Hero — centered command-palette layout */}
      {showHero && (
        <section className="relative z-10 flex h-full w-full flex-col items-center justify-center">
          {/* Ambient glow — behind siblings via DOM order */}
          <div className="hero-ambient-glow" aria-hidden="true" />

          {/* Logo + wordmark */}
          <div className="animate-fade-in flex flex-col items-center gap-3 mb-8">
            <GroveLogo size={52} glowing />
            <span
              className="inter-ui uppercase"
              style={{ fontSize: "0.72rem", letterSpacing: "0.5em", color: "var(--text-dim)", fontWeight: 300 }}
            >
              grove
            </span>
          </div>

          {/* Search bar */}
          <div
            className="animate-fade-in w-full"
            style={{ animationDelay: "80ms" }}
          >
            <SearchBar
              onSearch={handleSearch}
              isLoading={isSearching}
              value={query}
              onValueChange={setQuery}
              variant="hero"
            />
          </div>

          {/* Hint text */}
          <p
            className="mono-ui animate-fade-in mt-5"
            style={{ fontSize: "0.72rem", color: "var(--text-dim)", letterSpacing: "0.04em", animationDelay: "160ms" }}
          >
            ↵ search · files indexed locally
          </p>

          {/* Suggestion chips */}
          <div
            className="animate-fade-in hero-suggestions"
            style={{ animationDelay: "240ms" }}
          >
            {SEARCH_SUGGESTIONS.map((s) => (
              <button
                key={s}
                className="hero-suggestion-chip"
                type="button"
                aria-label={`Search for "${s}"`}
                onClick={() => handleSearch(s)}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Settings gear — bottom-right */}
          <button
            onClick={() => setShowSettings(true)}
            className="glass-surface absolute bottom-6 right-6 flex items-center justify-center rounded-xl text-white/60 transition hover:text-white/90"
            style={{ width: 38, height: 38 }}
            aria-label="Open settings"
          >
            <Settings style={{ width: 16, height: 16 }} />
          </button>
        </section>
      )}

      {/* Search Results — full-screen list layout */}
      {showResults && (
        <>
          {/* Top bar */}
          <div className="grove-topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <GroveLogo size={22} />
              <span
                className="mono-ui uppercase"
                style={{ fontSize: "0.7rem", letterSpacing: "0.3em", color: "var(--text-dim)" }}
              >
                grove
              </span>
            </div>

            <div style={{ flex: 1, maxWidth: 580, margin: "0 20px" }}>
              <SearchBar
                onSearch={handleSearch}
                isLoading={isSearching}
                value={query}
                onValueChange={setQuery}
                variant="window"
              />
            </div>

            <button
              onClick={() => setShowSettings(true)}
              className="glass-surface flex items-center justify-center rounded-xl text-white/70 transition hover:text-white"
              style={{ width: 36, height: 36, flexShrink: 0 }}
              aria-label="Open settings"
            >
              <Settings style={{ width: 15, height: 15 }} />
            </button>
          </div>

          {/* Meta row — slim count, no border */}
          <div
            style={{
              padding: "4px 18px 8px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span
              className="mono-ui"
              style={{ fontSize: "0.68rem", color: "var(--text-dim)" }}
            >
              {isSearching ? "searching…" : `${results.length} results`}
            </span>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{ padding: "8px 24px" }}
            >
              <div className="rounded-2xl border border-red-200/35 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            </div>
          )}

          {/* Results list */}
          <div className="search-results-layout">
            <div className="results-scroll" style={{ overflowY: "auto", padding: "0 0 24px" }}>
              <ResultList
                results={results}
                query={query}
                selectedPath={selectedResult?.path ?? null}
                onSelect={handleSelectResult}
              />
            </div>

            {!isCompactPreview && (
              <PreviewPane result={selectedResult} />
            )}
          </div>

          {isCompactPreview && isPreviewOverlayOpen && (
            <div className="preview-overlay-backdrop" onClick={closePreviewOverlay}>
              <div onClick={(e) => e.stopPropagation()}>
                <PreviewPane result={selectedResult} onClose={closePreviewOverlay} isOverlay />
              </div>
            </div>
          )}
        </>
      )}

      {/* Settings panel — accessible from search screen */}
      {screen === "search" && showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onReindex={() => {
            setShowSettings(false);
            setHasSubmitted(false);
            setScreen("setup");
          }}
        />
      )}
    </main>
  );
}

export default App;
