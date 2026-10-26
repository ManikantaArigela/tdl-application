import React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Flame,
  Inbox,
  PenLine,
  TrendingUp,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { dayKey, lastSevenDays } from '../lib/format';

const PRIORITY_ORDER = ['high', 'medium', 'low'];
const PRIORITY_META = {
  high: { label: 'High', bar: 'bg-danger/80', text: 'text-danger' },
  medium: { label: 'Medium', bar: 'bg-warning/80', text: 'text-warning' },
  low: { label: 'Low', bar: 'bg-success/80', text: 'text-success' },
};

const PERIODS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

const dayStart = (offset = 0) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
};

/** Bucket definitions for the trend chart, keyed by period. */
function buildBuckets(period) {
  if (period === 'daily') {
    return Array.from({ length: 14 }, (_, index) => {
      const date = dayStart(index - 13);
      const label = index === 13 ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'narrow' });
      return {
        key: dayKey(date),
        label,
        fullLabel: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' }),
      };
    });
  }
  if (period === 'weekly') {
    return Array.from({ length: 8 }, (_, index) => {
      const start = dayStart((index - 7) * 7);
      const end = dayStart((index - 7) * 7 + 6);
      return {
        key: `${dayKey(start)}..${dayKey(end)}`,
        label: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        fullLabel: `Week of ${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
        start: start.getTime(),
        end: end.getTime() + 24 * 60 * 60 * 1000,
      };
    });
  }
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() + (index - 5), 1);
    const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleDateString(undefined, { month: 'short' }),
      fullLabel: date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      start: date.getTime(),
      end: next.getTime(),
    };
  });
}

function countForBucket(bucket, completedAtDays) {
  if (bucket.start) {
    return completedAtDays.filter(
      ({ time }) => time >= bucket.start && time < bucket.end
    ).length;
  }
  return completedAtDays.filter(({ key }) => key === bucket.key).length;
}

/** Longest run of consecutive days with at least one completion. */
function longestStreak(days) {
  if (days.size === 0) return 0;
  const sorted = [...days].sort((a, b) => a - b);
  let best = 1;
  let run = 1;
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index] - sorted[index - 1] === 24 * 60 * 60 * 1000) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

export default function AnalyticsView() {
  const todos = useStore((s) => s.todos);
  const notes = useStore((s) => s.notes);
  const streak = useStore((s) => s.streak);
  const completedThisWeek = useStore((s) => s.completedThisWeek);
  const [period, setPeriod] = React.useState('daily');

  const today = dayKey(new Date());

  const stats = React.useMemo(() => {
    const completed = todos.filter((todo) => todo.completed);
    const open = todos.filter((todo) => !todo.completed);
    const completedToday = completed.filter(
      (todo) => todo.completedAt && dayKey(todo.completedAt) === today
    ).length;

    const completionDays = new Set(
      completed
        .filter((todo) => todo.completedAt)
        .map((todo) => {
          const date = new Date(todo.completedAt);
          date.setHours(0, 0, 0, 0);
          return date.getTime();
        })
    );

    return {
      openCount: open.length,
      completedCount: completed.length,
      completionRate: todos.length ? Math.round((completed.length / todos.length) * 100) : 0,
      completedToday,
      best: longestStreak(completionDays),
      activeDays: completionDays.size,
    };
  }, [todos, today]);

  // Normalized completion records reused by every chart.
  const completions = React.useMemo(
    () =>
      todos
        .filter((todo) => todo.completed && todo.completedAt)
        .map((todo) => {
          const date = new Date(todo.completedAt);
          return { todo, time: date.getTime(), key: dayKey(date) };
        }),
    [todos]
  );

  const buckets = React.useMemo(() => buildBuckets(period), [period]);
  const counts = React.useMemo(
    () => buckets.map((bucket) => countForBucket(bucket, completions)),
    [buckets, completions]
  );
  const max = Math.max(...counts, 1);
  const trendTotal = counts.reduce((sum, value) => sum + value, 0);

  const priorityBreakdown = React.useMemo(() => {
    return PRIORITY_ORDER.map((id) => {
      const open = todos.filter((todo) => !todo.completed && todo.priority === id).length;
      const done = todos.filter((todo) => todo.completed && todo.priority === id).length;
      return { id, open, done };
    });
  }, [todos]);
  const priorityMax = Math.max(...priorityBreakdown.map((row) => row.open + row.done), 1);

  const dueBuckets = React.useMemo(() => {
    const now = Date.now();
    const buckets = { overdue: 0, today: 0, week: 0, later: 0, none: 0 };
    const weekEnd = dayStart(1).getTime() + 7 * 24 * 60 * 60 * 1000;
    todos
      .filter((todo) => !todo.completed)
      .forEach((todo) => {
        if (!todo.dueDate) {
          buckets.none += 1;
          return;
        }
        const stamp = new Date(`${todo.dueDate}T23:59:59`).getTime();
        if (Number.isNaN(stamp) || stamp < now - 24 * 60 * 60 * 1000) buckets.overdue += 1;
        else if (dayKey(todo.dueDate) === today) buckets.today += 1;
        else if (stamp <= weekEnd) buckets.week += 1;
        else buckets.later += 1;
      });
    return buckets;
  }, [todos, today]);

  const weekStart = React.useMemo(() => dayStart(-6).getTime(), []);
  const notesEdited = notes.filter((note) => (note.updatedAt ?? 0) >= weekStart).length;

  return (
    <section aria-labelledby="analytics-heading">
      <div className="mb-5">
        <h2 id="analytics-heading" className="text-3xl font-semibold tracking-[-0.045em] text-ink sm:text-4xl">
          Analytics
        </h2>
        <p className="mt-1.5 text-sm text-muted">Built from your real task history — nothing estimated.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Open tasks" value={stats.openCount} icon={Activity} tone="plain" />
        <StatCard label="Completed all-time" value={stats.completedCount} icon={CheckCircle2} tone="lilac" />
        <StatCard label="Completion rate" value={`${stats.completionRate}%`} icon={TrendingUp} tone="sun" />
        <StatCard label="Done today" value={stats.completedToday} icon={CheckCircle2} tone="plain" />
        <StatCard label="This week" value={completedThisWeek} icon={CalendarClock} tone="lilac" />
        <StatCard
          label="Current streak"
          value={`${streak} ${streak === 1 ? 'day' : 'days'}`}
          icon={Flame}
          tone="pink"
        />
      </div>

      <div className="panel mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h3 className="text-lg text-ink">Completion trend</h3>
            <p className="text-sm text-muted">
              {trendTotal} {trendTotal === 1 ? 'task' : 'tasks'} in view
            </p>
          </div>
          <div className="flex rounded-xl border border-line bg-surface-2 p-1" role="tablist" aria-label="Trend period">
            {PERIODS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={period === option.id}
                onClick={() => setPeriod(option.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === option.id
                    ? 'bg-accent text-accent-fg shadow'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-1 text-[11px] text-faint">
          {period === 'daily'
            ? 'Tasks completed each day, last 14 days.'
            : period === 'weekly'
            ? 'Tasks completed each week, last 8 weeks.'
            : 'Tasks completed each month, last 6 months.'}
        </p>

        <div className="mt-5 overflow-x-auto pb-1" role="group" aria-label={`Tasks completed per ${period} bucket`}>
          <div
            className="flex h-40 min-w-[28rem] items-end gap-1.5 sm:gap-2"
            style={{ '--bars': buckets.length }}
          >
            {buckets.map((bucket, index) => {
              const count = counts[index];
              const height = count === 0 ? 3 : Math.max((count / max) * 100, 8);
              return (
                <div
                  key={bucket.key}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                >
                  <span className="h-4 text-[11px] text-faint">{count > 0 ? count : ''}</span>
                  <div className="relative flex w-full flex-1 items-end">
                    <motion.div
                      role="img"
                      aria-label={`${bucket.fullLabel}: ${count} completed`}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{
                        duration: 0.5,
                        delay: Math.min(index * 0.04, 0.4),
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
                  <span className="h-4 truncate text-[11px] text-faint">{bucket.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {trendTotal === 0 && (
          <p className="mt-4 text-sm text-muted">
            Nothing completed in this range yet. Checking one off is enough to start the chart.
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h3 className="text-lg text-ink">Priority breakdown</h3>
          <p className="mt-0.5 text-[11px] text-faint">Open vs. completed per priority.</p>
          <div className="mt-4 space-y-4">
            {priorityBreakdown.map((row) => {
              const meta = PRIORITY_META[row.id];
              const total = row.open + row.done;
              const openWidth = total ? (row.open / priorityMax) * 100 : 0;
              const doneWidth = total ? (row.done / priorityMax) * 100 : 0;
              return (
                <div key={row.id}>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className={`font-semibold ${meta.text}`}>{meta.label}</span>
                    <span className="text-faint">
                      {row.open} open · {row.done} done
                    </span>
                  </div>
                  <div className="mt-1.5 flex h-2.5 flex-col justify-center gap-0.5" aria-hidden="true">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-raised">
                      <motion.div
                        className={`h-full rounded-full ${meta.bar}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${openWidth}%` }}
                        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                      />
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-raised">
                      <motion.div
                        className="h-full rounded-full bg-accent/60"
                        initial={{ width: 0 }}
                        animate={{ width: `${doneWidth}%` }}
                        transition={{ duration: 0.6, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
                      />
                    </div>
                  </div>
                  <span className="sr-only">
                    {meta.label}: {row.open} open, {row.done} completed
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel p-5">
          <h3 className="text-lg text-ink">Where open tasks stand</h3>
          <p className="mt-0.5 text-[11px] text-faint">Due-date buckets across unfinished work.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <DueTile icon={Flame} label="Overdue" value={dueBuckets.overdue} tone="text-danger" />
            <DueTile icon={CalendarClock} label="Due today" value={dueBuckets.today} tone="text-warning" />
            <DueTile icon={Activity} label="This week" value={dueBuckets.week} tone="text-accent" />
            <DueTile icon={Inbox} label="Later" value={dueBuckets.later} tone="text-muted" />
            <DueTile icon={Inbox} label="No due date" value={dueBuckets.none} tone="text-faint" />
            <DueTile
              icon={Flame}
              label="Best streak"
              value={`${stats.best}d`}
              tone="text-success"
            />
          </div>
          <p className="mt-4 text-[11px] text-faint">
            Active completion days: {stats.activeDays} · Longest streak: {stats.best}{' '}
            {stats.best === 1 ? 'day' : 'days'}
          </p>
        </div>
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

function DueTile({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-2xl border border-line bg-raised/60 p-3">
      <Icon className={`h-4 w-4 ${tone}`} aria-hidden="true" />
      <p className="mt-1.5 text-xl font-bold tracking-[-0.04em] text-ink">{value}</p>
      <p className="text-[11px] text-faint">{label}</p>
    </div>
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
