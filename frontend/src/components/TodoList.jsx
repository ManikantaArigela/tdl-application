import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { CalendarDays, Clock3, ListChecks, Plus, Repeat, Sparkles } from 'lucide-react';
import { useStore } from '../store/useStore';
import { dayKey, dueTimestamp, plural } from '../lib/format';
import TodoCard, { PRIORITIES } from './TodoCard';
import CompletionBag from './CompletionBag';
import CarryOverBox from './CarryOverBox';

/** Date inputs give YYYY-MM-DD; store noon so timezones can't shift the day. */
const toDueStamp = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const todayStamp = () => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
};

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const dueValue = (todo) => dueTimestamp(todo) ?? Number.POSITIVE_INFINITY;

/** Extract viewport coordinates from a pointer/mouse/touch event. */
const pointerPoint = (event) => {
  if (!event) return null;
  if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
    return { x: event.clientX, y: event.clientY };
  }
  const touch = event.changedTouches?.[0] ?? event.touches?.[0];
  return touch ? { x: touch.clientX, y: touch.clientY } : null;
};

export default function TodoList({ scope = 'all' }) {
  const todos = useStore((s) => s.todos);
  const addTodo = useStore((s) => s.addTodo);
  const toggleTodo = useStore((s) => s.toggleTodo);
  const updateTodo = useStore((s) => s.updateTodo);
  const deleteTodo = useStore((s) => s.deleteTodo);
  const reorderTodos = useStore((s) => s.reorderTodos);

  const [text, setText] = React.useState('');
  const [priority, setPriority] = React.useState('medium');
  const [dueDate, setDueDate] = React.useState('');
  const [dueTime, setDueTime] = React.useState('');
  const [repeat, setRepeat] = React.useState('none');
  const [sort, setSort] = React.useState('priority');
  const [canDrag, setCanDrag] = React.useState(false);
  const [draggingId, setDraggingId] = React.useState(null);
  const [activeZone, setActiveZone] = React.useState(null);
  const inputRef = React.useRef(null);

  const dropZones = React.useRef({});
  const doneZoneRef = React.useCallback((element) => {
    dropZones.current.done = element;
  }, []);
  const carryZoneRef = React.useCallback((element) => {
    dropZones.current.carry = element;
  }, []);

  React.useEffect(() => {
    let query;
    try {
      query = window.matchMedia('(hover: hover) and (pointer: fine)');
    } catch {
      return undefined;
    }
    const sync = () => setCanDrag(query.matches);
    sync();
    if (query.addEventListener) query.addEventListener('change', sync);
    else query.addListener(sync);
    return () => {
      if (query.removeEventListener) query.removeEventListener('change', sync);
      else query.removeListener(sync);
    };
  }, []);

  const today = dayKey(new Date());
  const openTodos = todos.filter((todo) => !todo.completed);
  const completedTodos = todos.filter((todo) => todo.completed);

  // Tasks that hit the end of the day without being finished.
  const carriedTodos = openTodos.filter(
    (todo) => todo.dueDate && dayKey(todo.dueDate) <= today
  );

  const visibleOpen =
    scope === 'today'
      ? openTodos.filter((todo) => todo.dueDate && dayKey(todo.dueDate) <= today)
      : openTodos;

  // Priority is the default lens; manual keeps the stored order editable.
  const sortedOpen = (() => {
    if (sort === 'manual') return visibleOpen;
    const items = [...visibleOpen];
    if (sort === 'priority') {
      items.sort(
        (a, b) =>
          (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1) ||
          dueValue(a) - dueValue(b)
      );
    } else {
      items.sort(
        (a, b) =>
          dueValue(a) - dueValue(b) ||
          (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1)
      );
    }
    return items;
  })();

  const zoneAtPoint = (point) => {
    if (!point) return null;
    for (const [zone, element] of Object.entries(dropZones.current)) {
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      if (
        point.x >= rect.left &&
        point.x <= rect.right &&
        point.y >= rect.top &&
        point.y <= rect.bottom
      ) {
        return zone;
      }
    }
    return null;
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    const created = await addTodo({
      text: value,
      priority,
      completed: false,
      dueDate: toDueStamp(dueDate),
      dueTime: dueDate ? dueTime || null : null,
      repeat,
    });
    if (created) {
      setText('');
      setDueDate('');
      setDueTime('');
      setRepeat('none');
      inputRef.current?.focus();
    }
  };

  const move = (id, direction) => {
    const visibleIndex = visibleOpen.findIndex((todo) => todo.id === id);
    const target = visibleOpen[visibleIndex + direction];
    if (visibleIndex === -1 || !target) return;

    const from = todos.findIndex((todo) => todo.id === id);
    const to = todos.findIndex((todo) => todo.id === target.id);
    if (from < 0 || to < 0) return;

    const next = [...todos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    reorderTodos(next);
  };

  const carryTodo = (id) => {
    const todo = todos.find((item) => item.id === id);
    if (!todo) return;
    const alreadyCarried =
      !todo.completed && todo.dueDate && dayKey(todo.dueDate) === today;
    if (alreadyCarried) return;
    updateTodo(id, { completed: false, completedAt: null, dueDate: todayStamp() });
  };

  const releaseDueDate = (id) => updateTodo(id, { dueDate: null, dueTime: null });

  const handleDragStart = (todo) => setDraggingId(todo.id);

  const handleDrag = (event) => {
    const zone = zoneAtPoint(pointerPoint(event));
    setActiveZone((current) => (current === zone ? current : zone));
  };

  const handleDragEnd = (event, todo) => {
    const zone = zoneAtPoint(pointerPoint(event));
    setDraggingId(null);
    setActiveZone(null);
    if (!zone) return;
    if (zone === 'done') {
      if (!todo.completed) toggleTodo(todo.id);
      return;
    }
    if (zone === 'carry') carryTodo(todo.id);
  };

  const clearCompleted = async () => {
    if (completedTodos.length === 0) return;
    if (
      !window.confirm(
        `Delete ${completedTodos.length} completed ${plural(completedTodos.length, 'task')}?`
      )
    ) {
      return;
    }
    await Promise.all(completedTodos.map((todo) => deleteTodo(todo.id)));
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-5">
        <form onSubmit={handleAdd} className="panel-raised space-y-2.5 p-3">
          <div className="relative">
            <ListChecks
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
              aria-hidden="true"
            />
            <label htmlFor="new-todo" className="sr-only">
              New task
            </label>
            <input
              id="new-todo"
              ref={inputRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Add a task…"
              className="input border-transparent bg-transparent py-2.5 pl-9 focus:border-line"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="new-todo-priority" className="sr-only">
              Priority
            </label>
            <select
              id="new-todo-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className="input w-auto py-1.5 text-xs"
              title="Priority"
            >
              {PRIORITIES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} priority
                </option>
              ))}
            </select>

            <div className="relative">
              <CalendarDays
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint"
                aria-hidden="true"
              />
              <label htmlFor="new-todo-due" className="sr-only">
                Due date
              </label>
              <input
                id="new-todo-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="input w-[9.25rem] py-1.5 pl-8 text-xs text-muted"
                title="Due date"
              />
            </div>

            <div className="relative">
              <Clock3
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint"
                aria-hidden="true"
              />
              <label htmlFor="new-todo-time" className="sr-only">
                Due time
              </label>
              <input
                id="new-todo-time"
                type="time"
                value={dueTime}
                onChange={(event) => setDueTime(event.target.value)}
                className="input w-[6.75rem] py-1.5 pl-8 text-xs text-muted"
                title="Due time"
              />
            </div>

            <div className="relative">
              <Repeat
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint"
                aria-hidden="true"
              />
              <label htmlFor="new-todo-repeat" className="sr-only">
                Repeat
              </label>
              <select
                id="new-todo-repeat"
                value={repeat}
                onChange={(event) => setRepeat(event.target.value)}
                className="input w-auto py-1.5 pl-8 text-xs"
                title="Repeat"
              >
                <option value="none">No repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            <button
              type="submit"
              className="btn-primary ml-auto shrink-0"
              disabled={!text.trim()}
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Add
            </button>
          </div>
        </form>

        <section aria-labelledby="open-tasks-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3
                id="open-tasks-heading"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-muted"
              >
                {scope === 'today' ? 'Due today' : 'Open tasks'} ({visibleOpen.length})
              </h3>
              {canDrag && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-faint">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  {sort === 'manual'
                    ? 'Drag a card onto a box to complete it or carry it over.'
                    : `Sorted by ${sort === 'priority' ? 'priority' : 'due date'} — choose Manual to reorder.`}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="todo-sort" className="text-[11px] uppercase tracking-[0.12em] text-faint">
                Sort
              </label>
              <select
                id="todo-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="input w-auto py-1.5 text-xs"
              >
                <option value="priority">Priority</option>
                <option value="due">Due date</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>

          {visibleOpen.length === 0 ? (
            <div className="panel flex flex-col items-center px-6 py-12 text-center">
              <ListChecks className="h-7 w-7 text-faint" aria-hidden="true" />
              <p className="mt-3 text-sm text-muted">
                {scope === 'today'
                  ? 'Nothing due today. Add a task above or check the carried-over box.'
                  : 'All clear. Add a task above to get started.'}
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              <AnimatePresence initial={false}>
                {sortedOpen.map((todo, index) => (
                  <TodoCard
                    key={todo.id}
                    todo={todo}
                    index={index}
                    count={sortedOpen.length}
                    canDrag={canDrag}
                    canReorder={sort === 'manual'}
                    isDragging={draggingId === todo.id}
                    onToggle={toggleTodo}
                    onDelete={deleteTodo}
                    onMove={move}
                    onCarry={carryTodo}
                    onDragStart={handleDragStart}
                    onDrag={handleDrag}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-0.5">
        <CompletionBag
          completed={completedTodos}
          total={todos.length}
          active={activeZone === 'done'}
          zoneRef={doneZoneRef}
          onUncomplete={toggleTodo}
          onClear={clearCompleted}
        />

        <CarryOverBox
          tasks={carriedTodos}
          active={activeZone === 'carry'}
          zoneRef={carryZoneRef}
          onComplete={toggleTodo}
          onRelease={releaseDueDate}
        />
      </aside>
    </div>
  );
}
