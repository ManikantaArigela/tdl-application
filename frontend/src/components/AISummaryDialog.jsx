import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  Crown,
  FilePlus2,
  Loader2,
  ScrollText,
  X,
} from 'lucide-react';
import { api } from '../api';
import { useStore } from '../store/useStore';
import { formatDate, plural } from '../lib/format';
import { formatLimit, getPlan, getPlanLimits } from '../lib/plans';

export default function AISummaryDialog() {
  const setOpen = useStore((s) => s.setAISummaryOpen);
  const notes = useStore((s) => s.notes);
  const addNote = useStore((s) => s.addNote);
  const selectNote = useStore((s) => s.selectNote);
  const setActiveView = useStore((s) => s.setActiveView);
  const plan = useStore((s) => s.plan);
  const planUsage = useStore((s) => s.planUsage);
  const recordAIUse = useStore((s) => s.recordAIUse);
  const setPlanDialogOpen = useStore((s) => s.setPlanDialogOpen);

  const [status, setStatus] = React.useState('idle');
  const [summary, setSummary] = React.useState('');
  const [error, setError] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  const source = React.useMemo(
    () =>
      notes
        .filter((note) => !note.archived && (note.content ?? '').trim())
        .slice(0, 40)
        .map((note) => ({
          title: note.title ?? '',
          content: (note.content ?? '').slice(0, 8_000),
        })),
    [notes]
  );

  const close = () => setOpen(false);
  const planInfo = getPlan(plan);
  const noteLimits = getPlanLimits(plan);
  const noteRemaining = Math.max(noteLimits.notes - planUsage.notes, 0);

  const generate = React.useCallback(async () => {
    if (source.length === 0) return;

    const limits = getPlanLimits(plan);
    const planInfo = getPlan(plan);
    if (planUsage.notes >= limits.notes) {
      setStatus('error');
      setError(
        `Your ${planInfo.name} plan includes ${formatLimit(
          limits.notes
        )} AI note actions each month, and they are all used. Upgrade to keep creating study briefs.`
      );
      return;
    }

    setStatus('loading');
    setError('');
    setSummary('');
    try {
      const response = await api.summarizeNotes({ notes: source });
      setSummary(response.summary ?? '');
      setStatus('done');
      recordAIUse('notes');
    } catch (err) {
      const message = err.message || 'Could not summarize your notes.';
      setError(
        /not configured/i.test(message)
          ? 'Gemini is not configured. Add GEMINI_API_KEY to backend/.env and restart the server.'
          : message
      );
      setStatus('error');
    }
  }, [source, plan, planUsage.notes, recordAIUse]);

  React.useEffect(() => {
    if (source.length > 0) generate();
    // Run once when the dialog opens; explicit retry is available afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard access can be denied */
    }
  };

  const saveAsNote = async () => {
    const created = await addNote({
      title: `Study brief — ${formatDate(new Date())}`,
      content: summary,
      tags: ['summary'],
      pinned: false,
      archived: false,
    });
    if (created) {
      close();
      setActiveView('notes');
      selectNote(created.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm"
      onClick={close}
    >
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.99 }}
        transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-summary-heading"
        className="panel-raised flex max-h-[88dvh] w-full max-w-2xl flex-col p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <ScrollText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="ai-summary-heading" className="text-xl leading-tight text-ink">
                Study brief
              </h2>
              <p className="text-xs text-muted">
                {source.length} {plural(source.length, 'note')} summarized by Gemini · {planInfo.name}{' '}
                plan
              </p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-faint">
                <Crown className="h-3 w-3" aria-hidden="true" />
                {noteLimits.notes === Infinity
                  ? 'Unlimited AI actions'
                  : `${noteRemaining} of ${formatLimit(noteLimits.notes)} AI actions left`}
              </p>
            </div>
          </div>
          <button type="button" onClick={close} className="icon-btn h-8 w-8" aria-label="Close summary">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 min-h-[10rem] flex-1 overflow-y-auto rounded-xl border border-line/80 bg-raised/40 p-4">
          {status === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Reading your notes and drafting a brief…
            </div>
          )}

          {status === 'idle' && source.length === 0 && (
            <p className="text-sm text-muted">
              There are no notes with content to summarize yet. Write a note first, then come back.
            </p>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-xs leading-relaxed text-danger">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p>{error}</p>
                {/includes .* AI note actions|Upgrade/i.test(error) ? (
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      setPlanDialogOpen(true);
                    }}
                    className="mt-2 font-medium underline underline-offset-2"
                  >
                    See plans
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={generate}
                    className="mt-2 font-medium underline underline-offset-2"
                  >
                    Try again
                  </button>
                )}
              </div>
            </div>
          )}

          {status === 'done' && summary && (
            <div className="whitespace-pre-wrap text-sm leading-7 text-ink">{summary}</div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={status === 'loading' || source.length === 0}
            className="btn-ghost px-3 py-1.5 text-xs"
          >
            <ScrollText className="h-3.5 w-3.5" aria-hidden="true" /> Regenerate
          </button>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copy}
              disabled={!summary}
              className="btn-ghost px-3 py-1.5 text-xs"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" /> Copied
                </>
              ) : (
                <>
                  <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" /> Copy
                </>
              )}
            </button>
            <button
              type="button"
              onClick={saveAsNote}
              disabled={!summary}
              className="btn-primary text-xs"
            >
              <FilePlus2 className="h-4 w-4" aria-hidden="true" /> Save as note
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
