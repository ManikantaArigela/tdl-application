import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { dueTimestamp, formatDate, formatDueTime } from '../lib/format';
import { showSystemNotification } from '../lib/notifications';

const STORAGE_KEY = 'tdl.fired-reminders';
const CHECK_MS = 30_000;
// Remind from 10 minutes before the due moment until after it.
const WINDOW_BEFORE_MS = 10 * 60 * 1000;
const WINDOW_AFTER_MS = 2 * 60 * 60 * 1000;
const DATE_ONLY_AFTER_MS = 10 * 60 * 60 * 1000;
const TOAST_TTL_MS = 30_000;

function loadFired() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function saveFired(fired) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fired));
  } catch {
    /* reminders are best-effort */
  }
}

const dueLabel = (reminder) =>
  `${formatDate(reminder.dueDate)}${reminder.dueTime ? ` · ${formatDueTime(reminder.dueTime)}` : ''}`;

/**
 * Checks open tasks on an interval and raises one reminder per due moment.
 * Works with the Notification API when permission is granted, and always
 * falls back to an in-app toast so reminders are never silently lost.
 */
export default function ReminderCenter() {
  const todos = useStore((s) => s.todos);
  const notifyEnabled = useStore((s) => s.notifyEnabled);
  const notificationPermission = useStore((s) => s.notificationPermission);
  const setActiveView = useStore((s) => s.setActiveView);

  const [reminders, setReminders] = React.useState([]);

  // Refs keep the interval stable while reading the latest store values.
  const todosRef = React.useRef(todos);
  todosRef.current = todos;
  const enabledRef = React.useRef(notifyEnabled);
  enabledRef.current = notifyEnabled;
  const permissionRef = React.useRef(notificationPermission);
  permissionRef.current = notificationPermission;

  const dismiss = React.useCallback((key) => {
    setReminders((current) => current.filter((reminder) => reminder.key !== key));
  }, []);

  React.useEffect(() => {
    const fired = loadFired();

    const check = () => {
      if (!enabledRef.current) return;

      const now = Date.now();
      const fresh = [];

      for (const todo of todosRef.current) {
        if (todo.completed || !todo.dueDate) continue;
        const ts = dueTimestamp(todo);
        if (ts === null) continue;
        // Date-only tasks become eligible at 9:00 and stay eligible through the
        // day; timed tasks get a short run-up before the due moment.
        const before = todo.dueTime ? WINDOW_BEFORE_MS : 0;
        const after = todo.dueTime ? WINDOW_AFTER_MS : DATE_ONLY_AFTER_MS;
        if (now < ts - before || now > ts + after) continue;

        const key = `${todo.id}:${todo.dueDate}:${todo.dueTime ?? ''}`;
        if (fired[key]) continue;

        fired[key] = now;
        fresh.push({
          key,
          text: todo.text,
          dueDate: todo.dueDate,
          dueTime: todo.dueTime,
          ts,
        });
      }

      if (fresh.length === 0) return;

      // Drop entries older than a week so the map cannot grow forever.
      const cutoff = now - 7 * 24 * 60 * 60 * 1000;
      Object.keys(fired).forEach((key) => {
        if (!Number.isFinite(fired[key]) || fired[key] < cutoff) delete fired[key];
      });
      saveFired(fired);

      setReminders((current) => [...fresh, ...current].slice(0, 3));

      fresh.forEach((reminder) => {
        window.setTimeout(() => dismiss(reminder.key), TOAST_TTL_MS);
        if (permissionRef.current !== 'granted') return;
        showSystemNotification('Task due', {
          body: `${reminder.text} · ${dueLabel(reminder)}`,
          tag: reminder.key,
          data: { taskId: reminder.key },
        });
      });
    };

    check();
    const timer = window.setInterval(check, CHECK_MS);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [dismiss]);

  const openTasks = () => {
    setReminders([]);
    setActiveView('todos');
  };

  return (
    <div
      className="pointer-events-none fixed bottom-24 left-4 z-40 flex w-[min(92vw,22rem)] flex-col gap-2 md:bottom-8 md:left-8"
      aria-live="polite"
      aria-label="Task reminders"
    >
      <AnimatePresence initial={false}>
        {reminders.map((reminder) => (
          <motion.div
            key={reminder.key}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            className="pointer-events-auto panel-raised flex items-start gap-3 border-warning/30 p-3.5"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
              <BellRing className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-warning">
                Task due
              </p>
              <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-ink">{reminder.text}</p>
              <p className="mt-0.5 text-[11px] text-faint">{dueLabel(reminder)}</p>
              <button
                type="button"
                onClick={openTasks}
                className="mt-1.5 text-[11px] font-medium text-accent hover:underline"
              >
                View tasks
              </button>
            </div>
            <button
              type="button"
              onClick={() => dismiss(reminder.key)}
              className="icon-btn h-7 w-7 shrink-0"
              aria-label="Dismiss reminder"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
