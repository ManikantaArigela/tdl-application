import { create } from 'zustand';
import { api } from '../api';

// The app ships with a single light theme and a single brand color. Clear any
// preference left behind by the old theme/accent switchers so it cannot
// resurface later.
try {
  localStorage.removeItem('nova.theme');
  localStorage.removeItem('nova.accent');
} catch {
  /* storage unavailable */
}

export const useStore = create((set, get) => ({
  // ---- Data ----
  notes: [],
  todos: [],
  loaded: false,
  initializing: false,
  syncing: false,
  syncError: null,

  // ---- UI state ----
  activeView: 'notes',
  selectedNoteId: null,
  searchQuery: '',
  commandPaletteOpen: false,
  quickCaptureOpen: false,
  quickCaptureType: 'note',
  sidebarOpen: false,
  aiPanelOpen: false,
  exportOpen: false,

  // ---- Init ----
  init: async () => {
    if (get().initializing) return;
    set({ initializing: true });
    try {
      const [notes, todos] = await Promise.all([api.getNotes(), api.getTodos()]);
      set({ notes, todos, loaded: true, initializing: false, syncError: null });
    } catch (err) {
      set({
        loaded: true,
        initializing: false,
        syncError:
          err?.message ||
          'Could not reach the API. Start the backend on port 5001, then retry.',
      });
    }
  },

  // ---- Notes ----
  addNote: async (note) => {
    try {
      const created = await api.createNote(note);
      set((state) => ({ notes: [created, ...state.notes], syncError: null }));
      return created;
    } catch (err) {
      set({ syncError: err.message });
      return null;
    }
  },

  updateNote: async (id, updates) => {
    try {
      const updated = await api.updateNote(id, updates);
      set((state) => ({
        notes: state.notes.map((n) => (n.id === id ? updated : n)),
        syncError: null,
      }));
      return updated;
    } catch (err) {
      set({ syncError: err.message });
      return null;
    }
  },

  deleteNote: async (id) => {
    try {
      await api.deleteNote(id);
      set((state) => ({
        notes: state.notes.filter((n) => n.id !== id),
        selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId,
        syncError: null,
      }));
      return true;
    } catch (err) {
      set({ syncError: err.message });
      return false;
    }
  },

  togglePin: async (id) => {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return null;
    return get().updateNote(id, { pinned: !note.pinned });
  },

  toggleArchive: async (id) => {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return null;
    const updated = await get().updateNote(id, { archived: !note.archived });
    if (updated) {
      set((state) => ({
        selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId,
      }));
    }
    return updated;
  },

  selectNote: (id) => set({ selectedNoteId: id, aiPanelOpen: false }),

  // ---- Todos ----
  addTodo: async (todo) => {
    try {
      const created = await api.createTodo(todo);
      set((state) => ({ todos: [created, ...state.todos], syncError: null }));
      return created;
    } catch (err) {
      set({ syncError: err.message });
      return null;
    }
  },

  toggleTodo: async (id) => {
    const todo = get().todos.find((t) => t.id === id);
    if (!todo) return null;
    const completed = !todo.completed;
    try {
      const updated = await api.updateTodo(id, {
        completed,
        completedAt: completed ? Date.now() : null,
      });
      set((state) => ({
        todos: state.todos.map((t) => (t.id === id ? updated : t)),
        syncError: null,
      }));
      return updated;
    } catch (err) {
      set({ syncError: err.message });
      return null;
    }
  },

  updateTodo: async (id, updates) => {
    try {
      const updated = await api.updateTodo(id, updates);
      set((state) => ({
        todos: state.todos.map((t) => (t.id === id ? updated : t)),
        syncError: null,
      }));
      return updated;
    } catch (err) {
      set({ syncError: err.message });
      return null;
    }
  },

  deleteTodo: async (id) => {
    try {
      await api.deleteTodo(id);
      set((state) => ({ todos: state.todos.filter((t) => t.id !== id), syncError: null }));
      return true;
    } catch (err) {
      set({ syncError: err.message });
      return false;
    }
  },

  reorderTodos: async (todos) => {
    const previous = get().todos;
    set({ todos });
    try {
      await api.reorderTodos(todos);
      set({ syncError: null });
    } catch (err) {
      set({ todos: previous, syncError: err.message });
    }
  },

  // ---- UI ----
  setActiveView: (view) => set({ activeView: view, selectedNoteId: null }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  toggleQuickCapture: () =>
    set((s) =>
      s.quickCaptureOpen
        ? { quickCaptureOpen: false }
        : { quickCaptureOpen: true, quickCaptureType: 'note' }
    ),
  openQuickCapture: (type = 'note') =>
    set({ quickCaptureOpen: true, quickCaptureType: type }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleAIPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
  setAIPanelOpen: (open) => set({ aiPanelOpen: open }),
  setExportOpen: (open) => set({ exportOpen: open }),
  clearSyncError: () => set({ syncError: null }),

  // ---- Derived ----
  get visibleNotes() {
    const { notes, searchQuery } = get();
    const q = searchQuery.trim().toLowerCase();
    return notes.filter((n) => {
      if (n.archived) return false;
      if (!q) return true;
      return (
        (n.title ?? '').toLowerCase().includes(q) ||
        (n.content ?? '').toLowerCase().includes(q) ||
        (n.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  },
  get archivedNotes() {
    const { notes, searchQuery } = get();
    const q = searchQuery.trim().toLowerCase();
    return notes.filter((n) => {
      if (!n.archived) return false;
      if (!q) return true;
      return (
        (n.title ?? '').toLowerCase().includes(q) ||
        (n.content ?? '').toLowerCase().includes(q) ||
        (n.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  },
  get pinnedNotes() {
    return get().visibleNotes.filter((n) => n.pinned);
  },
  get unpinnedNotes() {
    return get().visibleNotes.filter((n) => !n.pinned);
  },
  get pendingTodos() {
    return get().todos.filter((t) => !t.completed);
  },
  get completedTodos() {
    return get().todos.filter((t) => t.completed);
  },
  get streak() {
    const days = new Set(
      get()
        .todos.filter((t) => t.completedAt)
        .map((t) => {
          const d = new Date(t.completedAt);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        })
    );
    if (days.size === 0) return 0;

    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    if (!days.has(cursor.getTime())) {
      cursor.setDate(cursor.getDate() - 1);
      if (!days.has(cursor.getTime())) return 0;
    }

    let streak = 0;
    while (days.has(cursor.getTime())) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  },
  get completedThisWeek() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    return get().todos.filter((t) => t.completedAt && t.completedAt >= start.getTime())
      .length;
  },

  // ---- Export ----
  exportMarkdown: () => {
    const { notes, todos } = get();
    const lines = ['# TDL export', '', `Generated: ${new Date().toISOString()}`, ''];
    lines.push('## Notes', '');
    notes.forEach((n) => {
      lines.push(`### ${n.title || 'Untitled'}`);
      if (n.content) lines.push('', n.content);
      if (n.tags?.length) lines.push('', `Tags: ${n.tags.join(', ')}`);
      lines.push('');
    });
    lines.push('## Todos', '');
    todos.forEach((t) => {
      lines.push(`- [${t.completed ? 'x' : ' '}] ${t.text} (${t.priority ?? 'medium'})`);
    });
    return lines.join('\n');
  },
}));
