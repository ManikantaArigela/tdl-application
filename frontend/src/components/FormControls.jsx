import React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
import { dueInputValue } from '../lib/format';

/**
 * Theme-matched form controls for the task forms.
 *
 * Dropdown, DatePicker, and TimePicker are real custom popups: native
 * <select>/date/time popups are drawn by the operating system and cannot be
 * themed, so triggers and open lists are all rendered by the app. They stay
 * keyboard- and touch-friendly and portal their popups to <body> so no card's
 * overflow-hidden can clip them.
 */

const focusRing =
  'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';

/** Shared repeat options for the task forms. */
export const REPEAT_OPTIONS = [
  { id: 'none', label: 'No repeat' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
];

// ---- Shared popup plumbing -------------------------------------------------

/** Fixed positioning keeps the popup above every stacking/clipping context. */
function usePopupPosition(buttonRef, popupRef, open, estimatedHeight, minWidth = 208) {
  const [pos, setPos] = React.useState(null);
  React.useEffect(() => {
    if (!open) return undefined;
    const update = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const openUp =
        window.innerHeight - rect.bottom < estimatedHeight + 12 &&
        rect.top > estimatedHeight + 12;
      const width = Math.max(rect.width, minWidth);
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      setPos({
        left,
        width,
        ...(openUp
          ? { bottom: Math.min(window.innerHeight - rect.top + 6, window.innerHeight - 8) }
          : { top: Math.min(rect.bottom + 6, window.innerHeight - 8) }),
      });
    };
    update();
    const reposition = () => update();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, estimatedHeight, minWidth, buttonRef]);

  // Second pass: once the popup has rendered, measure its real height and cap
  // it with an internal scroll when it would clip past a viewport edge (the
  // flip decision above uses an estimate; real content can be taller). If
  // neither side of the trigger has usable room (short landscape screens),
  // fall back to a near-full-height sheet so every option stays reachable.
  React.useLayoutEffect(() => {
    if (!open || !pos) return;
    const element = popupRef?.current;
    if (!element || pos.maxHeight != null) return;
    const rect = element.getBoundingClientRect();
    const limit = window.innerHeight - 8;
    if (rect.bottom > limit && pos.top != null) {
      const room = Math.round(limit - pos.top);
      setPos((current) => ({
        ...current,
        ...(room >= 160
          ? { maxHeight: room }
          : { top: 8, maxHeight: Math.round(window.innerHeight - 16) }),
        overflowY: 'auto',
      }));
    } else if (rect.top < 8 && pos.bottom != null) {
      const room = Math.round(window.innerHeight - pos.bottom - 8);
      setPos((current) => ({
        ...current,
        ...(room >= 160
          ? { maxHeight: room }
          : { bottom: 8, maxHeight: Math.round(window.innerHeight - 16) }),
        overflowY: 'auto',
      }));
    }
  }, [open, pos, popupRef]);

  return pos;
}

/** Close the popup when the pointer goes down anywhere else. */
function useCloseOnOutside(open, refs, setOpen) {
  React.useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (refs.some((ref) => ref.current?.contains(event.target))) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open, refs, setOpen]);
}

const popupClass =
  'fixed z-50 rounded-xl border border-line bg-panel p-1.5 shadow-lift';

