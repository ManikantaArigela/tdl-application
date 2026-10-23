import React from 'react';
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
        <h2 id="analytics-heading" className="text-3xl text-ink">
          Analytics
        </h2>
        <p className="mt-1 text-sm text-muted">Based on the tasks and notes on this device.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open tasks" value={open} icon={Activity} />
        <StatCard label="Completed" value={completed} icon={CheckCircle2} />
        <StatCard label="Completion rate" value={`${completionRate}%`} icon={CheckCircle2} />
        <StatCard label="Current streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} icon={Flame} />
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
              <div key={day.key} className="flex flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[11px] text-faint">{count > 0 ? count : ''}</span>
                <div
                  role="img"
                  aria-label={`${day.fullLabel}: ${count} completed`}
                  className={`w-full rounded-t-md transition-colors duration-200 ${
                    count > 0 ? 'bg-accent/70 hover:bg-accent' : 'bg-line'
                  }`}
                  style={{ height: `${height}%` }}
                />
                <span className="text-[11px] text-faint">{day.label}</span>
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
        <PenLine className="h-4 w-4 text-accent" aria-hidden="true" />
        <p className="text-sm text-muted">
          <span className="font-medium text-ink">{notesEdited}</span>{' '}
          {notesEdited === 1 ? 'note' : 'notes'} edited in the last seven days.
        </p>
      </div>
    </section>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{label}</span>
        <Icon className="h-4 w-4 text-faint" aria-hidden="true" />
      </div>
      <p className="mt-2 font-display text-2xl text-ink">{value}</p>
    </div>
  );
}
