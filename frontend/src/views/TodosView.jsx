import React from 'react';
import { useStore } from '../store/useStore';
import TodoList from '../components/TodoList';

export default function TodosView({ filter: initialFilter = 'all' } = {}) {
  const todos = useStore((s) => s.todos);
  const scope = initialFilter === 'open' ? 'today' : 'all';

  const open = todos.filter((todo) => !todo.completed).length;
  const done = todos.length - open;
  const pct = todos.length > 0 ? Math.round((done / todos.length) * 100) : 0;

  return (
    <section aria-labelledby="todos-heading">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
            {scope === 'today' ? 'Today' : 'Task board'}
          </p>
          <h2 id="todos-heading" className="mt-1 text-3xl text-ink">
            {scope === 'today' ? 'Today’s tasks' : 'Tasks'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {open} open · {done} done
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-2.5">
          <span className="text-xs font-medium text-muted tabular-nums">{pct}% done</span>
          <span
            className="h-1.5 w-24 overflow-hidden rounded-full bg-raised"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Task completion"
          >
            <span
              className="block h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </span>
        </div>
      </div>

      <TodoList scope={scope} />
    </section>
  );
}
