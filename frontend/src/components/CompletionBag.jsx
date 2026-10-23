import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Trash2 } from 'lucide-react';

function Wave({ className }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 40"
      preserveAspectRatio="none"
      className={`absolute left-0 h-3 w-[200%] ${className}`}
    >
      <path
        d="M0 20 Q 100 4 200 20 T 400 20 T 600 20 T 800 20 V40 H0 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function CompletionBag({
  completed,
  total,
  active = false,
  zoneRef,
  onUncomplete,
  onClear,
}) {
  const reduceMotion = useReducedMotion();
  const pct = total > 0 ? Math.round((completed.length / total) * 100) : 0;
  const level = Math.min(100, Math.max(0, pct));

  return (
    <section
      ref={zoneRef}
      aria-labelledby="completed-heading"
      className={`panel-raised relative overflow-hidden rounded-3xl p-4 transition-[transform,border-color,box-shadow] duration-200 ${
        active
          ? 'scale-[1.015] border-accent/60 shadow-lift ring-2 ring-accent/30'
          : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3
            id="completed-heading"
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            Completed
          </h3>
          <p className="mt-1 text-[11px] text-faint">
            {active ? 'Release to mark it done' : 'Drop a task here to finish it'}
          </p>
        </div>
        <span className="chip tabular-nums" aria-live="polite">
          {completed.length}/{total}
        </span>
      </div>

      {/* Liquid bag */}
      <div className="relative mt-3 h-40 overflow-hidden rounded-2xl border border-line bg-raised">
        <div
          className="absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out"
          style={{ height: `${level}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-accent/55 via-accent/40 to-accent/25" />

          <Wave className="-top-2 animate-wave-slow text-accent/30" />
          <Wave className="-top-1 animate-wave text-accent/45" />

          {!reduceMotion &&
            level > 0 &&
            [0, 1, 2].map((bubble) => (
              <span
                key={bubble}
                aria-hidden="true"
                className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-accent-fg/40 animate-bubble"
                style={{
                  left: `${18 + bubble * 30}%`,
                  animationDelay: `${bubble * 1.5}s`,
                }}
              />
            ))}
        </div>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="rounded-full bg-panel/75 px-3 py-1 font-display text-3xl leading-none text-ink shadow-panel backdrop-blur-sm tabular-nums">
            {pct}%
          </span>
          <span className="mt-1.5 rounded-full bg-panel/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted backdrop-blur-sm">
            completion rate
          </span>
        </div>
      </div>

      {completed.length > 0 ? (
        <>
          <ul className="mt-3 max-h-44 space-y-1.5 overflow-y-auto pr-0.5">
            <AnimatePresence initial={false}>
              {completed.map((todo) => (
                <motion.li
                  key={todo.id}
                  layout
                  initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, x: 8 }}
                  className="flex items-center gap-2 rounded-lg border border-line/70 bg-panel/80 px-2.5 py-1.5"
                >
                  <button
                    type="button"
                    onClick={() => onUncomplete(todo.id)}
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg transition-transform hover:scale-110"
                    aria-label={`Mark incomplete: ${todo.text}`}
                    title="Mark incomplete"
                  >
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  </button>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted line-through decoration-line">
                    {todo.text}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          <button
            type="button"
            onClick={onClear}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-faint transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" /> Clear completed
          </button>
        </>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-faint">
          Nothing completed yet. Check a task, or drop one into the bag.
        </p>
      )}
    </section>
  );
}
