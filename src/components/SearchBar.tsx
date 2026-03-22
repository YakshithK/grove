import { FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { VishLogo } from "./VishLogo";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  value: string;
  onValueChange: (query: string) => void;
  variant?: "hero" | "window";
}

export function SearchBar({
  onSearch,
  isLoading,
  value,
  onValueChange,
  variant = "hero",
}: SearchBarProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSearch(value.trim());
    }
  };

  const isHero = variant === "hero";

  return (
    <div className={`${isHero ? "forest-search-shell" : "w-full"} mx-auto`}>
      <form onSubmit={handleSubmit}>
        <label
          className={`forest-search-input flex items-center gap-4 ${
            isHero ? "px-6 py-6 md:px-8 md:py-7" : "px-5 py-4 md:px-6 md:py-5"
          }`}
        >
          <span className="shrink-0">
            <VishLogo size={isHero ? 44 : 32} glowing={isHero} />
          </span>

          <input
            type="text"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder="Ask Vish anything..."
            className={`min-w-0 flex-1 bg-transparent font-medium text-white outline-none placeholder:text-white/90 ${
              isHero ? "mono-ui text-3xl md:text-[3.1rem]" : "mono-ui text-xl md:text-[1.75rem]"
            }`}
            autoFocus
          />

          <span className={`type-cursor ${isLoading ? "hidden" : ""}`} aria-hidden="true" />

          {isLoading && (
            <Loader2 className="h-6 w-6 shrink-0 animate-spin text-[var(--text-main)]" />
          )}
        </label>
      </form>
    </div>
  );
}
