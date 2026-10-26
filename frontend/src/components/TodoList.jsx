import React from 'react';
import { AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  CheckCircle2,
  Inbox,
  ListChecks,
  Plus,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { dayKey, dueInputValue, dueTimestamp, plural, toDueStamp } from '../lib/format';
import {
  DatePicker,
  Dropdown,
  TimePicker,
  dateLabel,
  REPEAT_OPTIONS,
  timeLabel,
} from './FormControls';
import TodoCard, { DURATIONS, PRIORITIES } from './TodoCard';
import CompletionBag from './CompletionBag';
import CarryOverBox from './CarryOverBox';

const todayStamp = () => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
};

const durationOptions = [
  { id: '', label: 'No duration' },
  ...DURATIONS.map((minutes) => ({ id: String(minutes), label: `${minutes} min` })),
];
const sortOptions = [
  { id: 'priority', label: 'Priority' },
  { id: 'due', label: 'Due date' },
  { id: 'manual', label: 'Manual' },
];

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
  const settings = useStore((s) => s.settings);

  const [text, setText] = React.useState('');
  const [priority, setPriority] = React.useState(settings.defaultPriority);
  const [dueDate, setDueDate] = React.useState('');
  const [dueTime, setDueTime] = React.useState('');
  const [duration, setDuration] = React.useState('');
  const [repeat, setRepeat] = React.useState('none');
  const [saving, setSaving] = React.useState(false);
  const [sort, setSort] = React.useState(settings.defaultSort);
  const [canDrag, setCanDrag] = React.useState(false);
  const reduceMotion = useReducedMotion();
  const [dragId, setDragId] = React.useState(null);
  const [dragPoint, setDragPoint] = React.useState(null);
  const [dragGhost, setDragGhost] = React.useState(null);
  const [activeZone, setActiveZone] = React.useState(null);
  const inputRef = React.useRef(null);

  // A task can only belong to one drop zone; every registered element maps to
  // one of these keys.
  const dropZones = React.useRef({ done: [], carry: [] });
  const registerZone = React.useCallback((zone) => {
    return (element) => {
      const list = dropZones.current[zone];
      if (!element) {
        dropZones.current[zone] = list.filter((item) => item.isConnected);
        return;
      }
      if (!list.includes(element)) list.push(element);
    };
  }, []);
  const doneZoneRef = registerZone('done');
  const carryZoneRef = registerZone('carry');
  const doneStripRef = registerZone('done');
  const carryStripRef = registerZone('carry');

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

  // The completed bag only holds tasks finished today; earlier completions
  // stay in the store (and analytics) but are not listed here.
  const completedToday = React.useMemo(
    () =>
      todos.filter(
        (todo) => todo.completed && todo.completedAt && dayKey(todo.completedAt) === today
      ),
    [todos, today]
  );

  const todosRef = React.useRef(todos);
  todosRef.current = todos;

  // Tasks that hit the end of the day without being finished.
  const carriedTodos = openTodos.filter(
    (todo) => todo.dueDate && dayKey(todo.dueDate) <= today
  );

  const visibleOpen =
    scope === 'today'
      ? openTodos.filter((todo) => todo.dueDate && dayKey(todo.dueDate) <= today)
      : openTodos;

  // The Completed-today box: the LIST shows everything finished today (so any
  // drop gives feedback), while the RATE is scoped to today's plate only —
  // tasks dated today (carried ones are re-dated to today when carried).
  const isDueToday = (todo) => todo.dueDate && dayKey(todo.dueDate) === today;
  const openDueToday = openTodos.filter(isDueToday);
  const completedDueToday = completedToday.filter(isDueToday);

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
    for (const zone of ['done', 'carry']) {
      for (const element of dropZones.current[zone]) {
        if (!element?.isConnected) continue;
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
    }
    return null;
  };

  // ---- Drag (mouse immediate, touch long-press) --------------------------
  // The dragged card leaves the list (its slot becomes a dashed gap) and a
  // floating copy travels under the pointer, anchored at the grab point.
  const beginDrag = React.useCallback((todo, grabX, grabY) => {
    const element = document.querySelector(`[data-todo-id="${todo.id}"]`);
    if (element) {
      const rect = element.getBoundingClientRect();
      setDragGhost({
        w: rect.width,
        offX: grabX == null ? rect.width / 2 : Math.min(Math.max(grabX - rect.left, 16), rect.width - 16),
        offY: grabY == null ? 28 : Math.min(Math.max(grabY - rect.top, 12), rect.height - 12),
      });
    } else {
      setDragGhost(null);
    }
    setDragId((current) => current ?? todo.id);
  }, []);

  const finishDrag = React.useCallback((zone, id) => {
    if (!id || !zone) return;
    const todo = todosRef.current.find((item) => item.id === id);
    if (!todo) return;
    if (zone === 'done' && !todo.completed) {
      toggleTodo(todo.id);
      return;
    }
    if (zone === 'carry') {
      const alreadyCarried =
        !todo.completed && todo.dueDate && dayKey(todo.dueDate) === dayKey(new Date());
      if (alreadyCarried) return;
      updateTodo(id, { completed: false, completedAt: null, dueDate: todayStamp() });
    }
  }, [toggleTodo, updateTodo]);

  React.useEffect(() => {
    if (!dragId) return undefined;

    let frame = 0;
    let lastPoint = null;

    const handleMove = (event) => {
      lastPoint = { x: event.clientX, y: event.clientY };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setDragPoint(lastPoint);
        const zone = zoneAtPoint(lastPoint);
        setActiveZone((current) => (current === zone ? current : zone));
      });
    };

    const handleEnd = (event) => {
      const zone = zoneAtPoint(pointerPoint(event));
      const id = dragId;
      if (frame) cancelAnimationFrame(frame);
      setDragId(null);
      setDragPoint(null);
      setDragGhost(null);
      setActiveZone(null);
      finishDrag(zone, id);
    };

    // During a touch drag the page must not scroll under the finger.
    const blockScroll = (event) => event.preventDefault();

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
    window.addEventListener('touchmove', blockScroll, { passive: false });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
      window.removeEventListener('touchmove', blockScroll);
    };
    // toggleTodo/updateTodo are stable store actions; dragId scopes the listeners.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId, finishDrag]);

  const handleAdd = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || saving) return; // guard: no duplicate tasks from double submits
    setSaving(true);
    // A time without an explicit date lands on today, so time picks never get lost.
    const effectiveDate = dueDate || (dueTime ? dueInputValue(Date.now()) : '');
    const created = await addTodo({
      text: value,
      priority,
      completed: false,
      dueDate: toDueStamp(effectiveDate),
      dueTime: effectiveDate ? dueTime || null : null,
      duration: duration === '' ? null : Number(duration),
      repeat,
    });
    setSaving(false);
    if (created) {
      setText('');
      setDueDate('');
      setDueTime('');
      setDuration('');
      setRepeat('none');
      setPriority(settings.defaultPriority);
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

  const handleDelete = async (id) => {
    if (settings.confirmDelete && !window.confirm('Delete this task?')) return;
    await deleteTodo(id);
  };

  const clearCompleted = async () => {
    if (completedToday.length === 0) return;
    if (
      settings.confirmDelete &&
      !window.confirm(
        `Delete ${completedToday.length} completed ${plural(completedToday.length, 'task')} from today? Older history stays in analytics.`
      )
    ) {
      return;
    }
    await Promise.all(completedToday.map((todo) => deleteTodo(todo.id)));
  };

  const zoneLabel =
    activeZone === 'done' ? 'Release to complete' : activeZone === 'carry' ? 'Release to carry over' : 'Drag to a drop zone';

  // The task currently under the pointer, rendered as the traveling card.
  const dragTodo = dragId ? todos.find((todo) => todo.id === dragId) : null;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-5">
        <form onSubmit={handleAdd} className="panel-raised space-y-3 p-3 sm:p-4">
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
              className="input border-line bg-raised py-2.5 pl-9 text-[15px]"
            />
          </div>

          {/* Priority + repeat dropdowns with themed open lists. */}
          <div className="flex flex-wrap items-center gap-2">
            <Dropdown
              id="new-todo-priority"
              title="Priority"
              value={priority}
              onChange={setPriority}
              options={PRIORITIES.map((option) => ({
                id: option.id,
                label: option.label,
                dot: option.dot,
              }))}
              className="w-[calc(50%-0.25rem)] sm:w-[8.5rem]"
            />
            <Dropdown
              id="new-todo-repeat"
              title="Repeat"
              value={repeat}
              onChange={setRepeat}
              options={REPEAT_OPTIONS}
              className="w-[calc(50%-0.25rem)] sm:w-[8.5rem]"
            />
          </div>

          {/* Due date and time as themed popups — calendar and time list. */}
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker
              id="new-todo-due"
              title="Due date"
              value={dueDate}
              onChange={setDueDate}
              className="w-[calc(50%-0.25rem)] sm:w-[9.75rem]"
            />

            <TimePicker
              id="new-todo-time"
              title="Due time"
              value={dueTime}
              onChange={(value) => {
                setDueTime(value);
                // A time without a date means today — fill it in automatically.
                if (value && !dueDate) setDueDate(dueInputValue(Date.now()));
              }}
              className="w-[calc(50%-0.25rem)] sm:w-[7.75rem]"
            />

            <Dropdown
              id="new-todo-duration"
              title="Duration"
              value={duration}
              onChange={setDuration}
              options={durationOptions}
              className="min-w-0 w-auto flex-1 sm:w-[8.25rem] sm:flex-none"
            />

            <button
              type="submit"
              className="btn-primary h-9 shrink-0 justify-center sm:ml-auto"
              disabled={!text.trim() || saving}
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Add
            </button>
          </div>

          {dueDate && (
            <p className="text-[11px] text-faint">
              Due{' '}
              {dueDate === dueInputValue(Date.now()) ? 'today' : dateLabel(dueDate)}
              {dueTime ? ` at ${timeLabel(dueTime)}` : ''}.
            </p>
          )}
        </form>

        <section aria-labelledby="open-tasks-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3
                id="open-tasks-heading"
                className="text-xs font-semibold text-muted"
              >
                {scope === 'today' ? 'Due today' : 'Open tasks'} ({visibleOpen.length})
              </h3>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-faint">
                {canDrag ? (
                  <>Drag a card onto Completed or Carried over to move it.</>
                ) : (
                  <>Long-press a card to drag it, or use the ✓ and ↻ buttons.</>
                )}
                {sort !== 'manual' &&
                  ` Sorted by ${sort === 'priority' ? 'priority' : 'due date'} — choose Manual to reorder.`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="todo-sort" className="text-[11px] font-medium text-faint">
                Sort
              </label>
              <Dropdown
                id="todo-sort"
                title="Sort tasks"
                value={sort}
                onChange={setSort}
                options={sortOptions}
                className="w-[8.5rem]"
              />
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
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:gap-3">
              <AnimatePresence initial={false}>
                {sortedOpen.map((todo, index) => (
                  <TodoCard
                    key={todo.id}
                    todo={todo}
                    index={index}
                    count={sortedOpen.length}
                    canDrag={canDrag}
                    canReorder={sort === 'manual'}
                    isDragging={dragId === todo.id}
                    onToggle={toggleTodo}
                    onUpdate={updateTodo}
                    onDelete={handleDelete}
                    onMove={move}
                    onCarry={carryTodo}
                    onDragActivate={beginDrag}
                  />
                ))}
              </AnimatePresence>
            </ul>
          )}

          {/* Touch-friendly drop strips: near the list so a long-press drag
              never needs the page to scroll. */}
          {!canDrag && visibleOpen.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-3 lg:hidden">
              <div
                ref={doneStripRef}
                aria-hidden="true"
                className={`flex items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-3 py-3 text-[11px] font-medium transition-colors ${
                  activeZone === 'done'
                    ? 'border-success bg-success/10 text-success'
                    : 'border-line text-faint'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Drop to complete
              </div>
              <div
                ref={carryStripRef}
                aria-hidden="true"
                className={`flex items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-3 py-3 text-[11px] font-medium transition-colors ${
                  activeZone === 'carry'
                    ? 'border-warning bg-warning/10 text-warning'
                    : 'border-line text-faint'
                }`}
              >
                <Inbox className="h-3.5 w-3.5" aria-hidden="true" />
                Drop to carry over
              </div>
            </div>
          )}
        </section>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-0.5">
        <CompletionBag
          completed={completedToday}
          todayDone={completedDueToday.length}
          todayOpen={openDueToday.length}
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

      {/* The dragged card leaves the list and travels with the pointer. */}
      {dragId && dragPoint && (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            left: dragPoint.x - (dragGhost?.offX ?? 0),
            top: dragPoint.y - (dragGhost?.offY ?? 0),
            width: dragGhost?.w,
          }}
        >
          <div
            className="opacity-95 drop-shadow-lift"
            style={reduceMotion ? undefined : { transform: 'rotate(2deg) scale(1.02)' }}
          >
            {dragTodo && (
              <TodoCard
                todo={dragTodo}
                ghost
                index={0}
                count={1}
                canDrag={false}
                canReorder={false}
                isDragging={false}
                onToggle={() => {}}
                onUpdate={async () => {}}
                onDelete={() => {}}
                onMove={() => {}}
                onCarry={() => {}}
              />
            )}
          </div>
          <div role="status" className="mt-2 flex justify-center">
            <span className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-canvas shadow-lift">
              {zoneLabel}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
