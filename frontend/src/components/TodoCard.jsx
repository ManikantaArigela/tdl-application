import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  Pencil,
  Repeat,
  Timer,
  Trash2,
} from 'lucide-react';
import {
  dayKey,
  dueInputValue,
  dueTimestamp,
  formatDate,
  formatDueTime,
  isOverdue,
  toDueStamp,
} from '../lib/format';
import { DatePicker, Dropdown, TimePicker, REPEAT_OPTIONS } from './FormControls';

export const PRIORITIES = [
  {
    id: 'low',
    label: 'Low',
    dot: 'bg-success',
    aura: 'bg-success/20',
    chip: 'text-success',
    tint: 'from-success/10',
  },
  {
    id: 'medium',
    label: 'Medium',
    dot: 'bg-warning',
    aura: 'bg-warning/20',
    chip: 'text-warning',
    tint: 'from-warning/10',
  },
  {
    id: 'high',
    label: 'High',
    dot: 'bg-danger',
    aura: 'bg-danger/20',
    chip: 'text-danger',
    tint: 'from-danger/10',
  },
];

/** Duration presets in minutes; empty string means "no duration". */
export const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

const priorityMeta = (value) =>
  PRIORITIES.find((priority) => priority.id === value) ?? PRIORITIES[1];

// Touch drags start after a long press so vertical scrolling still works.
const LONG_PRESS_MS = 250;
const PRESS_SLOP_PX = 10;

