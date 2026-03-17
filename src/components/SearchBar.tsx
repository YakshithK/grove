import { useState, FormEvent } from "react";
import { SearchIcon, Loader2, X, Settings } from "lucide-react";
import { VishLogo } from "./VishLogo";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  onSettingsClick?: () => void;
  onClose?: () => void;
  compact?: boolean;
}

export function SearchBar({
  onSearch,
  isLoading,
  onSettingsClick,
  onClose,
  compact = false,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <div className={`w-full px-6 ${compact ? "py-2" : "py-4"}`}>
      <div className="relative max-w-2xl mx-auto">
        {/* Violet glow behind bar when focused/searching */}
        <div
          className={`absolute -inset-3 rounded-3xl transition-all duration-700 pointer-events-none ${
            isFocused || isLoading
              ? "opacity-100"
              : "opacity-0"
          }`}
          style={{
            background: isLoading
              ? "radial-gradient(ellipse at center, rgba(112, 0, 255, 0.15) 0%, rgba(0, 245, 255, 0.05) 50%, transparent 80%)"
              : "radial-gradient(ellipse at center, rgba(0, 245, 255, 0.08) 0%, rgba(112, 0, 255, 0.04) 50%, transparent 80%)",
          }}
        />

        {/* Logo + action buttons above bar (non-compact mode) */}
        {!compact && (
          <div className="flex items-center justify-center mb-3 relative">
            <VishLogo size={32} glowing={isLoading} />
            {(onClose || onSettingsClick) && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {onSettingsClick && (
                  <button
                    onClick={onSettingsClick}
                    className="p-1.5 rounded-lg text-frost/30 hover:text-frost/60 hover:bg-white/5 transition-all"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                )}
                {onClose && (
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-frost/30 hover:text-frost/60 hover:bg-white/5 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* The Command Bar */}
        <form onSubmit={handleSubmit} className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
            ) : (
              <SearchIcon className="w-5 h-5 text-frost/30 group-focus-within:text-cyan-400 transition-colors duration-300" />
            )}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Ask Vish anything... 'that PDF about the marketing budget' or 'the python script for the scraper'"
            className={`w-full pl-12 pr-4 ${compact ? "py-3" : "py-4"} rounded-2xl text-frost placeholder:text-frost/30 
                       focus:outline-none transition-all duration-300 text-sm glass-strong
                       border border-cyan-400/10 focus:border-cyan-400/30
                       ${isLoading ? "border-violet-500/30" : ""}`}
            autoFocus
          />
        </form>

        {/* Perspective grid below the bar (non-compact mode) */}
        {!compact && (
          <div className="w-full h-24 mt-2 perspective-grid rounded-b-2xl opacity-40" />
        )}
      </div>
    </div>
  );
}
