import React from 'react';
import { motion } from 'framer-motion';
import {
  Archive,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Circle,
  Command,
  Download,
  LayoutGrid,
  Moon,
  Plus,
  ScrollText,
  Search,
  Sparkles,
  Star,
  StickyNote,
  Sun,
  Trash2,
  UserRound,
  Wand2,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { noteMatchesQuery } from '../lib/notes';
import { formatDate } from '../lib/format';

const MAX_CONTENT_RESULTS = 6;

const compactText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const snippet = (value, max = 90) => {
  const text = compactText(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const taskHint = (todo) => {
  const parts = [];
  if (todo.completed) parts.push('Completed');
  parts.push(`${todo.priority ? todo.priority[0].toUpperCase() + todo.priority.slice(1) : 'Medium'} priority`);
  if (todo.dueDate) parts.push(`Due ${formatDate(todo.dueDate)}`);
  return parts.join(' · ');
};

export default function CommandPalette() {
  const addNote = useStore((s) => s.addNote);
  const selectNote = useStore((s) => s.selectNote);
  const setActiveView = useStore((s) => s.setActiveView);
  const setCommandPaletteOpen = useStore((s) => s.setCommandPaletteOpen);
  const setExportOpen = useStore((s) => s.setExportOpen);
  const toggleAIPanel = useStore((s) => s.toggleAIPanel);
  const setAIPlannerOpen = useStore((s) => s.setAIPlannerOpen);
  const setAISummaryOpen = useStore((s) => s.setAISummaryOpen);
  const openQuickCapture = useStore((s) => s.openQuickCapture);
  const focusTodo = useStore((s) => s.focusTodo);
  const notes = useStore((s) => s.notes);
  const todos = useStore((s) => s.todos);
  const theme = useStore((s) => s.settings.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);

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
    { id: 'go-trash', label: 'Go to Trash', hint: 'Restore or permanently delete items', icon: Trash2, run: go('trash') },
    { id: 'go-analytics', label: 'Go to Analytics', hint: 'Weekly progress', icon: BarChart3, run: go('analytics') },
    { id: 'go-profile', label: 'Go to Profile & Settings', hint: 'Name, bio, and preferences', icon: UserRound, run: go('profile') },
    { id: 'insights', label: 'Open insights', hint: 'Review your notes and tasks', icon: Sparkles, run: () => toggleAIPanel() },
    {
      id: 'toggle-theme',
      label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
      hint: 'Toggle the app appearance',
      icon: theme === 'dark' ? Sun : Moon,
      run: () => toggleTheme(),
    },
    { id: 'export', label: 'Export as Markdown', hint: 'Download notes and todos', icon: Download, run: () => setExportOpen(true) },
  ];

  const q = query.trim();
  const normalizedQuery = q.toLowerCase();

  const filteredCommands = commands
    .filter((command) => {
      if (!normalizedQuery) return true;
      return (
        command.label.toLowerCase().includes(normalizedQuery) ||
        command.hint.toLowerCase().includes(normalizedQuery)
      );
    })
    .map((command) => ({
      ...command,
      key: command.id,
      kind: 'command',
    }));

  const noteResults = q
    ? notes
        .filter((note) => noteMatchesQuery(note, q))
        .slice(0, MAX_CONTENT_RESULTS)
        .map((note) => ({
          key: `note-${note.id}`,
          kind: 'note',
          label: note.title?.trim() || 'Untitled note',
          hint:
            snippet(note.content) ||
            (note.tags?.length
              ? note.tags.map((tag) => `#${tag}`).join(' ')
              : 'Empty note'),
          badge: note.archived ? 'Archived' : note.pinned ? 'Pinned' : '',
          icon: StickyNote,
          run: () => {
            setActiveView('notes');
            selectNote(note.id);
          },
        }))
    : [];

  const taskResults = q
    ? todos
        .filter((todo) => {
          if (todo.text.toLowerCase().includes(normalizedQuery)) return true;
          if ((todo.priority ?? '').toLowerCase().includes(normalizedQuery)) return true;
          return todo.dueDate ? formatDate(todo.dueDate).toLowerCase().includes(normalizedQuery) : false;
        })
        .slice(0, MAX_CONTENT_RESULTS)
        .map((todo) => ({
          key: `todo-${todo.id}`,
          kind: 'task',
          label: todo.text,
          hint: taskHint(todo),
          badge: todo.completed ? 'Done' : '',
          icon: todo.completed ? CheckCircle2 : Circle,
          run: () => focusTodo(todo.id),
        }))
    : [];

  const groups = [
    ...(q
      ? [
          { id: 'notes', title: 'Notes', items: noteResults },
          { id: 'tasks', title: 'Tasks', items: taskResults },
        ]
      : []),
    { id: 'commands', title: 'Commands', items: filteredCommands },
  ].filter((group) => group.items.length > 0);

  const results = groups.flatMap((group) => group.items);
  const activeKey = results[activeIndex]?.key;

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  React.useEffect(() => {
    if (activeIndex < results.length) return;
    setActiveIndex(Math.max(results.length - 1, 0));
  }, [activeIndex, results.length]);

  React.useEffect(() => {
    if (!activeKey) return;
    document.getElementById(`command-${activeKey}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeKey]);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const close = () => setCommandPaletteOpen(false);

  const execute = (item) => {
    if (!item) return;
    close();
    item.run();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pb-4 pt-[12vh] backdrop-blur-sm"
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
        className="panel-raised flex max-h-[calc(88dvh-2rem)] w-full max-w-lg flex-col overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3">
          <Search className="h-4 w-4 text-faint" aria-hidden="true" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-autocomplete="list"
            aria-activedescendant={results[activeIndex] ? `command-${results[activeIndex].key}` : undefined}
            aria-label="Search notes, tasks, and commands"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                execute(results[activeIndex]);
              } else if (event.key === 'Escape') {
                close();
              }
            }}
            placeholder="Search notes, tasks, or commands…"
            className="w-full bg-transparent py-1 text-sm text-ink outline-none placeholder:text-faint"
          />
          <kbd className="kbd">Esc</kbd>
        </div>

        <div
          id="command-list"
          role="listbox"
          aria-label="Search results"
          className="min-h-0 max-h-80 flex-1 overflow-y-auto overscroll-contain p-2"
        >
          {groups.map((group) => {
            const start = groups
              .slice(0, groups.findIndex((candidate) => candidate.id === group.id))
              .reduce((total, candidate) => total + candidate.items.length, 0);

            return (
              <div key={group.id} role="group" aria-label={group.title} className="pb-1 last:pb-0">
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
                  {group.title}
                </p>
                {group.items.map((item, itemIndex) => {
                  const index = start + itemIndex;
                  const Icon = item.icon;
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={item.key}
                      id={`command-${item.key}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => execute(item)}
                      className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left ${
                        isActive ? 'bg-accent/10' : ''
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-raised text-muted">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="block min-w-0 flex-1 truncate text-sm text-ink">{item.label}</span>
                          {item.badge && (
                            <span className="shrink-0 rounded-full bg-raised px-1.5 py-0.5 text-[10px] font-medium text-faint">
                              {item.badge}
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-faint">{item.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted">
              No matching notes, tasks, or commands
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-line px-4 py-2.5 text-[11px] text-faint">
          <span className="flex items-center gap-1">
            <Command className="h-3 w-3" aria-hidden="true" /> K to open
          </span>
          <span>↑↓ navigate</span>
          <span>Enter to open</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