export default function TodoCard({
  todo,
  canDrag = false,
  canReorder = true,
  isDragging = false,
  ghost = false,
  index = 0,
  count = 1,
  onToggle,
  onUpdate,
  onDelete,
  onMove,
  onCarry,
  onDragActivate,
}) {
  const reduceMotion = useReducedMotion();

  const priority = priorityMeta(todo.priority);
  const dueTs = dueTimestamp(todo);
  const overdue =
    !todo.completed &&
    (isOverdue(todo.dueDate) || (Boolean(todo.dueTime) && dueTs !== null && dueTs < Date.now()));
  const dueToday = Boolean(todo.dueDate) && dayKey(todo.dueDate) === dayKey(new Date());
  const repeats = todo.repeat && todo.repeat !== 'none';
  const hasDuration = typeof todo.duration === 'number' && todo.duration > 0;

  // ---- Long-press / pointer drag arming ---------------------------------
  const press = React.useRef(null); // pending touch long-press
  const armed = React.useRef(false); // long-press fired, gesture in flight

  const clearPress = React.useCallback(() => {
    if (press.current?.timer) clearTimeout(press.current.timer);
    press.current = null;
  }, []);

  React.useEffect(() => clearPress, [clearPress]);

  const handlePointerDown = (event) => {
    if (isDragging) return; // drag already running; ignore placeholder presses
    const target = event.target;
    const onEntry =
      target instanceof Element &&
      target.closest('input, select, textarea, [data-no-drag]:not(button):not(a)');
    const onButton = target instanceof Element && target.closest('button, a');

    if (event.pointerType === 'touch') {
      // Taps on controls must stay taps; long-press drag is for the body only.
      if (onEntry || onButton) return;
      clearPress();
      const startX = event.clientX;
      const startY = event.clientY;
      press.current = {
        timer: setTimeout(() => {
          press.current = null;
          armed.current = true;
          navigator.vibrate?.(15);
          onDragActivate?.(todo, startX, startY);
        }, LONG_PRESS_MS),
        x: startX,
        y: startY,
      };
      return;
    }

    // Text entry keeps its native selection/caret behaviour; other
    // data-no-drag areas opt out explicitly.
    if (onEntry) return;

    // Fine pointers (mouse/pen) drag from anywhere on the card, controls
    // included: release in place is still a normal click, release over a
    // drop zone completes or carries the task. This keeps hover-revealed
    // action buttons from creating dead zones along the card edges.
    if (!canDrag || event.button !== 0) return;
    onDragActivate?.(todo, event.clientX, event.clientY);
  };

  const handlePointerMove = (event) => {
    if (!press.current) return;
    const dx = event.clientX - press.current.x;
    const dy = event.clientY - press.current.y;
    if (dx * dx + dy * dy > PRESS_SLOP_PX * PRESS_SLOP_PX) clearPress();
  };

  const handlePointerDismiss = () => {
    clearPress();
    armed.current = false;
  };

  const handleContextMenu = (event) => {
    if (press.current || armed.current || isDragging) event.preventDefault();
  };

  // ---- Inline edit ------------------------------------------------------
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  const startEdit = () => {
    setDraft({
      text: todo.text,
      priority: todo.priority ?? 'medium',
      due: dueInputValue(todo.dueDate),
      time: todo.dueTime ?? '',
      duration: hasDuration ? String(todo.duration) : '',
      repeat: todo.repeat ?? 'none',
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(null);
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    const text = draft.text.trim();
    if (!text || saving) return;
    setSaving(true);
    const updated = await onUpdate(todo.id, {
      text,
      priority: draft.priority,
      dueDate: toDueStamp(draft.due),
      dueTime: draft.due ? draft.time || null : null,
      duration: draft.duration === '' ? null : Number(draft.duration),
      repeat: draft.repeat,
    });
    setSaving(false);
    if (updated) cancelEdit();
  };

  // While dragging, the card's content hides but STAYS MOUNTED: the touch
  // pointer's implicit capture is held by the inner hit-test element, and
  // removing it fires pointercancel which kills touch drags. The dashed
  // "Moving…" slot is an overlay on top of the hidden content.

  return (
    <motion.article
      data-todo-id={ghost ? undefined : todo.id}
      layout={!ghost && !reduceMotion}
      initial={ghost || reduceMotion ? false : { opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -8, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.7 }}
      whileHover={!ghost && !reduceMotion && !isDragging ? { y: -3, scale: 1.008 } : undefined}
      whileTap={!ghost && !reduceMotion && !isDragging && canDrag ? { scale: 0.985 } : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerDismiss}
      onPointerCancel={handlePointerDismiss}
      onContextMenu={handleContextMenu}
      className={`group relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-panel transition-[border-color,box-shadow] duration-200 hover:border-accent/30 hover:shadow-lift md:rounded-[1.25rem] ${
        canDrag || !editing ? 'select-none' : ''
      } ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''} ${
        isDragging ? 'z-30 cursor-grabbing shadow-lift ring-2 ring-accent/40' : ''
      }`}
    >
      {/* Priority color wash: a faint themed glow that deepens on hover. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${priority.tint} to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-100`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full blur-2xl transition-all duration-300 ${priority.aura} opacity-40 group-hover:opacity-100 group-hover:scale-125`}
      />

      {/* Content stays mounted while dragging (see note above); visibility
          only toggles so the touch pointer's captured element survives. */}
      <div className={`relative flex h-full flex-1 flex-col ${isDragging ? 'invisible' : ''}`}>
      {editing && draft ? (
        <form onSubmit={saveEdit} className="relative space-y-3 p-4">
          <div>
            <label htmlFor={`edit-text-${todo.id}`} className="sr-only">
              Task text
            </label>
            <input
              id={`edit-text-${todo.id}`}
              data-no-drag
              value={draft.text}
              onChange={(event) => setDraft({ ...draft, text: event.target.value })}
              maxLength={1000}
              autoFocus
              className="input border-line bg-surface py-2 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Dropdown
              id={`edit-priority-${todo.id}`}
              title="Priority"
              value={draft.priority}
              onChange={(value) => setDraft({ ...draft, priority: value })}
              options={PRIORITIES.map((option) => ({
                id: option.id,
                label: option.label,
                dot: option.dot,
              }))}
              className="min-w-0 flex-1 sm:flex-none sm:w-[8.5rem]"
            />
            <Dropdown
              id={`edit-repeat-${todo.id}`}
              title="Repeat"
              value={draft.repeat}
              onChange={(value) => setDraft({ ...draft, repeat: value })}
              options={REPEAT_OPTIONS}
              className="min-w-0 flex-1 sm:flex-none sm:w-[8.5rem]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`edit-due-${todo.id}`} className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-faint">
                Due date
              </label>
              <DatePicker
                id={`edit-due-${todo.id}`}
                title="Due date"
                value={draft.due}
                onChange={(value) => setDraft({ ...draft, due: value })}
              />
            </div>
            <div>
              <label htmlFor={`edit-time-${todo.id}`} className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-faint">
                Due time
              </label>
              <TimePicker
                id={`edit-time-${todo.id}`}
                title="Due time"
                value={draft.time}
                onChange={(time) => {
                  setDraft((current) => ({
                    ...current,
                    time,
                    due: current.due || (time ? dueInputValue(Date.now()) : ''),
                  }));
                }}
              />
            </div>
            <div className="col-span-2">
              <label htmlFor={`edit-duration-${todo.id}`} className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-faint">
                Duration
              </label>
              <Dropdown
                id={`edit-duration-${todo.id}`}
                title="Duration"
                value={draft.duration}
                onChange={(value) => setDraft({ ...draft, duration: value })}
                options={[
                  { id: '', label: 'No duration' },
                  ...DURATIONS.map((minutes) => ({ id: String(minutes), label: `${minutes} min` })),
                ]}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={cancelEdit}>
              Cancel
            </button>
            <button type="submit" className="btn-primary px-3 py-1.5 text-xs" disabled={!draft.text.trim() || saving}>
              Save
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="relative flex flex-1 items-start gap-2 p-2 md:gap-3 md:p-4">
            <button
              type="button"
              role="checkbox"
              aria-checked={Boolean(todo.completed)}
              aria-label={`${todo.completed ? 'Mark incomplete' : 'Mark complete'}: ${todo.text}`}
              onClick={() => onToggle(todo.id)}
              className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 hover:scale-110 active:scale-90 ${
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
                className={`break-words [overflow-wrap:anywhere] text-[13px] font-medium leading-snug tracking-[-0.01em] md:text-[15px] ${
                  todo.completed ? 'text-faint line-through decoration-line' : 'text-ink'
                }`}
              >
                {todo.text}
              </p>

              {(todo.dueDate || repeats || hasDuration) && (
                <div className="mt-1 flex flex-wrap items-center gap-1 md:mt-2 md:gap-1.5">
                  {todo.dueDate && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] md:px-2 md:text-[11px] ${
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
                  {hasDuration && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-line/70 bg-raised/70 px-1.5 py-0.5 text-[10px] text-muted md:px-2 md:text-[11px]">
                      <Timer className="h-3 w-3" aria-hidden="true" />
                      {todo.duration}m
                    </span>
                  )}
                  {repeats && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-line/70 bg-raised/70 px-1.5 py-0.5 text-[10px] text-muted md:px-2 md:text-[11px]">
                      <Repeat className="h-3 w-3" aria-hidden="true" />
                      {todo.repeat === 'daily' ? 'Daily' : 'Weekly'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="relative flex flex-wrap items-center justify-between gap-x-1 gap-y-0.5 border-t border-line/50 px-2 py-0.5 md:gap-x-2 md:gap-y-1 md:px-3 md:py-1.5">
            <span
              className={`flex items-center gap-1.5 pl-0.5 text-[10px] font-medium md:pl-1 md:text-[11px] ${priority.chip}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full transition-transform duration-300 group-hover:scale-150 ${priority.dot}`} aria-hidden="true" />
              {priority.label}
            </span>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={startEdit}
                className="card-action icon-btn h-7 w-7 transition-all duration-200 md:translate-y-0.5 md:group-hover:translate-y-0 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                aria-label={`Edit task: ${todo.text}`}
                data-no-drag
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onToggle(todo.id)}
                className="card-action icon-btn h-7 w-7 hover:text-success transition-all duration-200 md:translate-y-0.5 md:group-hover:translate-y-0 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                aria-label={`Complete task: ${todo.text}`}
                data-no-drag
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onCarry(todo.id)}
                disabled={dueToday}
                className="card-action icon-btn h-7 w-7 disabled:pointer-events-none disabled:opacity-40 transition-all duration-200 md:translate-y-0.5 md:group-hover:translate-y-0 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                aria-label={`Move to carried over: ${todo.text}`}
                title={dueToday ? 'Already carried over' : 'Move to carried over (due today)'}
                data-no-drag
              >
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onMove(todo.id, -1)}
                disabled={!canReorder || index <= 0}
                className="card-action icon-btn h-7 w-7 disabled:pointer-events-none disabled:opacity-25 transition-all duration-200 md:translate-y-0.5 md:group-hover:translate-y-0 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                aria-label={`Move up: ${todo.text}`}
                data-no-drag
              >
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onMove(todo.id, 1)}
                disabled={!canReorder || index === count - 1}
                className="card-action icon-btn h-7 w-7 disabled:pointer-events-none disabled:opacity-25 transition-all duration-200 md:translate-y-0.5 md:group-hover:translate-y-0 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                aria-label={`Move down: ${todo.text}`}
                data-no-drag
              >
                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(todo.id)}
                className="card-action icon-btn h-7 w-7 hover:text-danger transition-all duration-200 md:translate-y-0.5 md:group-hover:translate-y-0 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                aria-label={`Delete task: ${todo.text}`}
                data-no-drag
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </>
      )}
      </div>

      {/* Dashed slot left behind while the card travels with the pointer. */}
      {isDragging && (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 flex items-center justify-center rounded-[1.25rem] border-2 border-dashed border-accent/40 bg-accent/5"
        >
          <span className="text-xs font-semibold text-accent/60">Moving…</span>
        </div>
      )}
    </motion.article>
  );
}
