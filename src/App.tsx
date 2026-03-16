import { useState, useRef } from "react";
import { SearchBar } from "./components/SearchBar";
import { ResultList } from "./components/ResultList";
import { useSearch } from "./hooks/useSearch";
import { useIndexerStatus } from "./hooks/useIndexerStatus";
import { DatabaseIcon, SettingsIcon, PlayIcon, PauseIcon } from "lucide-react";

function App() {
  const { results, isSearching, error, search } = useSearch();
  const { status, files_done, files_total, startIndexing, pauseIndexing } = useIndexerStatus();
  const [showSettings, setShowSettings] = useState(false);

  const progress = files_total > 0 ? (files_done / files_total) * 100 : 0;
  
  const pathInputRef = useRef<HTMLInputElement>(null);

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <header className="flex flex-col gap-4 px-6 py-4 border-b bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <DatabaseIcon className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">SenseDesk</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Indexer Status Bar */}
            <div className="flex items-center gap-3 bg-secondary px-4 py-2 rounded-lg">
               <div className="flex flex-col flex-1 min-w-[200px]">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium capitalize text-muted-foreground">{status}</span>
                  <span className="text-muted-foreground">{files_done} / {files_total}</span>
                </div>
                <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              
               <button
                  onClick={() => {
                      if (status === 'running') {
                          pauseIndexing();
                      } else {
                          const val = pathInputRef.current?.value;
                          if (val && val.trim().length > 0) {
                              startIndexing([val.trim()]);
                          } else {
                              alert("Please enter a valid directory path to index.");
                          }
                      }
                  }}
                  className="p-1.5 hover:bg-background rounded-md transition-colors"
                  title={status === 'running' ? "Pause Indexing" : "Start Indexing"}
                >
                  {status === 'running' ? 
                    <PauseIcon className="w-4 h-4 text-foreground" /> : 
                    <PlayIcon className="w-4 h-4 text-foreground" />
                  }
                </button>
            </div>

            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Workspace Path Input */}
        <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Workspace:</span>
            <input 
                ref={pathInputRef}
                type="text" 
                defaultValue="/home/yakshith/sensedesk"
                placeholder="e.g. /home/user/documents" 
                className="flex-1 max-w-md px-3 py-1.5 text-sm rounded border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none text-foreground placeholder-muted-foreground"
            />
        </div>
      </header>

      {error && (
        <div className="bg-destructive/10 text-destructive px-6 py-3 text-sm border-b border-destructive/20">
          Error: {error}
        </div>
      )}

      {showSettings ? (
        <div className="flex-1 p-6">
          <h2 className="text-2xl font-bold mb-6">Settings</h2>
          <div className="max-w-2xl bg-card border rounded-xl p-6 shadow-sm">
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium mb-2">Gemini API Key</label>
                  <input 
                    type="password" 
                    placeholder="AIzaSy..." 
                    className="w-full px-4 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Used securely for generating embeddings via Gemini API. Never shared or stored remotely.
                  </p>
               </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <SearchBar onSearch={search} isLoading={isSearching} />
          
          {results.length === 0 && !isSearching && !error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-50">
              <DatabaseIcon className="w-16 h-16 mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Ready to Search</h2>
              <p className="text-muted-foreground max-w-sm">
                Enter a query above to search through your indexed files and snippets using semantic meaning.
              </p>
            </div>
          ) : (
             <ResultList results={results} />
          )}
        </div>
      )}
    </main>
  );
}

export default App;
