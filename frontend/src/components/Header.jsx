import React from 'react';
import { Bell, BellOff, Menu, Search, Sparkles, Wand2, X } from 'lucide-react';
import { useStore } from '../store/useStore';

const PERMISSION_COPY = {
  granted: 'Browser notifications are allowed. Reminders also appear in the app.',
  default: 'Allow notifications to get an alert when a task is due.',
  denied:
    'Notifications are blocked in your browser settings. In-app reminders still work; allow TDL in site settings to get system alerts.',
  unsupported:
    'This browser does not support notifications. In-app reminders still appear while TDL is open.',
};

export default function Header() {
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const toggleAIPanel = useStore((s) => s.toggleAIPanel);
  const aiPanelOpen = useStore((s) => s.aiPanelOpen);
  const setAIPlannerOpen = useStore((s) => s.setAIPlannerOpen);
  const notifyEnabled = useStore((s) => s.notifyEnabled);
  const setNotifyEnabled = useStore((s) => s.setNotifyEnabled);
  const notificationPermission = useStore((s) => s.notificationPermission);
  const requestNotifications = useStore((s) => s.requestNotifications);
  const sendTestNotification = useStore((s) => s.sendTestNotification);

  const [notifyOpen, setNotifyOpen] = React.useState(false);
  const popoverRef = React.useRef(null);

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

  const permissionCopy = PERMISSION_COPY[notificationPermission] ?? PERMISSION_COPY.default;

  return (
    <header className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-line/70 bg-canvas/85 px-4 py-3 backdrop-blur-md md:-mx-8 md:px-8">
      <button
        type="button"
        className="icon-btn md:hidden"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open navigation"
        aria-expanded={sidebarOpen}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search notes…"
          aria-label="Search notes"
          className="input py-2 pl-9 pr-16 text-[13px]"
        />
        <div className="pointer-events-none absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="pointer-events-auto rounded p-1 text-faint hover:text-ink"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : (
            <kbd className="kbd hidden sm:inline-block">⌘K</kbd>
          )}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1">
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
            aria-label="Notification settings"
            aria-expanded={notifyOpen}
          >
            {notifyEnabled ? (
              <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
            ) : (
              <BellOff className="h-[18px] w-[18px]" aria-hidden="true" />
            )}
            {notifyEnabled && (
              <span
                className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent"
                aria-hidden="true"
              />
            )}
          </button>

          {notifyOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-[19rem] rounded-xl border border-line bg-panel p-4 shadow-lift">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">Reminders</h2>
                <span
                  className={`text-[11px] font-medium ${
                    notificationPermission === 'granted'
                      ? 'text-success'
                      : notificationPermission === 'denied'
                      ? 'text-danger'
                      : 'text-faint'
                  }`}
                >
                  {notificationPermission === 'granted'
                    ? 'Allowed'
                    : notificationPermission === 'denied'
                    ? 'Blocked'
                    : notificationPermission === 'unsupported'
                    ? 'Unsupported'
                    : 'Not enabled'}
                </span>
              </div>

              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-ink">Remind me about due tasks</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-faint">
                    From 10 minutes before the due time.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifyEnabled}
                  aria-label="Enable task reminders"
                  onClick={() => setNotifyEnabled(!notifyEnabled)}
                  className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
                    notifyEnabled ? 'bg-accent' : 'bg-line'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      notifyEnabled ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <p className="mt-3 rounded-lg bg-raised/70 px-2.5 py-2 text-[11px] leading-relaxed text-muted">
                {permissionCopy}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {notificationPermission === 'default' && (
                  <button
                    type="button"
                    className="btn-primary px-3 py-1.5 text-xs"
                    onClick={async () => {
                      const result = await requestNotifications();
                      if (result === 'granted') sendTestNotification();
                    }}
                  >
                    Enable browser notifications
                  </button>
                )}
                {notificationPermission === 'granted' && (
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 text-xs"
                    onClick={() => sendTestNotification()}
                  >
                    Send test
                  </button>
                )}
              </div>

              <p className="mt-2 text-[10px] leading-relaxed text-faint">
                On iPhone, add TDL to your Home Screen to allow notifications.
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
