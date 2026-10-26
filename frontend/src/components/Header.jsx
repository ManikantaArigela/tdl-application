import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  BellOff,
  BellRing,
  CheckCheck,
  Clock3,
  Search,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { dayKey, dueTimestamp, formatDate, formatDueTime, isOverdue } from '../lib/format';

const PERMISSION_COPY = {
  granted: 'Browser alerts are allowed. Reminders also appear in-app while TDL is open.',
  default: 'Allow browser alerts to get a notification when a task is due while TDL is open.',
  denied:
    'Alerts are blocked in your browser settings. In-app reminders still work while TDL is open; allow TDL in site settings to get system alerts.',
  unsupported:
    'This browser does not support notifications. In-app reminders still appear while TDL is open.',
};

const statusTone = (permission) => {
  if (permission === 'granted') return { label: 'Allowed', tone: 'text-success' };
  if (permission === 'denied') return { label: 'Blocked', tone: 'text-danger' };
  if (permission === 'unsupported') return { label: 'Unsupported', tone: 'text-faint' };
  return { label: 'Not enabled', tone: 'text-faint' };
};

export default function Header() {
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const toggleAIPanel = useStore((s) => s.toggleAIPanel);
  const aiPanelOpen = useStore((s) => s.aiPanelOpen);
  const setAIPlannerOpen = useStore((s) => s.setAIPlannerOpen);
  const notifyEnabled = useStore((s) => s.notifyEnabled);
  const setNotifyEnabled = useStore((s) => s.setNotifyEnabled);
  const notificationPermission = useStore((s) => s.notificationPermission);
  const requestNotifications = useStore((s) => s.requestNotifications);
  const sendTestNotification = useStore((s) => s.sendTestNotification);
  const todos = useStore((s) => s.todos);
  const setActiveView = useStore((s) => s.setActiveView);

  const [notifyOpen, setNotifyOpen] = React.useState(false);
  const [tested, setTested] = React.useState(false);
  const popoverRef = React.useRef(null);
  const testedTimer = React.useRef(null);

  const today = dayKey(new Date());
  const attention = React.useMemo(() => {
    const now = Date.now();
    return todos
      .filter((todo) => !todo.completed && todo.dueDate)
      .map((todo) => {
        const due = dueTimestamp(todo);
        const overdue =
          isOverdue(todo.dueDate) ||
          (Boolean(todo.dueTime) && due !== null && due < now);
        return { ...todo, due, overdue };
      })
      .filter(
        (todo) =>
          todo.overdue ||
          dayKey(todo.dueDate) === today ||
          (todo.due !== null && todo.due <= now + 24 * 60 * 60 * 1000)
      )
      .sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity));
  }, [todos, today]);

  const status = statusTone(notificationPermission);
  const permissionCopy = PERMISSION_COPY[notificationPermission] ?? PERMISSION_COPY.default;

  React.useEffect(() => {
    if (!notifyOpen) return undefined;

    const onPointerDown = (event) => {
      if (!popoverRef.current?.contains(event.target)) setNotifyOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setNotifyOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [notifyOpen]);

  React.useEffect(
    () => () => {
      if (testedTimer.current) window.clearTimeout(testedTimer.current);
    },
    []
  );

  const toggleReminders = async () => {
    if (notifyEnabled) {
      setNotifyEnabled(false);
      return;
    }

    if (notificationPermission === 'default') {
      const result = await requestNotifications();
      if (result === 'granted') sendTestNotification();
      return;
    }

    setNotifyEnabled(true);
  };

  const sendTest = async () => {
    if (notificationPermission === 'default') {
      const result = await requestNotifications();
      if (result !== 'granted') return;
    }
    const sent = sendTestNotification();
    if (!sent) return;
    setTested(true);
    if (testedTimer.current) window.clearTimeout(testedTimer.current);
    testedTimer.current = window.setTimeout(() => setTested(false), 3200);
  };

  const viewAttention = () => {
    setNotifyOpen(false);
    setActiveView('todos');
  };

  const reminderWhen = (todo) => {
    if (todo.overdue) {
      return `Overdue · ${formatDate(todo.dueDate)}${
        todo.dueTime ? ` · ${formatDueTime(todo.dueTime)}` : ''
      }`;
    }
    if (dayKey(todo.dueDate) === today) {
      return `Today${todo.dueTime ? ` · ${formatDueTime(todo.dueTime)}` : ''}`;
    }
    return `${formatDate(todo.dueDate)}${
      todo.dueTime ? ` · ${formatDueTime(todo.dueTime)}` : ''
    }`;
  };

  return (
    <header className="sticky top-0 z-20 -mx-[calc(1rem+env(safe-area-inset-left))] flex flex-wrap items-center gap-3 border-b border-line/60 bg-canvas/85 px-[calc(1rem+env(safe-area-inset-left))] py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md md:-mx-8 md:px-8 md:pt-3">
      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search notes…"
          aria-label="Search notes"
          className="input rounded-full border-transparent bg-panel py-2.5 pl-10 pr-16 text-[13px] shadow-panel focus:border-accent/30"
        />
        <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="pointer-events-auto rounded-full p-1 text-faint hover:text-ink"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : (
            <kbd className="kbd hidden sm:inline-block">⌘K</kbd>
          )}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-0.5 rounded-full border border-line/80 bg-panel p-0.5 shadow-panel sm:gap-1 sm:p-1">
        <button
          type="button"
          className="icon-btn"
          onClick={() => setAIPlannerOpen(true)}
          aria-label="Open AI planner"
          title="AI planner"
        >
          <Wand2 className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`icon-btn ${aiPanelOpen ? 'bg-raised text-ink' : ''}`}
          onClick={toggleAIPanel}
          aria-label="Open insights"
          aria-expanded={aiPanelOpen}
        >
          <Sparkles className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>

        <div ref={popoverRef} className="relative">
          <button
            type="button"
            className={`icon-btn relative ${notifyOpen ? 'bg-raised text-ink' : ''}`}
            onClick={() => setNotifyOpen((open) => !open)}
            aria-label={`Notifications${attention.length ? `, ${attention.length} need attention` : ''}`}
            aria-expanded={notifyOpen}
            aria-haspopup="dialog"
          >
            <motion.span
              key={attention.length}
              animate={attention.length ? { rotate: [0, -10, 10, -5, 0] } : { rotate: 0 }}
              transition={{ duration: 0.45 }}
              className="inline-flex"
            >
              {notifyEnabled ? (
                <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
              ) : (
                <BellOff className="h-[18px] w-[18px]" aria-hidden="true" />
              )}
            </motion.span>
            {attention.length > 0 ? (
              <motion.span
                key={`badge-${attention.length}`}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute right-0.5 top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-pop-pink px-1 text-[9px] font-bold leading-4 text-white ring-2 ring-panel"
                aria-hidden="true"
              >
                {attention.length > 9 ? '9+' : attention.length}
              </motion.span>
            ) : (
              notifyEnabled && (
                <span
                  className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-pop-pink"
                  aria-hidden="true"
                />
              )
            )}
          </button>

          <AnimatePresence>
            {notifyOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                role="dialog"
                aria-label="Notifications"
                className="fixed inset-x-3 top-[4.35rem] z-50 max-h-[calc(100dvh-5.5rem)] origin-top overflow-y-auto rounded-2xl border border-line bg-panel p-4 shadow-lift sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <h2 className="text-sm font-semibold text-ink">Notifications</h2>
                  </div>
                  <span className={`text-[11px] font-medium ${status.tone}`}>{status.label}</span>
                </div>

                <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-line bg-raised/60 p-3">
                  <div>
                    <p className="text-xs font-medium text-ink">Remind me when tasks are due</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-faint">
                      Browser alerts when allowed, plus an in-app toast.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifyEnabled}
                    aria-label="Enable task reminders"
                    onClick={toggleReminders}
                    className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
                      notifyEnabled ? 'bg-accent' : 'bg-line'
                    }`}
                  >
                    <motion.span
                      layout
                      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${
                        notifyEnabled ? 'left-[1.375rem]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-2.5 rounded-xl border border-line bg-panel p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-ink">Needs attention</p>
                    <span className="rounded-full bg-pop-pink/10 px-2 py-0.5 text-[10px] font-bold text-pop-pink">
                      {attention.length}
                    </span>
                  </div>

                  {attention.length > 0 ? (
                    <>
                      <ul className="mt-2 space-y-1">
                        {attention.slice(0, 3).map((todo) => (
                          <li key={todo.id}>
                            <button
                              type="button"
                              onClick={viewAttention}
                              className="flex w-full items-start gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-raised"
                            >
                              <Clock3
                                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                                  todo.overdue ? 'text-danger' : 'text-warning'
                                }`}
                                aria-hidden="true"
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-[11px] font-medium text-ink">
                                  {todo.text}
                                </span>
                                <span className="mt-0.5 block text-[10px] text-faint">
                                  {reminderWhen(todo)}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={viewAttention}
                        className="mt-1.5 w-full rounded-lg py-1 text-center text-[11px] font-semibold text-accent hover:bg-lavender"
                      >
                        View all tasks
                      </button>
                    </>
                  ) : (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-success/5 px-2 py-2.5">
                      <CheckCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      <p className="text-[11px] text-muted">You’re all caught up.</p>
                    </div>
                  )}
                </div>

                <p className="mt-2.5 rounded-lg bg-raised/70 px-2.5 py-2 text-[11px] leading-relaxed text-muted">
                  {permissionCopy}
                </p>

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {notificationPermission === 'default' && (
                    <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={sendTest}>
                      Allow browser alerts
                    </button>
                  )}
                  {notificationPermission === 'granted' && (
                    <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={sendTest}>
                      {tested ? 'Test sent' : 'Send test'}
                    </button>
                  )}
                  {notificationPermission === 'denied' && (
                    <span className="text-[10px] font-medium text-danger">
                      Update site permissions to enable alerts.
                    </span>
                  )}
                  {!notifyEnabled && (
                    <button
                      type="button"
                      onClick={() => setNotifyEnabled(true)}
                      className="ml-auto text-[10px] font-semibold text-accent hover:underline"
                    >
                      Keep in-app reminders on
                    </button>
                  )}
                </div>

                <p className="mt-2 text-[10px] leading-relaxed text-faint">
                  On iPhone, add TDL to your Home Screen, then allow notifications. In-app
                  reminders are included on every plan.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
