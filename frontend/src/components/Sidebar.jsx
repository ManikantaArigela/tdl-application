import React from 'react';
import {
  Archive,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  LayoutGrid,
  Star,
  Wand2,
  X,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { plural } from '../lib/format';

export default function Sidebar() {
  const activeView = useStore((s) => s.activeView);
  const setActiveView = useStore((s) => s.setActiveView);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const setExportOpen = useStore((s) => s.setExportOpen);
  const setAIPlannerOpen = useStore((s) => s.setAIPlannerOpen);

  const notes = useStore((s) => s.notes);
  const todos = useStore((s) => s.todos);
  const searchQuery = useStore((s) => s.searchQuery);

  // Derive counts locally so the store is never subscribed to a fresh array.
  const { visibleNotes, archivedNotes, pinnedNotes, pendingTodos } = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matches = (note) =>
      !query ||
      (note.title ?? '').toLowerCase().includes(query) ||
      (note.content ?? '').toLowerCase().includes(query) ||
      (note.tags ?? []).some((tag) => tag.toLowerCase().includes(query));

    const visible = notes.filter((note) => !note.archived && matches(note));
    const archived = notes.filter((note) => note.archived && matches(note));

    return {
      visibleNotes: visible,
      archivedNotes: archived,
      pinnedNotes: visible.filter((note) => note.pinned),
      pendingTodos: todos.filter((todo) => !todo.completed),
    };
  }, [notes, todos, searchQuery]);

  const navItems = [
    { id: 'notes', label: 'Notes', icon: LayoutGrid, count: visibleNotes.length },
    { id: 'todos', label: 'Todos', icon: CheckCircle2, count: pendingTodos.length },
    { id: 'today', label: 'Today', icon: CalendarDays },
    { id: 'starred', label: 'Starred', icon: Star, count: pinnedNotes.length },
    { id: 'archive', label: 'Archive', icon: Archive, count: archivedNotes.length },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  const selectView = (id) => {
    setActiveView(id);
    setSidebarOpen(false);
  };

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside
        aria-label="Primary"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-panel transition-transform duration-200 ease-standard md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-fg"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" strokeLinecap="round" />
              </svg>
            </span>
            <span className="font-display text-xl leading-none text-ink">TDL</span>
          </div>
          <button
            type="button"
            className="icon-btn md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-2" aria-label="Views">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectView(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                <span className="flex-1 text-left">{item.label}</span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="font-mono text-[11px] text-faint">{item.count}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-line p-3">
          <button
            type="button"
            className="nav-item"
            onClick={() => {
              setAIPlannerOpen(true);
              setSidebarOpen(false);
            }}
          >
            <Wand2 className="h-[18px] w-[18px]" aria-hidden="true" />
            AI planner
          </button>
          <button
            type="button"
            className="nav-item"
            onClick={() => {
              setExportOpen(true);
              setSidebarOpen(false);
            }}
          >
            <Download className="h-[18px] w-[18px]" aria-hidden="true" />
            Export as Markdown
          </button>
          <div className="mt-3 flex items-center justify-between px-3 pb-1">
            <span className="text-[11px] text-faint">
              {visibleNotes.length} {plural(visibleNotes.length, 'note')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="kbd">⌘</kbd>
              <kbd className="kbd">K</kbd>
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
