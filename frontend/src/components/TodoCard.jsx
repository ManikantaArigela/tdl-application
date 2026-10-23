import React from 'react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CalendarDays,
  Check,
  Repeat,
  Trash2,
} from 'lucide-react';
import { dayKey, dueTimestamp, formatDate, formatDueTime, isOverdue } from '../lib/format';

export const PRIORITIES = [
  {
    id: 'low',
    label: 'Low',
    dot: 'bg-success',
    aura: 'bg-success/20',
    chip: 'text-success',
  },
  {
    id: 'medium',
    label: 'Medium',
    dot: 'bg-warning',
    aura: 'bg-warning/20',
    chip: 'text-warning',
  },
  {
    id: 'high',
    label: 'High',
    dot: 'bg-danger',
    aura: 'bg-danger/20',
    chip: 'text-danger',
  },
];

const priorityMeta = (value) =>
  PRIORITIES.find((priority) => priority.id === value) ?? PRIORITIES[1];

export default function TodoCard({
  todo,
  canDrag = false,
  canReorder = true,
  isDragging = false,
  index = 0,
  count = 1,
  onToggle,
  onDelete,
  onMove,
  onCarry,
  onDragStart,
  onDrag,
  onDragEnd,
}) {
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();

  const priority = priorityMeta(todo.priority);
  const dueTs = dueTimestamp(todo);
  const overdue =
    !todo.completed &&
    (isOverdue(todo.dueDate) || (Boolean(todo.dueTime) && dueTs !== null && dueTs < Date.now()));
  const dueToday = Boolean(todo.dueDate) && dayKey(todo.dueDate) === dayKey(new Date());
  const repeats = todo.repeat && todo.repeat !== 'none';

  // Grab the card anywhere that isn't an interactive control.
  const handlePointerDown = (event) => {
    if (!canDrag || event.button !== 0) return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('button, a, input, select, textarea, [data-no-drag]')
    ) {
      return;
    }
    dragControls.start(event);
  };

  return (
    <motion.article
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -8, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.7 }}
      whileHover={reduceMotion || isDragging ? undefined : { y: -3 }}
      drag={canDrag}
      dragControls={dragControls}
      dragListener={false}
      dragSnapToOrigin
      dragMomentum={false}
      dragElastic={0.9}
      onPointerDown={handlePointerDown}
      onDragStart={() => onDragStart?.(todo)}
      onDrag={(event) => onDrag?.(event, todo)}
      onDragEnd={(event) => onDragEnd?.(event, todo)}
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-panel transition-[border-color,box-shadow] duration-200 hover:border-accent/30 hover:shadow-lift ${
        canDrag ? 'cursor-grab select-none active:cursor-grabbing' : ''
      } ${isDragging ? 'z-30 cursor-grabbing shadow-lift ring-2 ring-accent/40' : ''}`}
    >
      {/* Priority aura on hover */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full blur-2xl transition-opacity duration-300 ${priority.aura} opacity-0 group-hover:opacity-100`}
      />

      <div className="relative flex flex-1 items-start gap-3 p-4">
        <button
          type="button"
          role="checkbox"
          aria-checked={Boolean(todo.completed)}
          aria-label={`${todo.completed ? 'Mark incomplete' : 'Mark complete'}: ${todo.text}`}
          onClick={() => onToggle(todo.id)}
          className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ${
            todo.completed
              ? 'border-accent bg-accent text-accent-fg'
              : 'border-line bg-panel hover:border-accent hover:bg-accent/5'
          }`}
        >
          <AnimatePresence initial={false}>
            {todo.completed && (
              <motion.span
                initial={reduceMotion ? false : { scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={reduceMotion ? undefined : { scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 26 }}
              >
                <Check className="h-3 w-3" aria-hidden="true" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={`break-words text-[15px] font-medium leading-snug tracking-[-0.01em] ${
              todo.completed ? 'text-faint line-through decoration-line' : 'text-ink'
            }`}
          >
            {todo.text}
          </p>

          {(todo.dueDate || repeats) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {todo.dueDate && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                    overdue
                      ? 'border-danger/25 bg-danger/10 font-medium text-danger'
                      : dueToday
                      ? 'border-warning/25 bg-warning/10 font-medium text-warning'
                      : 'border-line/70 bg-raised/70 text-muted'
                  }`}
                >
                  <CalendarDays className="h-3 w-3" aria-hidden="true" />
                  {overdue ? 'Overdue · ' : dueToday ? 'Today · ' : ''}
                  {formatDate(todo.dueDate)}
                  {todo.dueTime ? ` · ${formatDueTime(todo.dueTime)}` : ''}
                </span>
              )}
              {repeats && (
                <span className="inline-flex items-center gap-1 rounded-full border border-line/70 bg-raised/70 px-2 py-0.5 text-[11px] text-muted">
                  <Repeat className="h-3 w-3" aria-hidden="true" />
                  {todo.repeat === 'daily' ? 'Daily' : 'Weekly'}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="relative flex items-center justify-between gap-2 border-t border-line/50 px-3 py-1.5">
        <span
          className={`flex items-center gap-1.5 pl-1 text-[11px] font-medium ${priority.chip}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} aria-hidden="true" />
          {priority.label}
        </span>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onCarry(todo.id)}
            disabled={dueToday}
            className="icon-btn h-7 w-7 disabled:pointer-events-none disabled:opacity-40 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            aria-label={`Move to carried over: ${todo.text}`}
            title={dueToday ? 'Already carried over' : 'Move to carried over (due today)'}
          >
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onMove(todo.id, -1)}
            disabled={!canReorder || index <= 0}
            className="icon-btn h-7 w-7 disabled:pointer-events-none disabled:opacity-25 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            aria-label={`Move up: ${todo.text}`}
          >
            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onMove(todo.id, 1)}
            disabled={!canReorder || index === count - 1}
            className="icon-btn h-7 w-7 disabled:pointer-events-none disabled:opacity-25 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            aria-label={`Move down: ${todo.text}`}
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(todo.id)}
            className="icon-btn h-7 w-7 hover:text-danger md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            aria-label={`Delete task: ${todo.text}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
