import { create } from 'zustand';
import { api } from '../api';
import { advanceDueDate } from '../lib/format';
import { showSystemNotification } from '../lib/notifications';
import { supabase } from '../lib/supabase';

// The app ships with a single light theme and a single brand color. Clear any
// preference left behind by the old theme/accent switchers so it cannot
// resurface later.
try {
  localStorage.removeItem('nova.theme');
  localStorage.removeItem('nova.accent');
} catch {
  /* storage unavailable */
}

function readPreference(key, fallback = null) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function storePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* preferences are best-effort */
  }
}

const initialPermission =
  typeof window !== 'undefined' && 'Notification' in window
    ? window.Notification.permission
    : 'unsupported';

const initialNotifyEnabled = readPreference('tdl.notify', 'on') !== 'off';

// Supabase asks auth callbacks not to call back into its client synchronously.
let authSubscription = null;

const emptyWorkspace = {
  notes: [],
  todos: [],
  loaded: false,
  initializing: false,
  syncing: false,
  syncError: null,
  activeView: 'notes',
  selectedNoteId: null,
  searchQuery: '',
  commandPaletteOpen: false,
  quickCaptureOpen: false,
  quickCaptureType: 'note',
  sidebarOpen: false,
  aiPanelOpen: false,
  aiPlannerOpen: false,
  aiSummaryOpen: false,
  exportOpen: false,
};

function authMessage(error) {
  const message = error?.message || 'Something went wrong. Try again.';
  if (/invalid login credentials/i.test(message)) return 'Incorrect email or password.';
  if (/email not confirmed/i.test(message)) {
    return 'Confirm your email first. Check your inbox for the link.';
  }
  if (/user already registered/i.test(message)) {
    return 'An account with that email already exists. Sign in instead.';
  }
  if (/password should be at least/i.test(message)) {
    return 'Use a password with at least 6 characters.';
  }
  if (/rate limit|too many/i.test(message)) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  return message;
}


