import React from 'react';
import { Menu, Search, Sparkles, X } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function Header() {
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const toggleAIPanel = useStore((s) => s.toggleAIPanel);
  const aiPanelOpen = useStore((s) => s.aiPanelOpen);

  return (
    <header className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-line/70 bg-canvas/85 px-4 py-3 backdrop-blur-md md:-mx-8 md:px-8">
      <button
        type="button"
        className="icon-btn md:hidden"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open navigation"
        aria-expanded={sidebarOpen}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search notes…"
          aria-label="Search notes"
          className="input py-2 pl-9 pr-16 text-[13px]"
        />
        <div className="pointer-events-none absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="pointer-events-auto rounded p-1 text-faint hover:text-ink"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : (
            <kbd className="kbd hidden sm:inline-block">⌘K</kbd>
          )}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          className={`icon-btn ${aiPanelOpen ? 'bg-raised text-ink' : ''}`}
          onClick={toggleAIPanel}
          aria-label="Open insights"
          aria-expanded={aiPanelOpen}
        >
          <Sparkles className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
