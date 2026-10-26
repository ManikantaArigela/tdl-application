import React from 'react';
import {
  Archive,
  BarChart3,
  BellRing,
  Check,
  ChevronRight,
  Compass,
  Crown,
  Download,
  Flame,
  Gauge,
  ListChecks,
  Loader2,
  LogOut,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wand2,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import Toggle from '../components/Toggle';
import { Dropdown } from '../components/FormControls';
import { DENSITIES } from '../lib/settings';
import { getAvatar } from '../lib/avatars';
import { getPlan } from '../lib/plans';

const NAME_LIMIT = 80;
const BIO_LIMIT = 280;

const PERMISSION_COPY = {
  granted: 'Browser alerts are allowed.',
  default: 'Browser alerts are not enabled yet.',
  denied: 'Alerts are blocked in your browser settings; in-app reminders still work.',
  unsupported: 'This browser does not support system notifications.',
};

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="panel-raised rounded-3xl p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
      </div>
      <div className="mt-3 divide-y divide-line">{children}</div>
    </section>
  );
}

export default function ProfileView() {
  const user = useStore((s) => s.user);
  const profile = useStore((s) => s.profile);
  const profileBusy = useStore((s) => s.profileBusy);
  const profileError = useStore((s) => s.profileError);
  const updateProfile = useStore((s) => s.updateProfile);
  const clearProfileError = useStore((s) => s.clearProfileError);
  const streak = useStore((s) => s.streak);
  const completedThisWeek = useStore((s) => s.completedThisWeek);
  const pendingTodos = useStore((s) => s.pendingTodos);

  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const clearLocalPreferences = useStore((s) => s.clearLocalPreferences);
  const notifyEnabled = useStore((s) => s.notifyEnabled);
  const setNotifyEnabled = useStore((s) => s.setNotifyEnabled);
  const notificationPermission = useStore((s) => s.notificationPermission);
  const requestNotifications = useStore((s) => s.requestNotifications);
  const sendTestNotification = useStore((s) => s.sendTestNotification);
  const setExportOpen = useStore((s) => s.setExportOpen);
  const signOut = useStore((s) => s.signOut);
  const authBusy = useStore((s) => s.authBusy);
  const setActiveView = useStore((s) => s.setActiveView);
  const setPlanDialogOpen = useStore((s) => s.setPlanDialogOpen);
  const setAIPlannerOpen = useStore((s) => s.setAIPlannerOpen);
  const plan = useStore((s) => s.plan);
  const planName = getPlan(plan).name;

  const workspaceLinks = [
    { key: 'archive', label: 'Archive', icon: Archive, onSelect: () => setActiveView('archive') },
    { key: 'analytics', label: 'Analytics', icon: BarChart3, onSelect: () => setActiveView('analytics') },
    {
      key: 'plans',
      label: 'Plans',
      icon: Crown,
      tone: 'text-pop-pink',
      badge: planName,
      onSelect: () => setPlanDialogOpen(true),
    },
    {
      key: 'ai-planner',
      label: 'AI planner',
      icon: Wand2,
      onSelect: () => setAIPlannerOpen(true),
    },
    {
      key: 'export',
      label: 'Export as Markdown',
      icon: Download,
      wide: true,
      onSelect: () => setExportOpen(true),
    },
  ];

  const [name, setName] = React.useState(profile?.name ?? '');
  const [bio, setBio] = React.useState(profile?.bio ?? '');
  const [saved, setSaved] = React.useState(false);
  const [confirmingWipe, setConfirmingWipe] = React.useState(false);
  const [testSent, setTestSent] = React.useState(false);

  // Sync the form when the persisted profile changes (sign-in, other tab).
  React.useEffect(() => {
    setName(profile?.name ?? '');
    setBio(profile?.bio ?? '');
  }, [profile?.name, profile?.bio]);

  const dirty = name !== (profile?.name ?? '') || bio !== (profile?.bio ?? '');
  const canSave = !profileBusy && dirty && name.trim().length <= NAME_LIMIT;

  React.useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2200);
    return () => clearTimeout(timer);
  }, [saved]);

  React.useEffect(() => {
    if (!testSent) return;
    const timer = setTimeout(() => setTestSent(false), 2200);
    return () => clearTimeout(timer);
  }, [testSent]);

  const save = async (event) => {
    event.preventDefault();
    if (!canSave) return;
    const { error } = await updateProfile({
      name: name.trim(),
      bio: bio.trim(),
      avatar: profile?.avatar ?? '', // avatar choice removed; keep whatever is stored
    });
    if (!error) setSaved(true);
  };

  const sendTest = () => {
    if (sendTestNotification()) setTestSent(true);
  };

  const storedAvatar = getAvatar(profile?.avatar);
  const initials = (name.trim() || user?.email || '?').charAt(0).toUpperCase();

  const stats = [
    { label: 'Day streak', value: streak, icon: Flame, tone: 'text-warning' },
    { label: 'Done this week', value: completedThisWeek, icon: Check, tone: 'text-success' },
    { label: 'Open tasks', value: pendingTodos.length, icon: Sparkles, tone: 'text-accent' },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-ink">
          <UserRound className="h-6 w-6 text-accent" aria-hidden="true" />
          Profile &amp; Settings
        </h1>
        <p className="mt-1 text-sm text-muted">
          Your account details and app preferences in one place.
        </p>
      </header>

      {/* ---- Identity ------------------------------------------------------- */}
      <form onSubmit={save} className="panel-raised rounded-3xl p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-ink">Identity</h2>

        <div className="mt-4 flex items-center gap-4">
          <span
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${
              storedAvatar ? storedAvatar.gradient : 'from-accent to-pop-pink'
            } text-xl font-bold uppercase text-white shadow-lift`}
            aria-hidden="true"
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {name.trim() || 'No display name yet'}
            </p>
            <p className="truncate text-xs text-faint">{user?.email}</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="profile-name" className="mb-1.5 block text-xs font-semibold text-muted">
              Display name
            </label>
            <input
              id="profile-name"
              type="text"
              value={name}
              maxLength={NAME_LIMIT}
              onChange={(event) => setName(event.target.value)}
              placeholder="What should we call you?"
              autoComplete="name"
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <p className="mt-1 text-[11px] text-faint">
              {name.trim().length}/{NAME_LIMIT}
            </p>
          </div>

          <div>
            <label htmlFor="profile-bio" className="mb-1.5 block text-xs font-semibold text-muted">
              Bio
            </label>
            <textarea
              id="profile-bio"
              value={bio}
              maxLength={BIO_LIMIT}
              onChange={(event) => setBio(event.target.value)}
              rows={3}
              placeholder="A line or two about yourself"
              className="w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <p className="mt-1 text-[11px] text-faint">
              {bio.length}/{BIO_LIMIT}
            </p>
          </div>
        </div>

        {profileError && (
          <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-ink">
            {profileError}
          </p>
        )}

        <div className="mt-4 flex items-center justify-end gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-success" role="status">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Profile saved
            </span>
          )}
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              clearProfileError();
              setName(profile?.name ?? '');
              setBio(profile?.bio ?? '');
            }}
            disabled={!dirty || profileBusy}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary min-w-28" disabled={!canSave}>
            {profileBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              'Save changes'
            )}
          </button>
        </div>
      </form>

      {/* ---- Productivity snapshot ------------------------------------------ */}
      <section className="grid grid-cols-3 gap-3" aria-label="Productivity snapshot">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="panel-raised rounded-2xl p-4 text-center">
              <Icon className={`mx-auto h-4 w-4 ${stat.tone}`} aria-hidden="true" />
              <p className="mt-1.5 text-xl font-semibold text-ink">{stat.value}</p>
              <p className="text-[11px] text-faint">{stat.label}</p>
            </div>
          );
        })}
      </section>

      {/* ---- Workspace shortcuts --------------------------------------------- */}
      <Section
        icon={Compass}
        title="Workspace"
        description="Every area and tool in TDL, one tap away."
      >
        <div className="grid grid-cols-2 gap-2 py-3">
          {workspaceLinks.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={item.onSelect}
                className={`flex items-center gap-2.5 rounded-xl border border-line bg-raised/50 px-3 py-2.5 text-left text-sm font-medium text-ink transition-colors duration-120 hover:border-accent/40 hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${
                  item.wide ? 'col-span-2' : ''
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${item.tone ?? 'text-accent'}`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold leading-none text-accent">
                    {item.badge}
                  </span>
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ---- Appearance ------------------------------------------------------ */}
      <Section icon={Gauge} title="Appearance" description="Tune density and motion for how you work.">
        <div className="flex items-start justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Compact density</p>
            <p className="mt-0.5 text-xs text-muted">Tighter spacing shows more on screen.</p>
          </div>
          <div
            className="flex shrink-0 rounded-xl border border-line bg-surface-2 p-1"
            role="radiogroup"
            aria-label="Density"
          >
            {DENSITIES.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={settings.density === value}
                onClick={() => setSettings({ density: value })}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  settings.density === value
                    ? 'bg-accent text-accent-fg shadow'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <Toggle
          label="Reduce motion"
          description="Calms animations everywhere in TDL, on top of your system preference."
          checked={settings.reduceMotion}
          onChange={(checked) => setSettings({ reduceMotion: checked })}
        />
      </Section>

      {/* ---- Task preferences ------------------------------------------------- */}
      <Section icon={ListChecks} title="Task preferences" description="Defaults used when you create and organize tasks.">
        <div className="grid gap-4 py-3 sm:grid-cols-2">
          <div>
            <label htmlFor="setting-default-priority" className="mb-1.5 block text-xs font-semibold text-muted">
              Default priority
            </label>
            <Dropdown
              id="setting-default-priority"
              title="Default priority"
              value={settings.defaultPriority}
              onChange={(value) => setSettings({ defaultPriority: value })}
              options={[
                { id: 'low', label: 'Low', dot: 'bg-success' },
                { id: 'medium', label: 'Medium', dot: 'bg-warning' },
                { id: 'high', label: 'High', dot: 'bg-danger' },
              ]}
            />
          </div>
          <div>
            <label htmlFor="setting-default-sort" className="mb-1.5 block text-xs font-semibold text-muted">
              Sort tasks by
            </label>
            <Dropdown
              id="setting-default-sort"
              title="Sort tasks by"
              value={settings.defaultSort}
              onChange={(value) => setSettings({ defaultSort: value })}
              options={[
                { id: 'manual', label: 'Manual order' },
                { id: 'priority', label: 'Priority' },
                { id: 'due', label: 'Due date' },
              ]}
            />
          </div>
        </div>
        <Toggle
          label="Confirm before deleting"
          description="Ask before clearing completed tasks or deleting a task."
          checked={settings.confirmDelete}
          onChange={(checked) => setSettings({ confirmDelete: checked })}
        />
      </Section>

      {/* ---- Notifications ---------------------------------------------------- */}
      <Section
        icon={BellRing}
        title="Notifications"
        description={PERMISSION_COPY[notificationPermission] ?? PERMISSION_COPY.default}
      >
        <Toggle
          label="Task reminders"
          description="In-app alerts, plus browser notifications when allowed."
          checked={notifyEnabled}
          disabled={notificationPermission === 'unsupported'}
          onChange={setNotifyEnabled}
        />
        <div className="flex flex-wrap items-center gap-2 py-3">
          {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
            <button type="button" className="btn-primary px-3.5 py-2 text-xs" onClick={requestNotifications}>
              Allow browser alerts
            </button>
          )}
          <button
            type="button"
            className="btn-ghost px-3.5 py-2 text-xs"
            onClick={sendTest}
            disabled={notificationPermission !== 'granted' || !notifyEnabled}
          >
            {testSent ? (
              <span className="flex items-center gap-1.5 text-success">
                <Check className="h-3.5 w-3.5" aria-hidden="true" /> Sent
              </span>
            ) : (
              'Send a test alert'
            )}
          </button>
        </div>
      </Section>

      {/* ---- Privacy & account ------------------------------------------------- */}
      <Section
        icon={ShieldCheck}
        title="Privacy & account"
        description="Your data stays in your account. These tools control this browser."
      >
        <div className="py-3">
          <p className="text-sm font-medium text-ink">{user?.email}</p>
          <p className="mt-0.5 text-xs text-muted">Signed-in account</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 py-3">
          <button type="button" className="btn-ghost px-3.5 py-2 text-xs" onClick={() => setExportOpen(true)}>
            <span className="flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Export my data
            </span>
          </button>
          {confirmingWipe ? (
            <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
              Reset density, motion, defaults, and plan on this device?
              <button
                type="button"
                className="rounded-lg bg-danger px-3 py-1.5 font-semibold text-white"
                onClick={() => {
                  clearLocalPreferences();
                  setConfirmingWipe(false);
                }}
              >
                Reset
              </button>
              <button
                type="button"
                className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink"
                onClick={() => setConfirmingWipe(false)}
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="btn-ghost px-3.5 py-2 text-xs"
              onClick={() => setConfirmingWipe(true)}
            >
              Clear local preferences
            </button>
          )}
          <button
            type="button"
            className="btn-ghost ml-auto px-3.5 py-2 text-xs text-danger"
            onClick={signOut}
            disabled={authBusy}
          >
            {authBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <span className="flex items-center gap-1.5">
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Sign out
              </span>
            )}
          </button>
        </div>
      </Section>
    </div>
  );
}
