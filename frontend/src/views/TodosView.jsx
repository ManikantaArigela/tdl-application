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
          <h2 id="todos-heading" className="text-3xl font-semibold tracking-[-0.045em] text-ink sm:text-4xl">
            {scope === 'today' ? 'Today’s tasks' : 'Tasks'}
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            {open} open · {done} done
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-full border border-line bg-panel px-4 py-2.5 shadow-panel">
          <span className="text-xs font-semibold text-muted tabular-nums">{pct}% done</span>
          <span
            className="h-1.5 w-24 overflow-hidden rounded-full bg-raised"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Task completion"
          >
            <span
              className="block h-full rounded-full bg-gradient-to-r from-accent to-pop-pink transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </span>
        </div>
      </div>

      <TodoList scope={scope} />
    </section>
  );
}
