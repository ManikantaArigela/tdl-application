import React from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { Plus } from 'lucide-react';

import { useStore } from './store/useStore';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import NotesView from './views/NotesView';
import TodosView from './views/TodosView';
import AnalyticsView from './views/AnalyticsView';
import NoteEditor from './components/NoteEditor';
import CommandPalette from './components/CommandPalette';
import QuickCapture from './components/QuickCapture';
import InsightsPanel from './components/InsightsPanel';
import ExportDialog from './components/ExportDialog';

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
              Reload Nova
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
    <div className="min-h-dvh bg-canvas px-6 py-16">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-10">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton mt-4 h-9 w-64" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="panel h-44 p-5">
              <div className="skeleton h-4 w-1/3" />
              <div className="skeleton mt-4 h-6 w-3/4" />
              <div className="skeleton mt-3 h-3 w-full" />
              <div className="skeleton mt-2 h-3 w-5/6" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const activeView = useStore((s) => s.activeView);
  const selectedNoteId = useStore((s) => s.selectedNoteId);
  const notes = useStore((s) => s.notes);
  const loaded = useStore((s) => s.loaded);
  const accent = useStore((s) => s.accent);
  const syncError = useStore((s) => s.syncError);
  const commandPaletteOpen = useStore((s) => s.commandPaletteOpen);
  const quickCaptureOpen = useStore((s) => s.quickCaptureOpen);
  const aiPanelOpen = useStore((s) => s.aiPanelOpen);
  const exportOpen = useStore((s) => s.exportOpen);

  const note = selectedNoteId ? notes.find((n) => n.id === selectedNoteId) : null;

  React.useEffect(() => {
    if (!loaded) useStore.getState().init();
  }, [loaded]);

  React.useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

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
        if (state.commandPaletteOpen) state.setCommandPaletteOpen(false);
        else if (state.quickCaptureOpen) state.toggleQuickCapture();
        else if (state.aiPanelOpen) state.setAIPanelOpen(false);
        else if (state.exportOpen) state.setExportOpen(false);
        else if (state.sidebarOpen) state.setSidebarOpen(false);
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

  if (!loaded) return <LoadingScreen />;

  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <div className="min-h-dvh bg-canvas text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-panel focus:px-4 focus:py-2 focus:text-sm focus:text-ink focus:shadow-lift"
        >
          Skip to content
        </a>

        <React.Suspense fallback={null}>
          <AmbientBackground />
        </React.Suspense>
        <Sidebar />

        <div className="md:pl-64">
          <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-28 md:px-8">
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
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    {activeView === 'notes' && <NotesView />}
                    {activeView === 'todos' && <TodosView />}
                    {activeView === 'today' && <TodosView filter="open" />}
                    {activeView === 'starred' && <NotesView starred />}
                    {activeView === 'archive' && <NotesView archive />}
                    {activeView === 'analytics' && <AnalyticsView />}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </main>
        </div>

        <div className="fixed bottom-5 right-5 z-30 flex flex-col items-end gap-2 md:bottom-8 md:right-8">
          <button
            type="button"
            onClick={() => useStore.getState().toggleQuickCapture()}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lift transition-transform duration-120 hover:scale-105 active:scale-95"
            aria-label="Quick capture a note or task"
            aria-keyshortcuts="Control+J"
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
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
        </div>
      </MotionConfig>
    </ErrorBoundary>
  );
}
