import React from 'react';
import { motion } from 'framer-motion';
import {
  Archive,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Crown,
  Download,
  LayoutGrid,
  Loader2,
  LogOut,
  Star,
  UserRound,
  Wand2,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { plural } from '../lib/format';
import { getPlan } from '../lib/plans';
import { getAvatar } from '../lib/avatars';
import Brand from './Brand';

export default function Sidebar() {
  const activeView = useStore((s) => s.activeView);
  const setActiveView = useStore((s) => s.setActiveView);
  const setExportOpen = useStore((s) => s.setExportOpen);
  const setAIPlannerOpen = useStore((s) => s.setAIPlannerOpen);
  const user = useStore((s) => s.user);
  const signOut = useStore((s) => s.signOut);
  const authBusy = useStore((s) => s.authBusy);
  const plan = useStore((s) => s.plan);
  const setPlanDialogOpen = useStore((s) => s.setPlanDialogOpen);
  const planName = getPlan(plan).name;
  const profile = useStore((s) => s.profile);
  const avatar = getAvatar(profile?.avatar);
  const displayName = (profile?.name || '').trim();

  const notes = useStore((s) => s.notes);
  const todos = useStore((s) => s.todos);
  const searchQuery = useStore((s) => s.searchQuery);

  // Derive counts locally so the store is never subscribed to a fresh array.
  const { visibleNotes, archivedNotes, pinnedNotes, pendingTodos } = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matches = (note) =>
      !query ||
      (note.title ?? '').toLowerCase().includes(query) ||
      (note.content ?? '').toLowerCase().includes(query);

    const visible = notes.filter((note) => !note.archived && matches(note));
    const archived = notes.filter((note) => note.archived && matches(note));

    return {
      visibleNotes: visible,
      archivedNotes: archived,
      pinnedNotes: visible.filter((note) => note.pinned),
      pendingTodos: todos.filter((todo) => !todo.completed),
    };
  }, [notes, todos, searchQuery]);

  const navItems = [
    { id: 'notes', label: 'Notes', icon: LayoutGrid, count: visibleNotes.length },
    { id: 'todos', label: 'Todos', icon: CheckCircle2, count: pendingTodos.length },
    { id: 'today', label: 'Today', icon: CalendarDays },
    { id: 'starred', label: 'Starred', icon: Star, count: pinnedNotes.length },
    { id: 'archive', label: 'Archive', icon: Archive, count: archivedNotes.length },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  const accountItems = [
    { id: 'profile', label: 'Profile & Settings', icon: UserRound },
  ];

  const selectView = (id) => {
    setActiveView(id);
  };

  return (
    <aside
      aria-label="Primary"
      className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-panel/95 pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)] backdrop-blur-xl md:flex"
    >
      <div className="flex items-center justify-between px-5 py-5">
        <Brand size="md" />
      </div>

        <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Views">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectView(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`nav-item relative ${isActive ? 'nav-item-active' : ''}`}
              >
                {isActive && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl bg-accent/10"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    aria-hidden="true"
                  />
                )}
                <Icon className="relative h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                <span className="relative flex-1 text-left">{item.label}</span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="relative font-mono text-[11px] text-faint">{item.count}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-line p-3">
          {accountItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectView(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`nav-item relative ${isActive ? 'nav-item-active' : ''}`}
              >
                {isActive && (
                  <motion.span
                    layoutId="sidebar-account-active"
                    className="absolute inset-0 rounded-xl bg-accent/10"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    aria-hidden="true"
                  />
                )}
                <Icon className="relative h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                <span className="relative flex-1 text-left">{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            className="nav-item"
            onClick={() => setPlanDialogOpen(true)}
          >
            <Crown className="h-[18px] w-[18px] text-pop-pink" aria-hidden="true" />
            <span className="flex-1 text-left">Plans</span>
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
              {planName}
            </span>
          </button>
          <button
            type="button"
            className="nav-item"
            onClick={() => setAIPlannerOpen(true)}
          >
            <Wand2 className="h-[18px] w-[18px] text-accent" aria-hidden="true" />
            AI planner
          </button>
          <button
            type="button"
            className="nav-item"
            onClick={() => setExportOpen(true)}
          >
            <Download className="h-[18px] w-[18px]" aria-hidden="true" />
            Export as Markdown
          </button>
          <div className="mt-3 flex items-center justify-between px-3 pb-1">
            <span className="text-[11px] text-faint">
              {visibleNotes.length} {plural(visibleNotes.length, 'note')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="kbd">⌘</kbd>
              <kbd className="kbd">K</kbd>
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-line bg-raised/70 px-3 py-2.5">
            {avatar ? (
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatar.gradient} text-xs font-bold uppercase text-white`}
                aria-hidden="true"
              >
                {displayName.charAt(0)}
              </span>
            ) : (
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-pop-pink text-xs font-bold uppercase text-white"
                aria-hidden="true"
              >
                {displayName.charAt(0)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink" title={user?.email || ''}>
                {displayName || user?.email || 'Signed in'}
              </p>
              <p className="text-[10px] text-faint">{planName} plan · Private workspace</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              disabled={authBusy}
              className="icon-btn h-8 w-8 shrink-0"
              aria-label="Sign out"
              title="Sign out"
            >
              {authBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </aside>
  );
}