/** Trigger button shared by all three pickers. */
function Trigger({ id, open, onClick, onKeyDown, title, triggerRef, children, className = '' }) {
  return (
    <button
      type="button"
      ref={triggerRef}
      id={id}
      title={title}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`trigger flex h-9 w-full cursor-pointer select-none items-center gap-2 rounded-xl border border-line bg-surface px-2.5 text-xs font-medium text-ink transition-colors duration-120 hover:border-accent/40 ${focusRing} ${className}`}
    >
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
      <ChevronDown
        className={`h-3.5 w-3.5 shrink-0 text-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        aria-hidden="true"
      />
    </button>
  );
}

function Placeholder({ children }) {
  return <span className="text-muted">{children}</span>;
}

// ---- Dropdown ---------------------------------------------------------------

/**
 * options: [{ id, label, dot? }] — `dot` is a bg-* class shown as a colored
 * bullet (priority levels). onChange receives the option id directly.
 */
export function Dropdown({ id, value, onChange, options, title, className = '' }) {
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const rootRef = React.useRef(null);
  const buttonRef = React.useRef(null);
  const listRef = React.useRef(null);

  const selected = options.find((option) => option.id === value) ?? null;
  const pos = usePopupPosition(buttonRef, listRef, open, Math.min(options.length * 38 + 12, 256));
  useCloseOnOutside(open, [rootRef, listRef], setOpen);

  // Opening selects the current value; arrows move from there.
  React.useEffect(() => {
    if (!open) return;
    const index = options.findIndex((option) => option.id === value);
    setHighlight(index === -1 ? 0 : index);
  }, [open, options, value]);

  React.useEffect(() => {
    if (!open) return;
    listRef.current?.children?.[highlight]?.scrollIntoView?.({ block: 'nearest' });
  }, [highlight, open]);

  const commit = (id) => {
    onChange(id);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (event) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((current) => Math.min(options.length - 1, current + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => Math.max(0, current - 1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setHighlight(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setHighlight(options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (highlight >= 0 && options[highlight]) commit(options[highlight].id);
    } else if (event.key === 'Escape') {
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <Trigger id={id} triggerRef={buttonRef} open={open} onClick={() => setOpen((c) => !c)} onKeyDown={onKeyDown} title={title}>
        {selected ? (
          <>
            {selected.dot && (
              <span
                className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${selected.dot}`}
                aria-hidden="true"
              />
            )}
            {selected.label}
          </>
        ) : (
          <Placeholder>{title}</Placeholder>
        )}
      </Trigger>

      {open &&
        createPortal(
          <ul
            ref={listRef}
            role="listbox"
            aria-labelledby={id}
            style={pos}
            className={`${popupClass} max-h-64 overflow-y-auto`}
          >
            {options.map((option, index) => {
              const active = option.id === value;
              const hot = index === highlight;
              return (
                <li
                  key={option.id}
                  role="option"
                  aria-selected={active}
                  onPointerEnter={() => setHighlight(index)}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => commit(option.id)}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors duration-120 ${
                    active ? 'text-accent' : hot ? 'bg-raised text-ink' : 'text-muted'
                  }`}
                >
                  {option.dot && (
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${option.dot}`}
                      aria-hidden="true"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </div>
  );
}

// ---- Date formatting helpers ------------------------------------------------

const pad2 = (n) => String(n).padStart(2, '0');

/** 'HH:mm' → '9:30 AM' */
export function timeLabel(value) {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${pad2(m)} ${period}`;
}

/** 'yyyy-mm-dd' → '27 Oct 2026' */
export function dateLabel(value) {
  if (!value) return '';
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** 42 days (6 weeks) starting on the Sunday before the 1st of `month`. */
function monthGrid(year, month) {
  const start = new Date(year, month, 1);
  start.setDate(1 - start.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

const dayKeyOf = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

// ---- DatePicker -------------------------------------------------------------

/** value: 'yyyy-mm-dd' | '' — onChange receives the same shape. */
export function DatePicker({ id, value, onChange, title, className = '' }) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef(null);
  const buttonRef = React.useRef(null);
  const gridRef = React.useRef(null);

  const parsed = value ? value.split('-').map(Number) : null;
  const [view, setView] = React.useState(() => ({
    year: parsed ? parsed[0] : new Date().getFullYear(),
    month: parsed ? parsed[1] - 1 : new Date().getMonth(),
  }));

  const todayKey = dayKeyOf(new Date());
  const days = React.useMemo(
    () => monthGrid(view.year, view.month),
    [view.year, view.month],
  );

  const pos = usePopupPosition(buttonRef, gridRef, open, 330, 260);
  useCloseOnOutside(open, [rootRef, gridRef], setOpen);

  React.useEffect(() => {
    if (!open) return;
    if (parsed) setView({ year: parsed[0], month: parsed[1] - 1 });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- view only follows value on open

  const commit = (key) => {
    onChange(key);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const moveMonth = (delta) =>
    setView((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  /** Arrow keys walk the day grid; Enter picks the focused day. */
  const onGridKeyDown = (event) => {
    const deltas = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (event.key in deltas) {
      event.preventDefault();
      const focused = gridRef.current?.querySelector('[data-daykey]:focus');
      const base = focused?.dataset.daykey ?? (parsed ? value : todayKey);
      const [y, m, d] = base.split('-').map(Number);
      const next = new Date(y, m - 1, d + deltas[event.key]);
      const key = dayKeyOf(next);
      setView({ year: next.getFullYear(), month: next.getMonth() });
      requestAnimationFrame(() => {
        gridRef.current?.querySelector(`[data-daykey="${key}"]`)?.focus();
      });
    } else if (event.key === 'Escape') {
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <Trigger
        id={id}
        triggerRef={buttonRef}
        open={open}
        onClick={() => setOpen((c) => !c)}
        onKeyDown={(event) => {
          if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        title={title}
      >
        {value ? dateLabel(value) : <Placeholder>{title}</Placeholder>}
      </Trigger>

      {open &&
        createPortal(
          <div
            ref={gridRef}
            style={pos}
            className={`${popupClass} w-[260px] overflow-y-auto p-3`}
            onKeyDown={onGridKeyDown}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="icon-btn h-7 w-7"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <p className="text-xs font-semibold text-ink">
                {new Date(view.year, view.month, 1).toLocaleDateString('en-GB', {
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="icon-btn h-7 w-7"
                aria-label="Next month"
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {WEEKDAYS.map((weekday) => (
                <span
                  key={weekday}
                  className="py-1 text-center text-[10px] font-semibold uppercase text-faint"
                  aria-hidden="true"
                >
                  {weekday}
                </span>
              ))}
              {days.map((day) => {
                const key = dayKeyOf(day);
                const outside = day.getMonth() !== view.month;
                const isSelected = key === value;
                const isToday = key === todayKey;
                return (
                  <button
                    key={key}
                    type="button"
                    data-daykey={key}
                    onClick={() => commit(key)}
                    aria-pressed={isSelected}
                    aria-label={dateLabel(key)}
                    className={`flex h-7 items-center justify-center rounded-lg text-xs font-medium transition-colors duration-120 ${
                      isSelected
                        ? 'bg-accent text-accent-fg'
                        : isToday
                          ? 'text-accent ring-1 ring-inset ring-accent/40'
                          : outside
                            ? 'text-faint hover:bg-raised'
                            : 'text-ink hover:bg-raised'
                    }`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
              <button
                type="button"
                onClick={() => commit(dueInputValue(Date.now()))}
                className="rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10"
              >
                Today
              </button>
              {value && (
                <button
                  type="button"
                  onClick={() => commit('')}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-raised hover:text-ink"
                >
                  <X className="h-3 w-3" aria-hidden="true" /> Clear
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// ---- TimePicker -------------------------------------------------------------

/** Every 15 minutes of the day, as 'HH:mm' values. */
const TIME_STEPS = (() => {
  const steps = [];
  for (let h = 0; h < 24; h += 1) {
    for (const m of [0, 15, 30, 45]) steps.push(`${pad2(h)}:${pad2(m)}`);
  }
  return steps;
})();

/** value: 'HH:mm' | '' — onChange receives the same shape. */
export function TimePicker({ id, value, onChange, title, className = '' }) {
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const rootRef = React.useRef(null);
  const buttonRef = React.useRef(null);
  const listRef = React.useRef(null);
  const popupRef = React.useRef(null);

  const pos = usePopupPosition(buttonRef, popupRef, open, Math.min(TIME_STEPS.length * 30 + 52, 320));
  useCloseOnOutside(open, [rootRef, listRef], setOpen);

  React.useEffect(() => {
    if (!open) return;
    const index = TIME_STEPS.indexOf(value);
    setHighlight(index === -1 ? 0 : index);
  }, [open, value]);

  React.useEffect(() => {
    if (!open) return;
    listRef.current?.children?.[highlight]?.scrollIntoView?.({ block: 'nearest' });
  }, [highlight, open]);

  const commit = (time) => {
    onChange(time);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (event) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((current) => Math.min(TIME_STEPS.length - 1, current + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => Math.max(0, current - 1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setHighlight(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setHighlight(TIME_STEPS.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (highlight >= 0) commit(TIME_STEPS[highlight]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <Trigger id={id} triggerRef={buttonRef} open={open} onClick={() => setOpen((c) => !c)} onKeyDown={onKeyDown} title={title}>
        {value ? (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-faint" aria-hidden="true" />
            {timeLabel(value)}
          </span>
        ) : (
          <Placeholder>{title}</Placeholder>
        )}
      </Trigger>

      {open &&
        createPortal(
          <div ref={popupRef} style={pos} className={`${popupClass} max-h-72 overflow-y-auto`}>
            <ul ref={listRef} role="listbox" aria-labelledby={id}>
              {value && (
                <li
                  role="option"
                  aria-selected={false}
                  onPointerEnter={() => setHighlight(-1)}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => commit('')}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors duration-120 hover:bg-raised hover:text-ink"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                  No time
                </li>
              )}
              {TIME_STEPS.map((time, index) => {
                const active = time === value;
                const hot = index === highlight;
                return (
                  <li
                    key={time}
                    role="option"
                    aria-selected={active}
                    onPointerEnter={() => setHighlight(index)}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => commit(time)}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors duration-120 ${
                      active ? 'text-accent' : hot ? 'bg-raised text-ink' : 'text-muted'
                    }`}
                  >
                    <span className="min-w-0 flex-1">{timeLabel(time)}</span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
