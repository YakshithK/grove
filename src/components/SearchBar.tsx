import { useState, FormEvent } from "react";
import { SearchIcon, Loader2 } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <div className="w-full p-6 pb-2 sticky top-0 bg-background/80 backdrop-blur-xl z-10 border-b">
      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <SearchIcon className="w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Semantic Search... e.g. 'find my taxes invoice from last year'"
          className="w-full pl-12 pr-12 py-4 rounded-2xl border-2 border-border/50 bg-card/50 text-foreground 
                   placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-4 
                   focus:ring-primary/20 transition-all text-lg shadow-sm"
        />
        {isLoading && (
          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        )}
      </form>
    </div>
  );
}
