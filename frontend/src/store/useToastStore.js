import { create } from 'zustand';

/**
 * Small app-wide feedback queue. It is intentionally separate from
 * ReminderCenter: reminders own due-date alerts, while these toasts announce
 * completed actions and offer a one-tap Undo.
 */
const MAX_TOASTS = 3;
const DEFAULT_DURATION = 7000;

let nextId = 1;
const timers = new Map();

function clearTimer(id) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
}

export const useToastStore = create((set) => ({
  toasts: [],

  showToast: (toast = {}) => {
    const id = `toast-${nextId++}`;
    const duration = Number.isFinite(toast.duration) ? toast.duration : DEFAULT_DURATION;
    const entry = {
      id,
      tone: toast.tone ?? 'info',
      title: toast.title ?? '',
      description: toast.description ?? '',
      actionLabel: toast.actionLabel ?? '',
      onAction: typeof toast.onAction === 'function' ? toast.onAction : null,
      duration,
    };

    set((state) => ({
      toasts: [...state.toasts, entry].slice(-MAX_TOASTS),
    }));

    if (duration > 0 && typeof window !== 'undefined') {
      clearTimer(id);
      timers.set(
        id,
        window.setTimeout(() => {
          timers.delete(id);
          set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
        }, duration)
      );
    }

    return id;
  },

  dismissToast: (id) => {
    clearTimer(id);
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },

  clearToasts: () => {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    set({ toasts: [] });
  },
}));

/** Imperative helper for stores/components that only need to fire a toast. */
export const toast = {
  show: (options) => useToastStore.getState().showToast(options),
  dismiss: (id) => useToastStore.getState().dismissToast(id),
  clear: () => useToastStore.getState().clearToasts(),
};
