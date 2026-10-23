import React from 'react';
import { Menu, Palette, Search, Sparkles, X } from 'lucide-react';
import { useStore } from '../store/useStore';

const ACCENTS = [
  { id: 'aurora', label: 'Verdigris', color: '#14b8a6' },
  { id: 'iris', label: 'Iris', color: '#8b6cf6' },
  { id: 'ember', label: 'Ember', color: '#f59e0b' },
];

export default function Header() {
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const accent = useStore((s) => s.accent);
  const setAccent = useStore((s) => s.setAccent);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const toggleAIPanel = useStore((s) => s.toggleAIPanel);
  const aiPanelOpen = useStore((s) => s.aiPanelOpen);

  const [appearanceOpen, setAppearanceOpen] = React.useState(false);
  const appearanceRef = React.useRef(null);

  React.useEffect(() => {
    if (!appearanceOpen) return undefined;
    const onPointerDown = (event) => {
      if (appearanceRef.current && !appearanceRef.current.contains(event.target)) {
        setAppearanceOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setAppearanceOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [appearanceOpen]);

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

        <div className="relative" ref={appearanceRef}>
          <button
            type="button"
            className={`icon-btn ${appearanceOpen ? 'bg-raised text-ink' : ''}`}
            onClick={() => setAppearanceOpen((open) => !open)}
            aria-label="Appearance settings"
            aria-haspopup="dialog"
            aria-expanded={appearanceOpen}
          >
            <Palette className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>

          {appearanceOpen && (
            <div
              role="dialog"
              aria-label="Appearance settings"
              className="panel-raised absolute right-0 top-11 w-64 p-4"
            >
              <p className="text-xs font-medium text-muted">Accent</p>
              <div className="mt-2 flex gap-2" role="group" aria-label="Accent color">
                {ACCENTS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setAccent(option.id)}
                    aria-pressed={accent === option.id}
                    aria-label={option.label}
                    title={option.label}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform hover:scale-105 ${
                      accent === option.id ? 'border-ink' : 'border-transparent'
                    }`}
                  >
                    <span
                      className="h-5 w-5 rounded-full"
                      style={{ backgroundColor: option.color }}
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
