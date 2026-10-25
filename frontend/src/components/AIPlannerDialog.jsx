import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Crown,
  FileText,
  ListChecks,
  Loader2,
  StickyNote,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { api } from '../api';
import { useStore } from '../store/useStore';
import { formatLimit, getPlan, getPlanLimits } from '../lib/plans';

const MAX_FILE_BYTES = 6 * 1024 * 1024;
const TEXT_FILE = /\.(txt|md|markdown|json|csv|log)$/i;

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsText(file);
  });
}

function readBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

export default function AIPlannerDialog() {
  const setOpen = useStore((s) => s.setAIPlannerOpen);
  const refresh = useStore((s) => s.refresh);
  const setActiveView = useStore((s) => s.setActiveView);
  const plan = useStore((s) => s.plan);
  const planUsage = useStore((s) => s.planUsage);
  const recordAIUse = useStore((s) => s.recordAIUse);
  const setPlanDialogOpen = useStore((s) => s.setPlanDialogOpen);

  const [mode, setMode] = React.useState('topic');
  const [topic, setTopic] = React.useState('');
  const [file, setFile] = React.useState(null);
  const [status, setStatus] = React.useState('idle');
  const [error, setError] = React.useState('');
  const [retryable, setRetryable] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [aiStatus, setAiStatus] = React.useState(null);

  const textareaRef = React.useRef(null);
  const fileInputRef = React.useRef(null);

  React.useEffect(() => {
    let cancelled = false;
    api
      .getAIStatus()
      .then((value) => {
        if (!cancelled) setAiStatus(value);
      })
      .catch(() => {
        if (!cancelled) setAiStatus({ configured: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (mode === 'topic') textareaRef.current?.focus();
  }, [mode]);

  const close = () => setOpen(false);

  const configured = aiStatus?.configured !== false;
  const trimmedTopic = topic.trim();
  const planInfo = getPlan(plan);
  const limits = getPlanLimits(plan);
  const used = planUsage.planner;
  const remaining = Math.max(limits.planner - used, 0);
  const plannerLocked = used >= limits.planner;
  const canGenerate =
    configured &&
    !plannerLocked &&
    (Boolean(trimmedTopic) || Boolean(file)) &&
    status !== 'loading';

  const openPlans = () => {
    close();
    setPlanDialogOpen(true);
  };

  const handleFile = async (picked) => {
    if (!picked) return;
    setRetryable(false);
    if (picked.size > MAX_FILE_BYTES) {
      setError('Please choose a file under 6 MB.');
      return;
    }

    const isPdf = picked.type === 'application/pdf' || /\.pdf$/i.test(picked.name);
    const isText = picked.type.startsWith('text/') || TEXT_FILE.test(picked.name);

    if (!isPdf && !isText) {
      setError('Use a PDF or a text file (.txt, .md, .json, .csv).');
      return;
    }

    if (isPdf && !limits.pdf) {
      setError(
        `PDF imports are available on Pro and Premium. Your ${planInfo.name} plan can still plan from a topic or a text file.`
      );
      return;
    }

    setError('');
    try {
      if (isText) {
        const text = await readTextFile(picked);
        setFile({ kind: 'text', name: picked.name, text });
      } else {
        const data = await readBase64(picked);
        setFile({ kind: 'binary', name: picked.name, mimeType: 'application/pdf', data });
      }
    } catch (err) {
      setError(err.message || 'Could not read that file.');
    }
  };

  const generate = async (event) => {
    event?.preventDefault();
    if (plannerLocked) {
      setError(
        `You’ve used all ${formatLimit(limits.planner)} AI plans this month on the ${planInfo.name} plan. Upgrade to keep planning.`
      );
      return;
    }
    if (!canGenerate) return;

    setStatus('loading');
    setError('');
    setRetryable(false);

    try {
      const payload = { topic: trimmedTopic };
      if (file?.kind === 'text') {
        payload.topic = [
          trimmedTopic,
          `Attached file "${file.name}":\n\n${file.text}`,
        ]
          .filter(Boolean)
          .join('\n\n');
      }
      if (file?.kind === 'binary') {
        payload.file = { name: file.name, mimeType: file.mimeType, data: file.data };
      }

      const response = await api.generatePlan(payload);
      setResult(response);
      setStatus('done');
      recordAIUse('planner');
      await refresh();
    } catch (err) {
      const message = err.message || 'Could not generate a plan.';
      const notConfigured = /not configured/i.test(message);
      const busy =
        !notConfigured &&
        (err.retryable === true ||
          /high demand|temporarily|busy|overloaded|try again later|unavailable|took too long/i.test(
            message
          ));
      setError(
        notConfigured
          ? 'Gemini is not configured. Add GEMINI_API_KEY to backend/.env and restart the server.'
          : /high demand|overloaded|temporarily|try again later/i.test(message)
          ? 'The AI is busy right now. Your topic is still here — try again in a moment.'
          : message
      );
      setRetryable(busy);
      setStatus('error');
    }
  };

  const reset = () => {
    setResult(null);
    setStatus('idle');
    setError('');
    setRetryable(false);
    setFile(null);
    setTopic('');
    setMode('topic');
  };

  const viewTasks = () => {
    close();
    setActiveView('todos');
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
        aria-labelledby="ai-planner-heading"
        className="panel-raised max-h-[90dvh] w-full max-w-xl overflow-y-auto p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Wand2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="ai-planner-heading" className="text-xl leading-tight text-ink">
                AI planner
              </h2>
              <p className="text-xs text-muted">Turn a topic or file into notes and tasks.</p>
            </div>
          </div>
          <button type="button" onClick={close} className="icon-btn h-8 w-8" aria-label="Close AI planner">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {aiStatus && !configured && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs leading-relaxed text-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <span>
              AI is not configured yet. Add <code className="font-mono">GEMINI_API_KEY</code> to{' '}
              <code className="font-mono">backend/.env</code> and restart the server.
            </span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-raised/50 px-2.5 py-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
            <Crown className="h-3 w-3" aria-hidden="true" />
            {planInfo.name} plan
          </span>
          <span className="text-[10px] text-faint">
            {limits.planner === Infinity
              ? 'Unlimited AI plans'
              : `${remaining} of ${formatLimit(limits.planner)} AI plans left this month`}
          </span>
          {plan !== 'premium' && (
            <button
              type="button"
              onClick={openPlans}
              className="ml-auto text-[10px] font-semibold text-accent hover:underline"
            >
              See plans
            </button>
          )}
        </div>

        {plannerLocked && !result && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-pop-pink/25 bg-pop-pink/[0.06] px-3 py-2.5">
            <Crown className="mt-0.5 h-4 w-4 shrink-0 text-pop-pink" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink">
                Your AI planner allowance is used up
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                You get {formatLimit(limits.planner)} planner runs each month on {planInfo.name}.
                Upgrade for more, or keep capturing notes and tasks normally.
              </p>
              <button
                type="button"
                onClick={openPlans}
                className="mt-2 rounded-lg bg-ink px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-accent"
              >
                Compare plans
              </button>
            </div>
          </div>
        )}

        {result ? (
          <div className="mt-5">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              <h3 className="text-lg text-ink">{result.plan?.title || 'Plan ready'}</h3>
            </div>

            {result.plan?.summary && (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {result.plan.summary}
              </p>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-line/80 bg-raised/50 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
                  <StickyNote className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                  {result.notes?.length ?? 0} notes created
                </p>
                <ul className="mt-2 space-y-1 text-[11px] text-muted">
                  {(result.notes ?? []).slice(0, 3).map((note) => (
                    <li key={note.id} className="line-clamp-1">
                      · {note.title || 'Untitled'}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-line/80 bg-raised/50 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
                  <ListChecks className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                  {result.tasks?.length ?? 0} tasks created
                </p>
                <ul className="mt-2 space-y-1 text-[11px] text-muted">
                  {(result.tasks ?? []).slice(0, 4).map((task) => (
                    <li key={task.id} className="line-clamp-1">
                      · {task.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={reset}>
                Plan another
              </button>
              <button type="button" className="btn-primary text-xs" onClick={viewTasks}>
                View tasks
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={generate} className="mt-4">
            <div className="flex gap-1 rounded-lg border border-line bg-raised/60 p-1">
              {[
                { id: 'topic', label: 'Topic', icon: Wand2 },
                { id: 'file', label: 'Upload file', icon: Upload },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMode(tab.id)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      mode === tab.id
                        ? 'bg-panel text-ink shadow-sm'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {mode === 'topic' ? (
              <div className="mt-3">
                <label htmlFor="ai-topic" className="text-xs font-medium text-muted">
                  What are you working on?
                </label>
                <textarea
                  id="ai-topic"
                  ref={textareaRef}
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  rows={4}
                  placeholder="e.g. Prepare for my biology midterm on cell division, or plan a 2-week revision schedule for calculus."
                  className="input mt-1.5 min-h-[7rem] resize-y py-2.5 text-sm"
                />
              </div>
            ) : (
              <div className="mt-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.markdown,.json,.csv,text/plain,application/pdf"
                  className="sr-only"
                  onChange={(event) => {
                    handleFile(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />

                {file ? (
                  <div className="flex items-center gap-3 rounded-lg border border-line bg-raised/50 px-3 py-3">
                    <FileText className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{file.name}</p>
                      <p className="text-[11px] text-faint">
                        {file.kind === 'text'
                          ? 'Text file · first 40,000 characters are used'
                          : 'PDF · read by Gemini'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="icon-btn h-7 w-7"
                      aria-label="Remove file"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleFile(event.dataTransfer.files?.[0]);
                    }}
                    className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-raised/40 px-4 py-8 text-center transition-colors hover:border-accent/40 hover:bg-accent/5"
                  >
                    <Upload className="h-6 w-6 text-faint" aria-hidden="true" />
                    <span className="text-sm font-medium text-ink">Choose or drop a file</span>
                    <span className="text-[11px] text-faint">
                      PDF, Markdown, TXT, JSON or CSV · up to 6 MB
                    </span>
                  </button>
                )}

                <div className="mt-3">
                  <label htmlFor="ai-note" className="text-xs font-medium text-muted">
                    Optional instructions
                  </label>
                  <textarea
                    id="ai-note"
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    rows={2}
                    placeholder="e.g. focus on chapters 3–5, quiz me on Friday."
                    className="input mt-1.5 resize-y py-2 text-xs"
                  />
                </div>
              </div>
            )}

            {error && (
              <div
                className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs leading-relaxed text-danger"
                role="alert"
              >
                <p>{error}</p>
                {(retryable || /Pro and Premium|Upgrade/i.test(error)) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {retryable && (
                      <button
                        type="button"
                        onClick={() => generate()}
                        disabled={status === 'loading'}
                        className="rounded-md bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger ring-1 ring-inset ring-danger/20 transition-colors hover:bg-danger/15 disabled:opacity-60"
                      >
                        Try again
                      </button>
                    )}
                    {/Pro and Premium|Upgrade/i.test(error) && (
                      <button
                        type="button"
                        onClick={openPlans}
                        className="rounded-md bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent ring-1 ring-inset ring-accent/20 transition-colors hover:bg-accent/15"
                      >
                        See plans
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-faint">
                Gemini creates notes and tasks for you — review before relying on them.
              </p>
              <button type="submit" className="btn-primary shrink-0" disabled={!canGenerate}>
                {status === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Planning…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" aria-hidden="true" /> Generate plan
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}
