import { create } from 'zustand';
import { api } from '../api';
import { advanceDueDate, dayKey } from '../lib/format';
import { showSystemNotification } from '../lib/notifications';
import { auth } from '../lib/auth';
import { normalizePlan } from '../lib/plans';
import { loadSettings, saveSettings, clearSettings } from '../lib/settings';

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

const PLAN_KEY = 'tdl.plan';
const PLAN_USAGE_KEY = 'tdl.plan-usage';
const PENDING_PLAN_KEY = 'tdl.pending-plan';

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function readPlan() {
  return normalizePlan(readPreference(PLAN_KEY, 'free'));
}

function readPlanUsage() {
  const month = currentMonthKey();
  try {
    const saved = JSON.parse(localStorage.getItem(PLAN_USAGE_KEY) || 'null');
    if (saved?.month === month) {
      return {
        month,
        planner: Math.max(0, Number(saved.planner) || 0),
        notes: Math.max(0, Number(saved.notes) || 0),
      };
    }
  } catch {
    /* a broken counter should never block the app */
  }
  return { month, planner: 0, notes: 0 };
}

function writePlanUsage(usage) {
  try {
    localStorage.setItem(PLAN_USAGE_KEY, JSON.stringify(usage));
  } catch {
    /* usage is best-effort */
  }
}

// One global listener is enough: the API client fires it when a token expires.
let authListenerAttached = false;

const emptyProfile = { name: '', bio: '', avatar: '' };

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
  planDialogOpen: false,
  profile: emptyProfile,
};

function authMessage(error) {
  const message = error?.message || 'Something went wrong. Try again.';
  if (/invalid login credentials|incorrect email or password/i.test(message)) {
    return 'Incorrect email or password.';
  }
  if (/already exists/i.test(message)) {
    return 'An account with that email already exists. Sign in instead.';
  }
  if (/at least \d+ characters/i.test(message)) {
    return 'Use a password with at least 8 characters.';
  }
  if (/too many|rate limit/i.test(message)) {
    return 'Too many attempts. Wait a few minutes and try again.';
  }
  if (/could not reach|failed to fetch|network/i.test(message)) {
    return 'Could not reach the API. Start the backend on port 5001, then try again.';
  }
  return message;
}

