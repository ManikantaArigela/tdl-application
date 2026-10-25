import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CalendarOff, Check, Clock3, Inbox } from 'lucide-react';
import { formatDate, isOverdue } from '../lib/format';

export default function CarryOverBox({
  tasks,
  active = false,
  zoneRef,
  onComplete,
  onRelease,
}) {
  const reduceMotion = useReducedMotion();

  return (
    <section
      ref={zoneRef}
      aria-labelledby="carried-heading"
      className={`panel-raised relative overflow-hidden rounded-3xl p-4 transition-[transform,border-color,box-shadow] duration-200 ${
        active
          ? 'scale-[1.015] border-warning/60 shadow-lift ring-2 ring-warning/30'
          : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3
            id="carried-heading"
            className="flex items-center gap-1.5 text-xs font-semibold text-muted"
          >
            <Inbox className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
            Carried over
          </h3>
          <p className="mt-1 text-[11px] text-faint">
            {active ? 'Release to keep it on today’s list' : 'Open at the end of the day'}
          </p>
        </div>
        <span className="chip tabular-nums">{tasks.length}</span>
      </div>

      <div
        className={`mt-3 rounded-2xl border border-dashed px-2.5 py-2.5 transition-colors duration-200 ${
          active ? 'border-warning/60 bg-warning/[0.06]' : 'border-line bg-raised/60'
        }`}
      >
        {tasks.length > 0 ? (
          <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-0.5">
            <AnimatePresence initial={false}>
              {tasks.map((todo) => {
                const overdue = isOverdue(todo.dueDate);
                return (
                  <motion.li
                    key={todo.id}
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, x: 8 }}
                    className="group flex items-center gap-2 rounded-lg border border-line/70 bg-panel px-2.5 py-2"
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked="false"
                      onClick={() => onComplete(todo.id)}
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-line transition-colors hover:border-accent hover:bg-accent/10"
                      aria-label={`Mark complete: ${todo.text}`}
                    >
                      <Check className="h-2.5 w-2.5 text-accent opacity-40 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-ink">{todo.text}</p>
                      <span
                        className={`mt-0.5 flex items-center gap-1 text-[10px] ${
                          overdue ? 'font-medium text-danger' : 'text-warning'
                        }`}
                      >
                        <Clock3 className="h-2.5 w-2.5" aria-hidden="true" />
                        {overdue ? 'Overdue · ' : 'Today · '}
                        {formatDate(todo.dueDate)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRelease(todo.id)}
                      className="icon-btn h-6 w-6 shrink-0 text-faint hover:text-ink md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                      aria-label={`Remove due date: ${todo.text}`}
                      title="Remove due date"
                    >
                      <CalendarOff className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        ) : (
          <div className="flex flex-col items-center px-2 py-6 text-center">
            <Inbox className="h-5 w-5 text-faint" aria-hidden="true" />
            <p className="mt-2 text-xs text-faint">
              Nothing carried over. Drag a task here to flag it for today.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
