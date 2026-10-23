import React from 'react';
import { motion } from 'framer-motion';
import { CalendarRange, ListChecks, Sparkles, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatDate, isOverdue } from '../lib/format';

const PRIORITY_WEIGHT = { high: 0, medium: 1, low: 2 };

export default function InsightsPanel() {
  const setAIPanelOpen = useStore((s) => s.setAIPanelOpen);
  const notes = useStore((s) => s.notes);
  const todos = useStore((s) => s.todos);

  const [result, setResult] = React.useState(null);

  const openTodos = todos.filter((todo) => !todo.completed);
  const overdue = openTodos.filter((todo) => isOverdue(todo.dueDate));
  const pinned = notes.filter((note) => note.pinned).length;
  const archived = notes.filter((note) => note.archived).length;

  const weekStart = React.useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    return start.getTime();
  }, []);
  const completedThisWeek = todos.filter((todo) => todo.completedAt && todo.completedAt >= weekStart).length;

  const tagCounts = React.useMemo(() => {
    const counts = new Map();
    notes.forEach((note) => {
      (note.tags ?? []).forEach((tag) => {
        const key = tag.trim();
        if (!key) return;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [notes]);

  const review = () => {
    setResult({
      title: 'Weekly review',
      lines: [
        `${notes.length} notes, ${pinned} pinned, ${archived} archived.`,
        `${openTodos.length} open tasks; ${completedThisWeek} completed in the last seven days.`,
        overdue.length
          ? `${overdue.length} ${overdue.length === 1 ? 'task is' : 'tasks are'} past due.`
          : 'Nothing is past due.',
        tagCounts.length
          ? `Most used tags: ${tagCounts.map(([tag, count]) => `${tag} (${count})`).join(', ')}.`
          : 'No tags yet — tags make search faster.',
      ],
    });
  };

  const focus = () => {
    const next = [...openTodos]
      .sort((a, b) => {
        const priority = (PRIORITY_WEIGHT[a.priority] ?? 1) - (PRIORITY_WEIGHT[b.priority] ?? 1);
        if (priority !== 0) return priority;
        return (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) -
          (b.dueDate ? new Date(b.dueDate).getTime() : Infinity);
      })
      .slice(0, 3);

    setResult({
      title: 'Focus list',
      lines: next.length
        ? next.map(
            (todo, index) =>
              `${index + 1}. ${todo.text} — ${todo.priority ?? 'medium'}${
                todo.dueDate ? `, due ${formatDate(todo.dueDate)}` : ''
              }`
          )
        : ['Nothing open. Add a task to build a focus list.'],
    });
  };

  return (
    <>
      <motion.button
        type="button"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setAIPanelOpen(false)}
        className="fixed inset-0 z-40 cursor-default bg-black/45 backdrop-blur-[2px]"
        aria-label="Close insights"
      />

      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
        role="dialog"
        aria-modal="true"
        aria-label="Insights"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-line bg-panel shadow-lift"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg text-ink">
            <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" /> Insights
          </h2>
          <button
            type="button"
            onClick={() => setAIPanelOpen(false)}
            className="icon-btn h-8 w-8"
            aria-label="Close insights"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <dl className="grid grid-cols-3 gap-2">
            {[
              { label: 'Notes', value: notes.length },
              { label: 'Open tasks', value: openTodos.length },
              { label: 'Overdue', value: overdue.length },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-line bg-raised p-3">
                <dt className="text-[11px] text-muted">{stat.label}</dt>
                <dd className="mt-1 font-display text-xl text-ink">{stat.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={review} className="btn-subtle text-xs">
              <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" /> Weekly review
            </button>
            <button type="button" onClick={focus} className="btn-subtle text-xs">
              <ListChecks className="h-3.5 w-3.5" aria-hidden="true" /> Focus list
            </button>
          </div>

          {result ? (
            <div className="mt-5 rounded-xl border border-line bg-raised p-4" aria-live="polite">
              <h3 className="text-sm font-medium text-ink">{result.title}</h3>
              <ul className="mt-2 space-y-2">
                {result.lines.map((line) => (
                  <li key={line} className="text-sm leading-relaxed text-muted">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-5 text-sm leading-relaxed text-muted">
              Choose a review to summarise what is on your plate. Everything is computed from the
              notes and tasks already on this device.
            </p>
          )}
        </div>

        <div className="border-t border-line px-5 py-3">
          <p className="text-[11px] leading-relaxed text-faint">
            Generated locally. TDL sends nothing to an external AI service.
          </p>
        </div>
      </motion.aside>
    </>
  );
}