/** The API user DTO carries the persisted profile fields. */
function profileOf(user) {
  return {
    name: typeof user?.name === 'string' ? user.name : '',
    bio: typeof user?.bio === 'string' ? user.bio : '',
    avatar: typeof user?.avatar === 'string' ? user.avatar : '',
  };
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
  planDialogOpen: false,
  pendingPlan: readPreference(PENDING_PLAN_KEY, null),
  plan: readPlan(),
  planUsage: readPlanUsage(),
  profile: emptyProfile,
  profileBusy: false,
  profileError: null,
  settings: loadSettings(),
  notifyEnabled: initialNotifyEnabled,
  notificationPermission: initialPermission,

  // ---- Auth ----
  initAuth: async () => {
    if (authListenerAttached) return;
    authListenerAttached = true;

    // The API client clears the stored token and fires this when a request
    // returns 401 (expired or revoked session).
    if (typeof window !== 'undefined') {
      window.addEventListener('nova:unauthorized', () => {
        set({
          ...emptyWorkspace,
          session: null,
          user: null,
          authBusy: false,
          authReady: true,
          authError: 'Your session has expired. Please sign in again.',
          authNotice: null,
        });
      });
    }

    set({ authInitializing: true });

    try {
      const user = await auth.me();
      if (!user) {
        set({
          session: null,
          user: null,
          authReady: true,
          authInitializing: false,
        });
        return;
      }

      set({
        session: { user },
        user,
        profile: profileOf(user),
        authReady: true,
        authInitializing: false,
      });
      await get().init();
    } catch (error) {
      set({
        session: null,
        user: null,
        authReady: true,
        authInitializing: false,
        authError: authMessage(error),
      });
    }
  },

  signIn: async (email, password) => {
    set({ authBusy: true, authError: null, authNotice: null });
    try {
      const { user } = await auth.signIn(email.trim(), password);
      set({
        session: { user },
        user,
        profile: profileOf(user),
        authBusy: false,
        authError: null,
      });
      await get().init();
      return { error: null };
    } catch (error) {
      set({ authBusy: false, authError: authMessage(error) });
      return { error };
    }
  },

  signUp: async (email, password) => {
    set({ authBusy: true, authError: null, authNotice: null });
    try {
      const { user } = await auth.signUp(email.trim(), password);
      const pending = readPreference(PENDING_PLAN_KEY, null);
      const nextPlan = pending ? normalizePlan(pending) : get().plan;
      if (pending) {
        storePreference(PLAN_KEY, nextPlan);
        try {
          localStorage.removeItem(PENDING_PLAN_KEY);
        } catch {
          /* ignore */
        }
      }
      set({
        session: { user },
        user,
        profile: profileOf(user),
        authBusy: false,
        authError: null,
        ...(pending ? { plan: nextPlan, pendingPlan: null } : {}),
      });
      await get().init();
      return { error: null, needsConfirmation: false };
    } catch (error) {
      set({ authBusy: false, authError: authMessage(error) });
      return { error };
    }
  },

  signOut: async () => {
    set({ authBusy: true });
    try {
      await auth.signOut();
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
      planDialogOpen: false,
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
  setPlanDialogOpen: (open) => set({ planDialogOpen: open }),
  choosePlanBeforeSignup: (planId) => {
    const next = normalizePlan(planId);
    storePreference(PENDING_PLAN_KEY, next);
    set({ pendingPlan: next });
  },
  setPlan: (planId) => {
    const next = normalizePlan(planId);
    storePreference(PLAN_KEY, next);
    set({ plan: next, planDialogOpen: false });
  },
  recordAIUse: (kind) => {
    if (kind !== 'planner' && kind !== 'notes') return;
    const month = currentMonthKey();
    set((state) => {
      const base = state.planUsage?.month === month ? state.planUsage : readPlanUsage();
      const next = {
        ...base,
        [kind]: (Number(base[kind]) || 0) + 1,
      };
      writePlanUsage(next);
      return { planUsage: next };
    });
  },
  clearSyncError: () => set({ syncError: null }),

  // ---- Profile ----
  updateProfile: async (input) => {
    set({ profileBusy: true, profileError: null });
    try {
      const { user } = await api.updateProfile(input);
      set({
        user,
        profile: profileOf(user),
        profileBusy: false,
        profileError: null,
      });
      return { error: null };
    } catch (err) {
      set({ profileBusy: false, profileError: err.message });
      return { error: err };
    }
  },
  clearProfileError: () => set({ profileError: null }),

  // ---- Settings (device-level, persisted in localStorage) ----
  setSettings: (patch) => {
    set((state) => {
      const next = { ...state.settings, ...patch };
      saveSettings(next);
      return { settings: next };
    });
  },
  /** Privacy: wipe every local preference (settings, plan, notify flag). */
  clearLocalPreferences: () => {
    clearSettings();
    try {
      localStorage.removeItem(PLAN_KEY);
      localStorage.removeItem(PLAN_USAGE_KEY);
      localStorage.removeItem(PENDING_PLAN_KEY);
      localStorage.removeItem('tdl.notify');
    } catch {
      /* ignore */
    }
    set({
      settings: loadSettings(),
      plan: 'free',
      planUsage: readPlanUsage(),
      pendingPlan: null,
      notifyEnabled: true,
    });
  },

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
      // Search matches note titles and content only — never tags.
      return (
        (n.title ?? '').toLowerCase().includes(q) ||
        (n.content ?? '').toLowerCase().includes(q)
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
        (n.content ?? '').toLowerCase().includes(q)
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
  get completedToday() {
    const today = dayKey(Date.now());
    return get().todos.filter((t) => t.completed && t.completedAt && dayKey(t.completedAt) === today);
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