export const useStore = create((set, get) => ({
  // ---- Data ----
  notes: [],
  todos: [],
  loaded: false,
  initializing: false,
  syncing: false,
  syncError: null,

  // ---- Auth ----
  authReady: false,
  authInitializing: false,
  authBusy: false,
  session: null,
  user: null,
  authError: null,
  authNotice: null,

  // ---- UI state ----
  activeView: 'notes',
  selectedNoteId: null,
  searchQuery: '',
  commandPaletteOpen: false,
  quickCaptureOpen: false,
  quickCaptureType: 'note',
  sidebarOpen: false,
  aiPanelOpen: false,
  aiPlannerOpen: false,
  aiSummaryOpen: false,
  exportOpen: false,
  notifyEnabled: initialNotifyEnabled,
  notificationPermission: initialPermission,

  // ---- Auth ----
  initAuth: async () => {
    if (authSubscription) return;

    if (!supabase) {
      set({
        authReady: true,
        authInitializing: false,
        authError:
          'Authentication is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env, then restart the dev server.',
      });
      return;
    }

    set({ authInitializing: true });

    try {
      authSubscription = supabase.auth.onAuthStateChange((event, session) => {
        const previousUserId = get().user?.id;
        const nextUser = session?.user ?? null;

        set({
          session: session ?? null,
          user: nextUser,
          authReady: true,
          authInitializing: false,
        });

        if (!session) {
          set({ ...emptyWorkspace, authBusy: false });
          return;
        }

        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;

        const switchedUser = previousUserId && previousUserId !== nextUser?.id;
        if (switchedUser) {
          set({ notes: [], todos: [], loaded: false, selectedNoteId: null });
        }

        const needsLoad = !get().loaded || switchedUser;
        if (needsLoad) {
          // Defer so we never re-enter Supabase while it is applying auth state.
          setTimeout(() => get().init(), 0);
        }
      });
    } catch (error) {
      set({
        authReady: true,
        authInitializing: false,
        authError: authMessage(error),
      });
      return;
    }

    // Older auth-js versions may not emit INITIAL_SESSION; this is a fallback.
    try {
      const { data } = await supabase.auth.getSession();
      if (!get().authReady) {
        const session = data.session ?? null;
        set({
          session,
          user: session?.user ?? null,
          authReady: true,
          authInitializing: false,
        });
        if (session) get().init();
      }
    } catch (error) {
      set({
        authReady: true,
        authInitializing: false,
        authError: authMessage(error),
      });
    }
  },

  signIn: async (email, password) => {
    if (!supabase) {
      const message = 'Authentication is not configured.';
      set({ authError: message });
      return { error: { message } };
    }

    set({ authBusy: true, authError: null, authNotice: null });
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        set({ authBusy: false, authError: authMessage(error) });
        return { error };
      }
      set({ authBusy: false });
      return { error: null };
    } catch (error) {
      set({ authBusy: false, authError: authMessage(error) });
      return { error };
    }
  },

  signUp: async (email, password) => {
    if (!supabase) {
      const message = 'Authentication is not configured.';
      set({ authError: message });
      return { error: { message } };
    }

    set({ authBusy: true, authError: null, authNotice: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      });

      if (error) {
        set({ authBusy: false, authError: authMessage(error) });
        return { error };
      }

      set({ authBusy: false });

      if (!data.session) {
        set({
          authNotice:
            'Account created. Check your email for the confirmation link, then sign in.',
        });
        return { error: null, needsConfirmation: true };
      }

      return { error: null, needsConfirmation: false };
    } catch (error) {
      set({ authBusy: false, authError: authMessage(error) });
      return { error };
    }
  },

  signOut: async () => {
    set({ authBusy: true });
    try {
      if (supabase) await supabase.auth.signOut();
    } catch {
      /* clear locally even if the network call fails */
    }
    set({
      ...emptyWorkspace,
      session: null,
      user: null,
      authBusy: false,
      authReady: true,
      authError: null,
      authNotice: null,
    });
  },

  clearAuthMessages: () => set({ authError: null, authNotice: null }),

  // ---- Init ----
  init: async () => {
    if (get().initializing) return;
    if (!get().session) return;

    const userId = get().user?.id;
    set({ initializing: true });
    try {
      const [notes, todos] = await Promise.all([api.getNotes(), api.getTodos()]);
      // A sign-out or account switch may have happened while the request was in flight.
      if (get().user?.id !== userId) {
        set({ initializing: false });
        return;
      }
      set({ notes, todos, loaded: true, initializing: false, syncError: null });
    } catch (err) {
      if (get().user?.id !== userId) {
        set({ initializing: false });
        return;
      }
      set({
        loaded: true,
        initializing: false,
        syncError:
          err?.message ||
          'Could not reach the API. Start the backend on port 5001, then retry.',
      });
    }
  },

  // ---- Data ----
  refresh: async () => {
    try {
      const [notes, todos] = await Promise.all([api.getNotes(), api.getTodos()]);
      set({ notes, todos, syncError: null });
      return { notes, todos };
    } catch (err) {
      set({ syncError: err.message });
      return null;
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

    // Recurring tasks roll forward instead of closing, so the habit keeps going.
    if (!todo.completed && todo.repeat && todo.repeat !== 'none') {
      return get().updateTodo(id, {
        dueDate: advanceDueDate(todo.dueDate, todo.repeat),
        completed: false,
        completedAt: null,
      });
    }

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
  setAIPlannerOpen: (open) => set({ aiPlannerOpen: open }),
  setAISummaryOpen: (open) => set({ aiSummaryOpen: open }),
  setExportOpen: (open) => set({ exportOpen: open }),
  clearSyncError: () => set({ syncError: null }),

  // ---- Notifications ----
  setNotifyEnabled: (enabled) => {
    storePreference('tdl.notify', enabled ? 'on' : 'off');
    set({ notifyEnabled: enabled });
  },
  requestNotifications: async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      set({ notificationPermission: 'unsupported' });
      return 'unsupported';
    }
    try {
      const result = await window.Notification.requestPermission();
      set({ notificationPermission: result });
      if (result === 'granted') {
        storePreference('tdl.notify', 'on');
        set({ notifyEnabled: true });
      }
      return result;
    } catch {
      return 'error';
    }
  },
  sendTestNotification: () => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      window.Notification.permission !== 'granted'
    ) {
      return false;
    }
    showSystemNotification('TDL reminders are on', {
      body: 'You will be notified when a task is due.',
      tag: 'tdl-test',
    });
    return true;
  },

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
      const due = t.dueDate ? `, due ${t.dueDate}${t.dueTime ? ` ${t.dueTime}` : ''}` : '';
      const repeat = t.repeat && t.repeat !== 'none' ? `, ${t.repeat}` : '';
      lines.push(`- [${t.completed ? 'x' : ' '}] ${t.text} (${t.priority ?? 'medium'}${due}${repeat})`);
    });
    return lines.join('\n');
  },
}));
