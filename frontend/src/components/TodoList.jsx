import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatDate, isOverdue, plural } from '../lib/format';

const PRIORITIES = [
  { id: 'low', label: 'Low', dot: 'bg-success' },
  { id: 'medium', label: 'Medium', dot: 'bg-warning' },
  { id: 'high', label: 'High', dot: 'bg-danger' },
];

const priorityMeta = (value) =>
  PRIORITIES.find((priority) => priority.id === value) ?? PRIORITIES[1];

export default function TodoList({ filter = 'all' }) {
  const todos = useStore((s) => s.todos);
  const addTodo = useStore((s) => s.addTodo);
  const toggleTodo = useStore((s) => s.toggleTodo);
  const deleteTodo = useStore((s) => s.deleteTodo);
  const reorderTodos = useStore((s) => s.reorderTodos);

  const reduceMotion = useReducedMotion();
  const [canDrag, setCanDrag] = React.useState(false);
  const [text, setText] = React.useState('');
  const [priority, setPriority] = React.useState('medium');
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    try {
      setCanDrag(!reduceMotion && window.matchMedia('(pointer: fine)').matches);
    } catch {
      setCanDrag(false);
    }
  }, [reduceMotion]);

  const openTodos = todos.filter((todo) => !todo.completed);
  const doneTodos = todos.filter((todo) => todo.completed);

  const list = filter === 'open' ? openTodos : filter === 'done' ? doneTodos : todos;

  const handleAdd = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    const created = await addTodo({ text: value, priority, completed: false });
    if (created) {
      setText('');
      inputRef.current?.focus();
    }
  };

  const move = (id, direction) => {
    const visibleIndex = list.findIndex((todo) => todo.id === id);
    const target = list[visibleIndex + direction];
    if (visibleIndex === -1 || !target) return;

    const from = todos.findIndex((todo) => todo.id === id);
    const to = todos.findIndex((todo) => todo.id === target.id);
    if (from < 0 || to < 0) return;

    const next = [...todos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    reorderTodos(next);
  };

  const handleDragEnd = (todo, info) => {
    if (!canDrag) return;
    const steps = Math.round(info.offset.y / 56);
    if (steps === 0) return;

    const visibleIndex = list.findIndex((item) => item.id === todo.id);
    const targetVisible = list[Math.min(Math.max(visibleIndex + steps, 0), list.length - 1)];
    if (!targetVisible || targetVisible.id === todo.id) return;

    const from = todos.findIndex((item) => item.id === todo.id);
    const to = todos.findIndex((item) => item.id === targetVisible.id);
    if (from < 0 || to < 0) return;

    const next = [...todos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    reorderTodos(next);
  };

  const clearCompleted = async () => {
    if (doneTodos.length === 0) return;
    if (!window.confirm(`Delete ${doneTodos.length} completed ${plural(doneTodos.length, 'todo')}?`)) {
      return;
    }
    await Promise.all(doneTodos.map((todo) => deleteTodo(todo.id)));
  };

  const renderItem = (todo) => {
    const priorityInfo = priorityMeta(todo.priority);
    const overdue = !todo.completed && isOverdue(todo.dueDate);
    const indexInList = list.findIndex((item) => item.id === todo.id);

    return (
      <motion.li
        key={todo.id}
        layout={!reduceMotion}
        drag={canDrag ? 'y' : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.12}
        dragMomentum={false}
        onDragEnd={(_event, info) => handleDragEnd(todo, info)}
        transition={{ duration: reduceMotion ? 0 : 0.2 }}
        className="group relative flex items-start gap-3 rounded-xl border border-line bg-panel p-3.5"
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={Boolean(todo.completed)}
          aria-label={`${todo.completed ? 'Mark incomplete' : 'Mark complete'}: ${todo.text}`}
          onClick={() => toggleTodo(todo.id)}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            todo.completed
              ? 'border-accent bg-accent text-accent-fg'
              : 'border-line hover:border-accent'
          }`}
        >
          {todo.completed && <Check className="h-3 w-3" aria-hidden="true" />}
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={`text-sm leading-relaxed ${
              todo.completed ? 'text-faint line-through' : 'text-ink'
            }`}
          >
            {todo.text}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${priorityInfo.dot}`} aria-hidden="true" />
              {priorityInfo.label}
            </span>
            {todo.dueDate && (
              <span
                className={`inline-flex items-center gap-1 ${
                  overdue ? 'font-medium text-danger' : 'text-faint'
                }`}
              >
                <Clock className="h-3 w-3" aria-hidden="true" />
                {overdue ? 'Overdue · ' : ''}
                {formatDate(todo.dueDate)}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <GripVertical
            className="mr-0.5 hidden h-4 w-4 cursor-grab text-faint md:block"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => move(todo.id, -1)}
            disabled={indexInList <= 0}
            className="icon-btn h-7 w-7 opacity-100 disabled:pointer-events-none disabled:opacity-25 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            aria-label={`Move up: ${todo.text}`}
          >
            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => move(todo.id, 1)}
            disabled={indexInList === list.length - 1}
            className="icon-btn h-7 w-7 opacity-100 disabled:pointer-events-none disabled:opacity-25 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            aria-label={`Move down: ${todo.text}`}
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => deleteTodo(todo.id)}
            className="icon-btn h-7 w-7 hover:text-danger"
            aria-label={`Delete todo: ${todo.text}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </motion.li>
    );
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="panel flex flex-col gap-2 p-3 sm:flex-row">
        <label htmlFor="new-todo" className="sr-only">
          New todo
        </label>
        <input
          id="new-todo"
          ref={inputRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Add a task…"
          className="input flex-1 border-transparent bg-transparent focus:border-line"
        />
        <div className="flex items-center gap-2">
          <label htmlFor="new-todo-priority" className="sr-only">
            Priority
          </label>
          <select
            id="new-todo-priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="input w-auto py-2 text-xs"
          >
            {PRIORITIES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary shrink-0" disabled={!text.trim()}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add
          </button>
        </div>
      </form>

      {filter !== 'done' && (
        <section aria-labelledby="open-todos-heading">
          <h3
            id="open-todos-heading"
            className="mb-3 text-xs font-medium tracking-wide text-muted"
          >
            Open ({openTodos.length})
          </h3>
          {openTodos.length === 0 ? (
            <p className="panel px-4 py-8 text-center text-sm text-muted">
              Nothing open. Add a task above.
            </p>
          ) : (
            <ul className="space-y-2">{openTodos.map(renderItem)}</ul>
          )}
        </section>
      )}

      {filter !== 'open' && doneTodos.length > 0 && (
        <section aria-labelledby="done-todos-heading" className="border-t border-line pt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 id="done-todos-heading" className="text-xs font-medium tracking-wide text-muted">
              Done ({doneTodos.length})
            </h3>
            <button
              type="button"
              onClick={clearCompleted}
              className="btn-danger px-2 py-1 text-xs"
            >
              Clear completed
            </button>
          </div>
          <ul className="space-y-2">{doneTodos.map(renderItem)}</ul>
        </section>
      )}
    </div>
  );
}
