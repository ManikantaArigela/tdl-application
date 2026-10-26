import React from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { Plus } from 'lucide-react';

import { useStore } from './store/useStore';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import NotesView from './views/NotesView';
import TodosView from './views/TodosView';
import AnalyticsView from './views/AnalyticsView';
import ProfileView from './views/ProfileView';
import NoteEditor from './components/NoteEditor';
import CommandPalette from './components/CommandPalette';
import QuickCapture from './components/QuickCapture';
import InsightsPanel from './components/InsightsPanel';
import ExportDialog from './components/ExportDialog';
import ReminderCenter from './components/ReminderCenter';
import AIPlannerDialog from './components/AIPlannerDialog';
import AISummaryDialog from './components/AISummaryDialog';
import AuthScreen from './components/AuthScreen';
import LandingPage from './components/LandingPage';
import Brand from './components/Brand';
import PlanDialog from './components/PlanDialog';

// Three.js is only needed for the ambient canvas, so keep it out of the initial bundle.
const AmbientBackground = React.lazy(() => import('./components/AmbientBackground'));

class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('React error boundary caught:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
          <div className="panel-raised w-full max-w-md p-8 text-center">
            <h1 className="text-2xl text-ink">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted" role="alert">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-primary mt-6"
            >
              Reload TDL
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoadingScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas p-6">
      <Brand size="lg" />
      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-line">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-accent" />
      </div>
      <p className="text-xs font-medium text-faint">Opening your workspace…</p>
    </div>
  );
}

