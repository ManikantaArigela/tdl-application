import React from 'react';
import { motion } from 'framer-motion';
import {
  Archive,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Command,
  Download,
  LayoutGrid,
  Plus,
  ScrollText,
  Search,
  Sparkles,
  Star,
  Wand2,
} from 'lucide-react';
import { useStore } from '../store/useStore';

export default function CommandPalette() {
  const addNote = useStore((s) => s.addNote);
  const addTodo = useStore((s) => s.addTodo);
  const selectNote = useStore((s) => s.selectNote);
  const setActiveView = useStore((s) => s.setActiveView);
  const setCommandPaletteOpen = useStore((s) => s.setCommandPaletteOpen);
  const setExportOpen = useStore((s) => s.setExportOpen);
  const toggleAIPanel = useStore((s) => s.toggleAIPanel);
  const setAIPlannerOpen = useStore((s) => s.setAIPlannerOpen);
  const setAISummaryOpen = useStore((s) => s.setAISummaryOpen);
  const openQuickCapture = useStore((s) => s.openQuickCapture);

  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef(null);

  const go = (view) => () => setActiveView(view);

  const commands = [
    {
      id: 'new-note',
      label: 'New note',
      hint: 'Create a blank note and open the editor',
      icon: Plus,
      run: async () => {
        const created = await addNote({ title: '', content: '', tags: [], pinned: false, archived: false });
        if (created) {
          setActiveView('notes');
          selectNote(created.id);
        }
      },
    },
    {
      id: 'new-todo',
      label: 'New todo',
      hint: 'Open quick capture for a task',
      icon: CheckCircle2,
      run: () => openQuickCapture('todo'),
    },
    {
      id: 'quick-capture',
      label: 'Quick capture',
      hint: 'Capture a note or task without leaving the page',
      icon: Sparkles,
      run: () => openQuickCapture('note'),
    },
    {
      id: 'ai-planner',
      label: 'AI planner',
      hint: 'Turn a topic or file into notes and tasks',
      icon: Wand2,
      run: () => setAIPlannerOpen(true),
    },
    {
      id: 'ai-summary',
      label: 'Summarize notes',
      hint: 'Create a study brief from all notes',
      icon: ScrollText,
      run: () => setAISummaryOpen(true),
    },
    { id: 'go-notes', label: 'Go to Notes', hint: 'Browse all notes', icon: LayoutGrid, run: go('notes') },
    { id: 'go-todos', label: 'Go to Todos', hint: 'Open the task list', icon: CheckCircle2, run: go('todos') },
    { id: 'go-today', label: 'Go to Today', hint: 'Open tasks', icon: CalendarDays, run: go('today') },
    { id: 'go-starred', label: 'Go to Starred', hint: 'Pinned notes', icon: Star, run: go('starred') },
    { id: 'go-archive', label: 'Go to Archive', hint: 'Archived notes', icon: Archive, run: go('archive') },
    { id: 'go-analytics', label: 'Go to Analytics', hint: 'Weekly progress', icon: BarChart3, run: go('analytics') },
    { id: 'insights', label: 'Open insights', hint: 'Review your notes and tasks', icon: Sparkles, run: () => toggleAIPanel() },
    { id: 'export', label: 'Export as Markdown', hint: 'Download notes and todos', icon: Download, run: () => setExportOpen(true) },
  ];

  const filtered = commands.filter((command) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      command.label.toLowerCase().includes(q) || command.hint.toLowerCase().includes(q)
    );
  });

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const close = () => setCommandPaletteOpen(false);

  const execute = (command) => {
    if (!command) return;
    close();
    command.run();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={close}
    >
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.99 }}
        transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="panel-raised w-full max-w-lg overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Search className="h-4 w-4 text-faint" aria-hidden="true" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-activedescendant={filtered[activeIndex] ? `command-${filtered[activeIndex].id}` : undefined}
            aria-label="Search commands"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                execute(filtered[activeIndex]);
              } else if (event.key === 'Escape') {
                close();
              }
            }}
            placeholder="Type a command…"
            className="w-full bg-transparent py-1 text-sm text-ink outline-none placeholder:text-faint"
          />
          <kbd className="kbd">Esc</kbd>
        </div>

        <ul id="command-list" role="listbox" aria-label="Commands" className="max-h-80 overflow-y-auto p-2">
          {filtered.map((command, index) => {
            const Icon = command.icon;
            const isActive = index === activeIndex;
            return (
              <li
                key={command.id}
                id={`command-${command.id}`}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => execute(command)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ${
                  isActive ? 'bg-accent/10' : ''
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-raised text-muted">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{command.label}</span>
                  <span className="block truncate text-xs text-faint">{command.hint}</span>
                </span>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-muted">No matching commands</li>
          )}
        </ul>

        <div className="flex items-center gap-3 border-t border-line px-4 py-2.5 text-[11px] text-faint">
          <span className="flex items-center gap-1">
            <Command className="h-3 w-3" aria-hidden="true" /> K to open
          </span>
          <span>↑↓ navigate</span>
          <span>Enter to run</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
