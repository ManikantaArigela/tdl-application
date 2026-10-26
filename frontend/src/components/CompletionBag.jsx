import React from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { CheckCircle2, Sparkles, Trash2 } from 'lucide-react';

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

const BUBBLES = [
  { left: '14%', size: 'h-1.5 w-1.5', delay: '0s', duration: '4.5s' },
  { left: '38%', size: 'h-1 w-1', delay: '1.4s', duration: '5.2s' },
  { left: '62%', size: 'h-2 w-2', delay: '2.6s', duration: '4s' },
  { left: '84%', size: 'h-1 w-1', delay: '0.8s', duration: '5.8s' },
];

export default function CompletionBag({
  completed,
  todayDone = 0,
  todayOpen = 0,
  active = false,
  zoneRef,
  onUncomplete,
  onClear,
}) {
  const reduceMotion = useReducedMotion();
  // The LIST is every task finished today (any due date) so drops always give
  // feedback. The RATE is scoped to today's plate: tasks dated today only.
  const done = completed.length;
  const rateTotal = todayDone + todayOpen;
  const pct = rateTotal > 0 ? Math.round((todayDone / rateTotal) * 100) : 0;
  const allDone = rateTotal > 0 && todayDone === rateTotal;

  // The liquid rises with a spring, and the % counts up alongside it.
  const target = useMotionValue(0);
  React.useEffect(() => {
    target.set(pct);
  }, [pct, target]);
  const springPct = useSpring(target, {
    stiffness: reduceMotion ? 600 : 55,
    damping: reduceMotion ? 60 : 16,
  });
  const liquidHeight = useTransform(springPct, (v) => `${v}%`);
  const displayPct = useTransform(springPct, (v) => Math.round(v));

  // Ring burst each time another task lands in the bag.
  const [burst, setBurst] = React.useState(0);
  const prevDone = React.useRef(done);
  React.useEffect(() => {
    if (done > prevDone.current && !reduceMotion) setBurst((current) => current + 1);
    prevDone.current = done;
  }, [done, reduceMotion]);

  return (
    <motion.section
      ref={zoneRef}
      aria-labelledby="completed-heading"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
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
            className="flex items-center gap-1.5 text-xs font-semibold text-muted"
          >
            <motion.span
              animate={
                reduceMotion || allDone
                  ? undefined
                  : { rotate: [0, 12, -8, 0], scale: [1, 1.15, 1] }
              }
              transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 3.5, ease: 'easeInOut' }}
              className="inline-flex"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            </motion.span>
            Completed today
          </h3>
          <p className="mt-1 text-[11px] text-faint">
            {active ? 'Release to mark it done' : 'Drop a task here to finish it'}
          </p>
        </div>
        <motion.span
          key={rateTotal > 0 ? `${todayDone}/${rateTotal}` : `done-${done}`}
          initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 520, damping: 24 }}
          className="chip tabular-nums"
          aria-live="polite"
          aria-label={
            rateTotal > 0
              ? `${todayDone} of ${rateTotal} of today's tasks completed`
              : `${done} tasks completed today`
          }
        >
          {rateTotal > 0 ? `${todayDone}/${rateTotal}` : `${done} done`}
        </motion.span>
      </div>

      {/* Liquid bag */}
      <div className="relative mt-3 h-40 overflow-hidden rounded-2xl border border-line bg-raised">
        <AnimatePresence>
          {burst > 0 && (
            <motion.span
              key={burst}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 rounded-2xl ring-2 ring-accent/50"
              initial={{ opacity: 0.8, scale: 0.97 }}
              animate={{ opacity: 0, scale: 1.04 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>

        <motion.div
          className="absolute inset-x-0 bottom-0"
          style={{ height: liquidHeight }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-accent/55 via-accent/35 to-pop-pink/30" />

          <Wave className="-top-2 animate-wave-slow text-pop-pink/30" />
          <Wave className="-top-1 animate-wave text-accent/40" />

          {!reduceMotion &&
            pct > 0 &&
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
        </motion.div>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            key={`pct-${pct}`}
            initial={reduceMotion ? false : { scale: 1.25 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="relative rounded-full bg-panel/80 px-3 py-1 font-display text-3xl font-bold leading-none tracking-[-0.05em] text-ink shadow-panel backdrop-blur-sm tabular-nums"
          >
            {rateTotal === 0 ? '–' : <motion.span>{displayPct}</motion.span>}
            {rateTotal > 0 && '%'}
          </motion.span>
          <span className="mt-1.5 flex items-center gap-1 rounded-full bg-panel/65 px-2 py-0.5 text-[10px] font-semibold text-muted backdrop-blur-sm">
            {allDone && <Sparkles className="h-3 w-3 text-warning" aria-hidden="true" />}
            {rateTotal === 0 ? 'nothing due today' : allDone ? 'all done for today' : 'completion rate'}
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {completed.length > 0 ? (
          <motion.div
            key="list"
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            <ul className="mt-3 max-h-44 space-y-1.5 overflow-y-auto pr-0.5">
              <AnimatePresence initial={false}>
                {completed.map((todo) => (
                  <motion.li
                    key={todo.id}
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduceMotion ? undefined : { opacity: 0, x: 8, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 480, damping: 30 }}
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
              <Trash2 className="h-3 w-3" aria-hidden="true" /> Clear today's completed
            </button>
          </motion.div>
        ) : (
          <motion.p
            key="empty"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-faint"
          >
            {rateTotal === 0
              ? 'No tasks dated today yet. Add one with a due date of today.'
              : 'Nothing completed today. Check a task, or drop one into the bag.'}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
