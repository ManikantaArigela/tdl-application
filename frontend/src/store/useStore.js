import { create } from 'zustand';
import { api } from '../api';
import { advanceDueDate, dayKey } from '../lib/format';
import {
  showSystemNotification,
  subscribeToPush,
  currentPushSubscription,
} from '../lib/notifications';
import { auth } from '../lib/auth';
import { isPremiumPlan, normalizePlan } from '../lib/plans';
import { loadSettings, saveSettings, clearSettings, applyTheme } from '../lib/settings';
import { normalizeTag, noteMatchesFilters } from '../lib/notes';
import { toast } from './useToastStore';

// The current theme lives in tdl.settings. Clear the preference keys left
// behind by the older theme/accent switchers so they cannot resurface later.
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

const browserTimezone =
  typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' : 'UTC';

const emptyReminderSettings = {
  enabled: false,
  pushEnabled: true,
  sipUri: '',
  voiceLanguage: 'en',
  timezone: browserTimezone,
  quietStart: '21:00',
  quietEnd: '08:00',
  maxRetries: 2,
  consentAt: null,
  sipVerified: false,
};

const emptyWorkspace = {
  notes: [],
  todos: [],
  trashedNotes: [],
  trashedTodos: [],
  loaded: false,
  initializing: false,
  syncing: false,
  syncError: null,
  activeView: 'notes',
  selectedNoteId: null,
  focusedTodoId: null,
  searchQuery: '',
  activeTags: [],
  commandPaletteOpen: false,
  quickCaptureOpen: false,
  quickCaptureType: 'note',
  sidebarOpen: false,
  aiPanelOpen: false,
  aiPlannerOpen: false,
  aiSummaryOpen: false,
  exportOpen: false,
  planDialogOpen: false,
  planBusy: false,
  planError: null,
  profile: emptyProfile,
  reminderSettings: emptyReminderSettings,
  reminderEvents: [],
  voiceStatus: null,
  reminderBusy: false,
  reminderError: null,
  pushSubscribed: false,
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


/** The shortest useful task text from a note: title first, then its first line. */
function taskTextForNote(note) {
  const title = String(note?.title ?? '').trim();
  if (title) return title.slice(0, 1000);

  const firstLine = String(note?.content ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s{0,3}(#{1,6}|[-*+]|\d+\.)\s+/, '').trim())
    .find(Boolean);

  return (firstLine || 'Untitled note').slice(0, 1000);
}


export const useStore = create((set, get) => ({
  // ---- Data ----
  notes: [],
  todos: [],
  trashedNotes: [],
  trashedTodos: [],
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
  focusedTodoId: null,
  searchQuery: '',
  activeTags: [],
  commandPaletteOpen: false,
  quickCaptureOpen: false,
  quickCaptureType: 'note',
  sidebarOpen: false,
  aiPanelOpen: false,
  aiPlannerOpen: false,
  aiSummaryOpen: false,
  exportOpen: false,
  planDialogOpen: false,
  planBusy: false,
  planError: null,
  pendingPlan: readPreference(PENDING_PLAN_KEY, null),
  plan: readPlan(),
  planUsage: readPlanUsage(),
  profile: emptyProfile,
  profileBusy: false,
  profileError: null,
  settings: loadSettings(),
  notifyEnabled: initialNotifyEnabled,
  notificationPermission: initialPermission,
  reminderSettings: emptyReminderSettings,
  reminderEvents: [],
  voiceStatus: null,
  reminderBusy: false,
  reminderError: null,
  pushSubscribed: false,

  // ---- Auth ----
  initAuth: async () => {
    if (authListenerAttached) return;
    authListenerAttached = true;

    // The API client clears the stored token and fires this when a request
    // returns 401 (expired or revoked session).
    if (typeof window !== 'undefined') {
      window.addEventListener('nova:unauthorized', () => {
        toast.clear();
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

      const nextPlan = user?.plan ? normalizePlan(user.plan) : get().plan;
      storePreference(PLAN_KEY, nextPlan);
      set({
        session: { user },
        user,
        profile: profileOf(user),
        plan: nextPlan,
        planBusy: false,
        planError: null,
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
      const nextPlan = normalizePlan(user.plan);
      storePreference(PLAN_KEY, nextPlan);
      set({
        session: { user },
        user,
        profile: profileOf(user),
        plan: nextPlan,
        planBusy: false,
        planError: null,
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
      let nextUser = user;
      let nextPlan = normalizePlan(user.plan);

      // The landing page lets visitors choose a plan before creating an account.
      // Persist that choice on the new account so gating is server-enforced.
      if (pending) {
        const chosen = normalizePlan(pending);
        try {
          const result = await api.updatePlan(chosen);
          nextUser = result.user ?? { ...user, plan: chosen };
          nextPlan = normalizePlan(nextUser.plan);
        } catch {
          nextPlan = normalizePlan(user.plan);
        }
        try {
          localStorage.removeItem(PENDING_PLAN_KEY);
        } catch {
          /* ignore */
        }
      }

      storePreference(PLAN_KEY, nextPlan);
      set({
        session: { user: nextUser },
        user: nextUser,
        profile: profileOf(nextUser),
        plan: nextPlan,
        planBusy: false,
        planError: null,
        authBusy: false,
        authError: null,
        pendingPlan: null,
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
      // Stop this browser receiving the departing account's pushes.
      const subscription = await currentPushSubscription().catch(() => null);
      if (subscription) await api.unsubscribePush(subscription.endpoint).catch(() => {});
    } catch {
      /* best-effort */
    }
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
    toast.clear();
  },

  clearAuthMessages: () => set({ authError: null, authNotice: null }),

  // ---- Init ----
  init: async () => {
    if (get().initializing) return;
    if (!get().session) return;

    const userId = get().user?.id;
    const nextPlan = get().user?.plan ? normalizePlan(get().user.plan) : get().plan;
    storePreference(PLAN_KEY, nextPlan);
    set({ initializing: true, plan: nextPlan });
    try {
      const [notes, todos, trashedNotes, trashedTodos, reminder] = await Promise.all([
        api.getNotes(),
        api.getTodos(),
        api.getTrashedNotes(),
        api.getTrashedTodos(),
        // Older backends may not expose reminders yet; never block the app.
        api.getReminderSettings().catch(() => null),
      ]);
      // A sign-out or account switch may have happened while the request was in flight.
      if (get().user?.id !== userId) {
        set({ initializing: false });
        return;
      }
      set({
        notes,
        todos,
        trashedNotes,
        trashedTodos,
        loaded: true,
        initializing: false,
        syncError: null,
        ...(reminder?.settings
          ? { reminderSettings: reminder.settings, voiceStatus: reminder.voice ?? null }
          : {}),
      });

      // Respect the in-app toggle: browser permission alone is not consent to
      // re-enable push after the user turned reminders off.
      if (
        isPremiumPlan(get().plan) &&
        get().notifyEnabled &&
        get().notificationPermission === 'granted'
      ) {
        get().enablePush();
      }
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
      const [notes, todos, trashedNotes, trashedTodos] = await Promise.all([
        api.getNotes(),
        api.getTodos(),
        api.getTrashedNotes(),
        api.getTrashedTodos(),
      ]);
      set({ notes, todos, trashedNotes, trashedTodos, syncError: null });
      return { notes, todos, trashedNotes, trashedTodos };
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

  deleteNote: async (id, { notify = true } = {}) => {
    const note = get().notes.find((item) => item.id === id);
    try {
      await api.deleteNote(id);
      const trashed = note
        ? { ...note, trashed: true, trashedAt: Date.now() }
        : null;
      set((state) => ({
        notes: state.notes.filter((n) => n.id !== id),
        trashedNotes: trashed ? [trashed, ...state.trashedNotes] : state.trashedNotes,
        selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId,
        syncError: null,
      }));
      if (notify && note) {
        toast.show({
          title: 'Note moved to Trash',
          description: note.title?.trim() || 'Untitled note',
          actionLabel: 'Undo',
          onAction: () => get().restoreNote(id),
        });
      }
      return true;
    } catch (err) {
      set({ syncError: err.message });
      return false;
    }
  },

  restoreNote: async (id, { notify = true } = {}) => {
    try {
      const restored = await api.restoreNote(id);
      set((state) => ({
        notes: [restored, ...state.notes.filter((note) => note.id !== id)].sort(
          (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
        ),
        trashedNotes: state.trashedNotes.filter((note) => note.id !== id),
        syncError: null,
      }));
      if (notify) {
        toast.show({
          title: 'Note restored',
          description: restored.title?.trim() || 'Untitled note',
          tone: 'success',
          actionLabel: 'Open',
          onAction: () => {
            get().setActiveView('notes');
            get().selectNote(restored.id);
          },
        });
      }
      return restored;
    } catch (err) {
      set({ syncError: err.message });
      return null;
    }
  },

  permanentlyDeleteNote: async (id) => {
    try {
      await api.permanentlyDeleteNote(id);
      set((state) => ({
        trashedNotes: state.trashedNotes.filter((note) => note.id !== id),
        syncError: null,
      }));
      toast.show({ title: 'Note permanently deleted', tone: 'danger' });
      return true;
    } catch (err) {
      set({ syncError: err.message });
      return false;
    }
  },

  emptyTrash: async () => {
    const count = get().trashedNotes.length + get().trashedTodos.length;
    try {
      await Promise.all([api.emptyNoteTrash(), api.emptyTodoTrash()]);
      set({ trashedNotes: [], trashedTodos: [], syncError: null });
      toast.show({
        title: 'Trash emptied',
        description:
          count > 0 ? `${count} ${count === 1 ? 'item' : 'items'} permanently deleted.` : '',
        tone: 'danger',
      });
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

  /** Create a task from the note title (or first non-empty line). */
  createTaskFromNote: async (note) => {
    if (!note) return null;
    const text = taskTextForNote(note);
    const created = await get().addTodo({
      text,
      priority: get().settings.defaultPriority,
      completed: false,
    });

    if (created) {
      toast.show({
        title: 'Task created from note',
        description: text,
        tone: 'success',
        actionLabel: 'View',
        onAction: () => get().focusTodo(created.id),
      });
    }
    return created;
  },

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

  deleteTodo: async (id, { notify = true } = {}) => {
    const todo = get().todos.find((item) => item.id === id);
    try {
      await api.deleteTodo(id);
      const trashed = todo
        ? { ...todo, trashed: true, trashedAt: Date.now() }
        : null;
      set((state) => ({
        todos: state.todos.filter((t) => t.id !== id),
        trashedTodos: trashed ? [trashed, ...state.trashedTodos] : state.trashedTodos,
        focusedTodoId: state.focusedTodoId === id ? null : state.focusedTodoId,
        syncError: null,
      }));
      if (notify && todo) {
        toast.show({
          title: 'Task moved to Trash',
          description: todo.text,
          actionLabel: 'Undo',
          onAction: () => get().restoreTodo(id),
        });
      }
      return true;
    } catch (err) {
      set({ syncError: err.message });
      return false;
    }
  },

  restoreTodo: async (id, { notify = true } = {}) => {
    try {
      const restored = await api.restoreTodo(id);
      set((state) => ({
        todos: [restored, ...state.todos.filter((todo) => todo.id !== id)],
        trashedTodos: state.trashedTodos.filter((todo) => todo.id !== id),
        syncError: null,
      }));
      if (notify) {
        toast.show({
          title: 'Task restored',
          description: restored.text,
          tone: 'success',
          actionLabel: 'View',
          onAction: () => get().focusTodo(restored.id),
        });
      }
      return restored;
    } catch (err) {
      set({ syncError: err.message });
      return null;
    }
  },

  permanentlyDeleteTodo: async (id) => {
    try {
      await api.permanentlyDeleteTodo(id);
      set((state) => ({
        trashedTodos: state.trashedTodos.filter((todo) => todo.id !== id),
        syncError: null,
      }));
      toast.show({ title: 'Task permanently deleted', tone: 'danger' });
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
  setActiveView: (view) =>
    set({ activeView: view, selectedNoteId: null, focusedTodoId: null }),
  focusTodo: (id) =>
    set({ activeView: 'todos', selectedNoteId: null, focusedTodoId: id }),
  clearFocusedTodo: () => set({ focusedTodoId: null }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  toggleTag: (tag) => {
    const next = normalizeTag(tag);
    if (!next) return;
    set((state) => ({
      activeTags: state.activeTags.includes(next)
        ? state.activeTags.filter((active) => active !== next)
        : [...state.activeTags, next],
    }));
  },
  clearTags: () => set({ activeTags: [] }),
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
  setPlan: async (planId) => {
    const next = normalizePlan(planId);
    const previous = get().plan;
    if (next === previous) {
      set({ planDialogOpen: false, planError: null });
      return { error: null };
    }

    set({ planBusy: true, planError: null });
    try {
      // Plan is account-level now, so wait for the server before unlocking UI.
      const { user } = await api.updatePlan(next);
      const serverPlan = normalizePlan(user?.plan ?? next);
      storePreference(PLAN_KEY, serverPlan);
      set({
        plan: serverPlan,
        user,
        profile: profileOf(user),
        planBusy: false,
        planError: null,
        planDialogOpen: false,
        ...(serverPlan !== 'premium'
          ? {
              reminderSettings: { ...get().reminderSettings, enabled: false },
              pushSubscribed: false,
            }
          : {}),
      });
      return { error: null };
    } catch (error) {
      storePreference(PLAN_KEY, previous);
      set({ planBusy: false, planError: error.message });
      return { error };
    }
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
      applyTheme(next.theme);
      return { settings: next };
    });
  },
  toggleTheme: () => {
    const next = get().settings.theme === 'dark' ? 'light' : 'dark';
    get().setSettings({ theme: next });
  },
  /** Privacy: wipe local preferences. The account plan stays server-side. */
  clearLocalPreferences: () => {
    clearSettings();
    try {
      localStorage.removeItem(PLAN_USAGE_KEY);
      localStorage.removeItem(PENDING_PLAN_KEY);
      localStorage.removeItem('tdl.notify');
    } catch {
      /* ignore */
    }
    const settings = loadSettings();
    applyTheme(settings.theme);
    set({
      settings,
      plan: normalizePlan(get().user?.plan ?? get().plan),
      planBusy: false,
      planError: null,
      planUsage: readPlanUsage(),
      pendingPlan: null,
      notifyEnabled: true,
      activeTags: [],
      searchQuery: '',
    });
  },

  // ---- Notifications ----
  setNotifyEnabled: (enabled) => {
    // Reminders are Premium-only. Disabling is always allowed.
    if (enabled && !isPremiumPlan(get().plan)) {
      set({ notifyEnabled: false });
      return;
    }
    storePreference('tdl.notify', enabled ? 'on' : 'off');
    set({
      notifyEnabled: enabled,
      ...(enabled
        ? {}
        : {
            pushSubscribed: false,
            reminderSettings: { ...get().reminderSettings, pushEnabled: false },
          }),
    });
    if (!get().user) return;
    // Keep server-side push in step with the local toggle. Enabling also
    // re-registers this browser, so the switch works without a page reload.
    if (enabled) {
      get().enablePush();
    } else {
      api.updateReminderSettings({ pushEnabled: false }).catch(() => {});
      // Also remove the server-side subscription so a stale settings update
      // cannot keep delivering pushes after the switch is off.
      currentPushSubscription()
        .then((subscription) => {
          if (subscription) api.unsubscribePush(subscription.endpoint).catch(() => {});
        })
        .catch(() => {});
    }
  },
  requestNotifications: async () => {
    if (!isPremiumPlan(get().plan)) return 'premium';
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
        get().enablePush();
      }
      return result;
    } catch {
      return 'error';
    }
  },
  sendTestNotification: () => {
    if (!isPremiumPlan(get().plan)) return false;
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

  // ---- Voice reminders (account-level) ----
  saveReminderSettings: async (patch) => {
    set({ reminderBusy: true, reminderError: null });
    try {
      const { settings, voice } = await api.updateReminderSettings(patch);
      set({
        reminderSettings: { ...get().reminderSettings, ...settings },
        voiceStatus: voice ?? get().voiceStatus,
        reminderBusy: false,
        reminderError: null,
      });
      return { error: null, settings };
    } catch (error) {
      set({ reminderBusy: false, reminderError: error.message });
      return { error };
    }
  },

  startSipVerification: async () => {
    set({ reminderBusy: true, reminderError: null });
    try {
      const result = await api.startSipVerification();
      set({ reminderBusy: false });
      return { error: null, ...result };
    } catch (error) {
      set({ reminderBusy: false, reminderError: error.message });
      return { error };
    }
  },

  confirmSipVerification: async (code) => {
    set({ reminderBusy: true, reminderError: null });
    try {
      const { user, settings } = await api.confirmSipVerification(code);
      set({
        user,
        profile: profileOf(user),
        reminderSettings: { ...get().reminderSettings, ...settings },
        reminderBusy: false,
      });
      return { error: null };
    } catch (error) {
      set({ reminderBusy: false, reminderError: error.message });
      return { error };
    }
  },

  sendTestCall: async () => {
    set({ reminderBusy: true, reminderError: null });
    try {
      const result = await api.sendTestCall();
      set({ reminderBusy: false });
      return { error: null, ...result };
    } catch (error) {
      set({ reminderBusy: false, reminderError: error.message });
      return { error };
    }
  },

  loadReminderEvents: async () => {
    if (!isPremiumPlan(get().plan)) {
      set({ reminderEvents: [] });
      return [];
    }
    try {
      const { events } = await api.getReminderEvents();
      set({ reminderEvents: events });
      return events;
    } catch {
      return [];
    }
  },

  /** Opt this browser into server-sent push (works with the app closed). */
  enablePush: async () => {
    if (!isPremiumPlan(get().plan)) return null;
    try {
      if (typeof window === 'undefined' || !('Notification' in window)) return null;
      if (window.Notification.permission === 'default') {
        const permission = await window.Notification.requestPermission();
        set({ notificationPermission: permission });
        if (permission !== 'granted') return null;
      }
      if (window.Notification.permission !== 'granted') return null;

      const { publicKey } = await api.getPushKey();
      const subscription = await subscribeToPush(publicKey);
      if (!subscription) return null;

      await api.subscribePush({
        subscription: subscription.toJSON(),
        timezone:
          typeof Intl !== 'undefined'
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : undefined,
      });
      await api.updateReminderSettings({ pushEnabled: true, timezone: browserTimezone }).catch(() => {});
      set({ pushSubscribed: true, reminderSettings: { ...get().reminderSettings, pushEnabled: true } });
      return subscription;
    } catch {
      return null;
    }
  },

  syncPushSubscription: async () => {
    try {
      const subscription = await currentPushSubscription();
      set({ pushSubscribed: Boolean(subscription) });
      return subscription;
    } catch {
      return null;
    }
  },

  // ---- Derived ----
  get visibleNotes() {
    const { notes, searchQuery, activeTags } = get();
    const filters = { query: searchQuery, tags: activeTags };
    return notes.filter((n) => !n.archived && noteMatchesFilters(n, filters));
  },
  get archivedNotes() {
    const { notes, searchQuery, activeTags } = get();
    const filters = { query: searchQuery, tags: activeTags };
    return notes.filter((n) => n.archived && noteMatchesFilters(n, filters));
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