export default function App() {
  const activeView = useStore((s) => s.activeView);
  const selectedNoteId = useStore((s) => s.selectedNoteId);
  const notes = useStore((s) => s.notes);
  const loaded = useStore((s) => s.loaded);
  const authReady = useStore((s) => s.authReady);
  const session = useStore((s) => s.session);
  const authError = useStore((s) => s.authError);
  const syncError = useStore((s) => s.syncError);
  const [authScreenOpen, setAuthScreenOpen] = React.useState(false);
  const [authMode, setAuthMode] = React.useState('signin');
  const commandPaletteOpen = useStore((s) => s.commandPaletteOpen);
  const quickCaptureOpen = useStore((s) => s.quickCaptureOpen);
  const aiPanelOpen = useStore((s) => s.aiPanelOpen);
  const aiPlannerOpen = useStore((s) => s.aiPlannerOpen);
  const aiSummaryOpen = useStore((s) => s.aiSummaryOpen);
  const exportOpen = useStore((s) => s.exportOpen);
  const planDialogOpen = useStore((s) => s.planDialogOpen);
  const reduceMotion = useStore((s) => s.settings.reduceMotion);
  const density = useStore((s) => s.settings.density);

  const note = selectedNoteId ? notes.find((n) => n.id === selectedNoteId) : null;

  React.useEffect(() => {
    useStore.getState().initAuth();
  }, []);

  // Close the auth screen when an account is active, and return to the landing
  // page after sign-out.
  React.useEffect(() => {
    if (session) {
      setAuthScreenOpen(false);
      setAuthMode('signin');
    }
  }, [session]);

  // An expired session or a failed silent sign-in should land on the form with
  // the message visible, not on the marketing page.
  React.useEffect(() => {
    if (!session && authError) setAuthScreenOpen(true);
  }, [session, authError]);

  React.useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const isTyping =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        useStore.getState().toggleCommandPalette();
        return;
      }

      if (event.key === 'Escape') {
        const state = useStore.getState();
        if (state.aiPlannerOpen) state.setAIPlannerOpen(false);
        else if (state.aiSummaryOpen) state.setAISummaryOpen(false);
        else if (state.commandPaletteOpen) state.setCommandPaletteOpen(false);
        else if (state.quickCaptureOpen) state.toggleQuickCapture();
        else if (state.aiPanelOpen) state.setAIPanelOpen(false);
        else if (state.exportOpen) state.setExportOpen(false);
        else if (state.planDialogOpen) state.setPlanDialogOpen(false);
        return;
      }

      if (!isTyping && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        useStore.getState().toggleQuickCapture();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!authReady) return <LoadingScreen />;

  if (!session) {
    return (
      <ErrorBoundary>
        <MotionConfig reducedMotion="user">
          {authScreenOpen ? (
            <AuthScreen
              initialMode={authMode}
              onBack={() => setAuthScreenOpen(false)}
            />
          ) : (
            <LandingPage
              onSignIn={() => {
                setAuthMode('signin');
                setAuthScreenOpen(true);
              }}
              onSignUp={() => {
                setAuthMode('signup');
                setAuthScreenOpen(true);
              }}
              onChoosePlan={(planId) => {
                useStore.getState().choosePlanBeforeSignup(planId);
                setAuthMode('signup');
                setAuthScreenOpen(true);
              }}
            />
          )}
        </MotionConfig>
      </ErrorBoundary>
    );
  }

  if (!loaded) return <LoadingScreen />;

  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
        <div data-density={density} className="min-h-dvh bg-canvas text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-panel focus:px-4 focus:py-2 focus:text-sm focus:text-ink focus:shadow-lift"
        >
          Skip to content
        </a>

        <React.Suspense fallback={null}>
          <AmbientBackground />
        </React.Suspense>
        <MobileNav />
        <Sidebar />

        <div className="md:pl-64">
          <main
            id="main"
            className="mx-auto w-full max-w-6xl px-[calc(1rem+env(safe-area-inset-left))] pb-[calc(9.5rem+env(safe-area-inset-bottom))] md:px-8 md:pb-[calc(7rem+env(safe-area-inset-bottom))]"
          >
            <Header />

            {syncError && (
              <div
                role="alert"
                className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-ink"
              >
                <span>{syncError}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 text-xs"
                    onClick={() => useStore.getState().clearSyncError()}
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    className="btn-primary px-3 py-1.5 text-xs"
                    onClick={() => useStore.getState().init()}
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6">
              {selectedNoteId && note ? (
                <NoteEditor key={note.id} note={note} />
              ) : (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeView}
                    initial={{ opacity: 0, y: 10, scale: 0.995 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.995 }}
                    transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    {activeView === 'notes' && <NotesView />}
                    {activeView === 'todos' && <TodosView />}
                    {activeView === 'today' && <TodosView filter="open" />}
                    {activeView === 'starred' && <NotesView starred />}
                    {activeView === 'archive' && <NotesView archive />}
                    {activeView === 'analytics' && <AnalyticsView />}
                    {activeView === 'profile' && <ProfileView />}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </main>
        </div>

        <div
          className={`fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))] z-30 md:bottom-8 md:right-8 ${
            activeView === 'todos' || activeView === 'today' ? 'hidden md:block' : ''
          }`}
        >
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full bg-accent/25 blur-lg"
              animate={{ scale: [1, 1.22, 1], opacity: [0.5, 0.16, 0.5] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.button
              type="button"
              onClick={() => useStore.getState().toggleQuickCapture()}
              whileHover={{ scale: 1.07, rotate: 90 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              className="relative flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-fg shadow-glow md:h-14 md:w-14"
              aria-label="Quick capture a note or task"
              aria-keyshortcuts="Control+J"
            >
              <Plus className="h-5 w-5 md:h-6 md:w-6" aria-hidden="true" />
            </motion.button>
          </div>

        <AnimatePresence>
          {commandPaletteOpen && <CommandPalette key="command-palette" />}
        </AnimatePresence>
        <AnimatePresence>
          {quickCaptureOpen && <QuickCapture key="quick-capture" />}
        </AnimatePresence>
        <AnimatePresence>
          {aiPanelOpen && <InsightsPanel key="insights" />}
        </AnimatePresence>
        <AnimatePresence>
          {exportOpen && <ExportDialog key="export" />}
        </AnimatePresence>
        <AnimatePresence>
          {aiPlannerOpen && <AIPlannerDialog key="ai-planner" />}
        </AnimatePresence>
        <AnimatePresence>
          {aiSummaryOpen && <AISummaryDialog key="ai-summary" />}
        </AnimatePresence>
        <AnimatePresence>
          {planDialogOpen && <PlanDialog key="plans" />}
        </AnimatePresence>

        <ReminderCenter />
        </div>
      </MotionConfig>
    </ErrorBoundary>
  );
}
