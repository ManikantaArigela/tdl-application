import React from 'react';
import { useStore } from '../store/useStore';
import TodoList from '../components/TodoList';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Done' },
];

export default function TodosView({ filter: initialFilter = 'all' } = {}) {
  const todos = useStore((s) => s.todos);
  const [filter, setFilter] = React.useState(initialFilter);

  React.useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  const open = todos.filter((todo) => !todo.completed).length;
  const done = todos.length - open;

  return (
    <section aria-labelledby="todos-heading">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="todos-heading" className="text-3xl text-ink">
            Todos
          </h2>
          <p className="mt-1 text-sm text-muted">
            {open} open · {done} done
          </p>
        </div>

        <div
          className="flex items-center gap-1 rounded-xl border border-line bg-panel p-1"
          role="group"
          aria-label="Filter todos"
        >
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              aria-pressed={filter === option.id}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === option.id ? 'bg-accent/10 text-ink' : 'text-muted hover:bg-raised'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <TodoList filter={filter} />
    </section>
  );
}
