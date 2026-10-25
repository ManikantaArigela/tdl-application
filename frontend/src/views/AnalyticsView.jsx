import React from 'react';
import { motion } from 'framer-motion';
import { Activity, CheckCircle2, Flame, PenLine } from 'lucide-react';
import { useStore } from '../store/useStore';
import { dayKey, lastSevenDays } from '../lib/format';

export default function AnalyticsView() {
  const todos = useStore((s) => s.todos);
  const notes = useStore((s) => s.notes);
  const streak = useStore((s) => s.streak);
  const completedThisWeek = useStore((s) => s.completedThisWeek);

  const completed = todos.filter((todo) => todo.completed).length;
  const open = todos.length - completed;
  const completionRate = todos.length ? Math.round((completed / todos.length) * 100) : 0;

  const weekStart = React.useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    return start.getTime();
  }, []);

  const notesEdited = notes.filter((note) => (note.updatedAt ?? 0) >= weekStart).length;

  const days = React.useMemo(() => lastSevenDays(), []);
  const counts = React.useMemo(
    () =>
      days.map(
        (day) => todos.filter((todo) => todo.completedAt && dayKey(todo.completedAt) === day.key).length
      ),
    [days, todos]
  );
  const max = Math.max(...counts, 1);
  const weekTotal = counts.reduce((sum, value) => sum + value, 0);

  return (
    <section aria-labelledby="analytics-heading">
      <div className="mb-5">
        <h2 id="analytics-heading" className="text-3xl font-semibold tracking-[-0.045em] text-ink sm:text-4xl">
          Analytics
        </h2>
        <p className="mt-1.5 text-sm text-muted">Based on the tasks and notes on this device.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open tasks" value={open} icon={Activity} tone="plain" />
        <StatCard label="Completed" value={completed} icon={CheckCircle2} tone="lilac" />
        <StatCard
          label="Completion rate"
          value={`${completionRate}%`}
          icon={CheckCircle2}
          tone="sun"
        />
        <StatCard
          label="Current streak"
          value={`${streak} ${streak === 1 ? 'day' : 'days'}`}
          icon={Flame}
          tone="pink"
        />
      </div>

      <div className="panel mt-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg text-ink">Completed this week</h3>
          <p className="text-sm text-muted">
            {completedThisWeek} {completedThisWeek === 1 ? 'task' : 'tasks'}
          </p>
        </div>

        <div className="mt-6 flex h-40 items-end gap-2" role="group" aria-label="Tasks completed each day">
          {days.map((day, index) => {
            const count = counts[index];
            const height = count === 0 ? 3 : Math.max((count / max) * 100, 8);
            return (
              <div
                key={day.key}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <span className="h-4 text-[11px] text-faint">{count > 0 ? count : ''}</span>
                <div className="relative flex w-full flex-1 items-end">
                  <motion.div
                    role="img"
                    aria-label={`${day.fullLabel}: ${count} completed`}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{
                      duration: 0.55,
                      delay: index * 0.06,
                      ease: [0.2, 0.8, 0.2, 1],
                    }}
                    className={`w-full origin-bottom rounded-t-lg transition-opacity duration-200 ${
                      count > 0
                        ? 'bg-gradient-to-t from-accent to-pop-pink hover:opacity-80'
                        : 'bg-line'
                    }`}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className="h-4 text-[11px] text-faint">{day.label}</span>
              </div>
            );
          })}
        </div>

        {weekTotal === 0 && (
          <p className="mt-4 text-sm text-muted">
            No tasks completed in the last seven days. Checking one off is enough to start the chart.
          </p>
        )}
      </div>

      <div className="panel mt-4 flex items-center gap-3 p-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lavender text-accent">
          <PenLine className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="text-sm text-muted">
          <span className="font-semibold text-ink">{notesEdited}</span>{' '}
          {notesEdited === 1 ? 'note' : 'notes'} edited in the last seven days.
        </p>
      </div>
    </section>
  );
}

const STAT_TONES = {
  plain: {
    card: 'panel',
    label: 'text-muted',
    icon: 'bg-lavender text-accent',
    value: 'text-ink',
  },
  lilac: {
    card: 'rounded-[1.25rem] border border-accent/10 bg-lavender',
    label: 'text-accent/70',
    icon: 'bg-panel/80 text-accent',
    value: 'text-ink',
  },
  sun: {
    card: 'rounded-[1.25rem] border border-black/5 bg-pop-yellow',
    label: 'text-ink/60',
    icon: 'bg-panel/50 text-ink',
    value: 'text-ink',
  },
  pink: {
    card: 'rounded-[1.25rem] border border-black/5 bg-pop-pink text-white',
    label: 'text-white/70',
    icon: 'bg-white/20 text-white',
    value: 'text-white',
  },
};

function StatCard({ label, value, icon: Icon, tone = 'plain' }) {
  const styles = STAT_TONES[tone] ?? STAT_TONES.plain;
  return (
    <div className={`${styles.card} p-4`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-medium ${styles.label}`}>{label}</span>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${styles.icon}`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className={`mt-3 text-3xl font-bold tracking-[-0.055em] ${styles.value}`}>{value}</p>
    </div>
  );
}
