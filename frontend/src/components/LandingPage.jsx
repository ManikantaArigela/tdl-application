import React from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import {
  ArrowDown,
  ArrowRight,
  BellRing,
  Check,
  CheckCircle2,
  Crown,
  ListChecks,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Zap,
} from 'lucide-react';
import Brand from './Brand';
import { PLANS } from '../lib/plans';

const NAV_LINKS = [
  { href: '#preview', label: 'Product' },
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
];

const FEATURES = [
  {
    id: 'notes',
    icon: StickyNote,
    tone: 'bg-lavender text-accent',
    title: 'Notes that keep up',
    copy: 'Write a thought, a meeting note, or a rough draft. TDL saves as you type and keeps everything findable.',
    bullets: ['Autosave while you write', 'Tags, pinning, and instant search'],
  },
  {
    id: 'tasks',
    icon: ListChecks,
    tone: 'light-island bg-pop-yellow text-ink',
    title: 'Tasks that get finished',
    copy: 'Sort by priority or due date, set repeats, and drag a card straight into done. Today stays clear.',
    bullets: ['Priorities, due dates, and repeats', 'A today view that stays honest'],
  },
  {
    id: 'ai',
    icon: Sparkles,
    tone: 'bg-pop-pink text-white',
    title: 'An AI planner in your corner',
    copy: 'Turn a topic, a PDF, or a messy thought into structured notes and a clear list of next steps.',
    bullets: ['Plan from a topic or file', 'Improve and summarize notes'],
  },
];

const PREVIEW_TASKS = [
  { label: 'Outline the launch note', done: true },
  { label: 'Review the plan with AI', done: true },
  { label: 'Share the first draft', done: false },
];

const PREVIEW_BARS = [38, 56, 44, 72, 58, 84, 100];

const TICKER_WORDS = ['Notes', 'Tasks', 'Reminders', 'AI planner', 'Focus', 'Calm'];
const TICKER_WORDS_ALT = ['Write', 'Plan', 'Finish', 'Repeat', 'Focus', 'Breathe'];

const AI_PROMPTS = [
  'Plan my product launch.',
  'Summarize this PDF into notes.',
  'Turn this note into next steps.',
];

const EASE = [0.2, 0.8, 0.2, 1];
const SOFT_EASE = [0.16, 1, 0.3, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.085, delayChildren: 0.04 } },
};

const reveal = {
  initial: 'hidden',
  whileInView: 'show',
  viewport: { once: true, amount: 0.18 },
};

/* -------------------------------------------------------------------------
   Shared motion helpers
   ---------------------------------------------------------------------- */

/**
 * Tracks the pointer inside a card and writes it to CSS variables, so the
 * spotlight overlay can follow the cursor without re-rendering React.
 */
function useSpotlight() {
  const ref = React.useRef(null);
  const onPointerMove = React.useCallback((event) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
    node.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
  }, []);
  return { ref, onPointerMove };
}

function SpotlightOverlay({ tone = 'rgb(var(--accent) / 0.12)' }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      style={{
        background: `radial-gradient(240px circle at var(--spot-x, 50%) var(--spot-y, 50%), ${tone}, transparent 68%)`,
      }}
    />
  );
}

/** Gently pulls a button toward the cursor on fine-pointer devices. */
function Magnetic({ children, className = '', strength = 6 }) {
  const reduceMotion = useReducedMotion();
  const x = useSpring(0, { stiffness: 260, damping: 20, mass: 0.35 });
  const y = useSpring(0, { stiffness: 260, damping: 20, mass: 0.35 });

  const handleMove = (event) => {
    if (reduceMotion || event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(((event.clientX - rect.left) / rect.width - 0.5) * strength * 2);
    y.set(((event.clientY - rect.top) / rect.height - 0.5) * strength * 2);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      onPointerMove={handleMove}
      onPointerLeave={reset}
      style={{ x, y }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Small 3D tilt that makes the hero preview feel physical on hover. */
function Tilt({ children, className = '', max = 3.2 }) {
  const reduceMotion = useReducedMotion();
  const rotateX = useSpring(0, { stiffness: 110, damping: 18, mass: 0.4 });
  const rotateY = useSpring(0, { stiffness: 110, damping: 18, mass: 0.4 });

  const handleMove = (event) => {
    if (reduceMotion || event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * max * 2);
    rotateX.set(-py * max * 2);
  };

  const reset = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      onPointerMove={handleMove}
      onPointerLeave={reset}
      style={{ rotateX, rotateY, transformPerspective: 1200 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Counts up from zero the first time it scrolls into view. */
function CountUp({ to, prefix = '', className = '' }) {
  const ref = React.useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduceMotion = useReducedMotion();
  const count = useMotionValue(reduceMotion ? to : 0);
  const display = useTransform(count, (value) => `${prefix}${Math.round(value)}`);

  React.useEffect(() => {
    if (!inView || reduceMotion) return undefined;
    const controls = animate(count, to, { duration: 1.1, ease: EASE });
    return () => controls.stop();
  }, [inView, to, reduceMotion, count]);

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  );
}

/** Word-by-word masked reveal for the hero headline. */
function AnimatedWords({ text, delay = 0 }) {
  const reduceMotion = useReducedMotion();
  const words = text.split(' ');

  return (
    <>
      {words.map((word, index) => (
        <React.Fragment key={`${word}-${index}`}>
          <span className="inline-block overflow-hidden pb-[0.14em] -mb-[0.14em] align-bottom">
            <motion.span
              initial={reduceMotion ? false : { y: '110%', opacity: 0 }}
              animate={{ y: '0%', opacity: 1 }}
              transition={{
                duration: 0.8,
                delay: delay + index * 0.075,
                ease: SOFT_EASE,
              }}
              className="inline-block"
            >
              {word}
            </motion.span>
          </span>
          {index < words.length - 1 ? ' ' : null}
        </React.Fragment>
      ))}
    </>
  );
}

/** Slow-moving gradient blobs that give the hero depth. */
function HeroAurora({ reduceMotion, y }) {
  return (
    <motion.div
      aria-hidden="true"
      style={{ y }}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <motion.div
        animate={
          reduceMotion
            ? undefined
            : { x: [0, 36, -12, 0], y: [0, -24, 14, 0], opacity: [0.75, 1, 0.75] }
        }
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-accent/15 blur-3xl will-change-transform sm:h-96 sm:w-96"
      />
      <motion.div
        animate={
          reduceMotion
            ? undefined
            : { x: [0, -28, 16, 0], y: [0, 22, -10, 0], opacity: [0.75, 1, 0.75] }
        }
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
        className="absolute -right-20 top-10 h-64 w-64 rounded-full bg-pop-pink/15 blur-3xl will-change-transform sm:h-80 sm:w-80"
      />
      <motion.div
        animate={
          reduceMotion
            ? undefined
            : { x: [0, 24, -18, 0], y: [0, -18, 10, 0], opacity: [0.6, 1, 0.6] }
        }
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
        className="absolute left-1/3 top-36 h-52 w-52 rounded-full bg-pop-yellow/20 blur-3xl will-change-transform sm:h-64 sm:w-64"
      />

      {!reduceMotion &&
        [
          { left: '12%', top: '22%', size: 5, delay: 0 },
          { left: '78%', top: '18%', size: 4, delay: 1.2 },
          { left: '64%', top: '62%', size: 6, delay: 2.1 },
          { left: '22%', top: '68%', size: 4, delay: 0.6 },
        ].map((spark) => (
          <motion.span
            key={`${spark.left}-${spark.top}`}
            animate={{ y: [0, -12, 0], opacity: [0.2, 0.8, 0.2], scale: [0.8, 1.2, 0.8] }}
            transition={{
              duration: 5 + spark.delay,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: spark.delay,
            }}
            className="absolute rounded-full bg-accent/60"
            style={{ left: spark.left, top: spark.top, width: spark.size, height: spark.size }}
          />
        ))}
    </motion.div>
  );
}

/* -------------------------------------------------------------------------
   Sections
   ---------------------------------------------------------------------- */

function ScrollTicker() {
  const trackRef = React.useRef(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ['start end', 'end start'],
  });
  const rawX = useTransform(scrollYProgress, [0, 1], [48, -300]);
  const x = useSpring(rawX, { stiffness: 90, damping: 24, mass: 0.35 });

  return (
    <div
      ref={trackRef}
      aria-hidden="true"
      className="relative overflow-hidden border-y border-line/70 bg-panel py-3.5"
    >
      <motion.div
        data-scroll-ticker="true"
        style={{ x: reduceMotion ? 0 : x }}
        className="flex w-max items-center gap-5 whitespace-nowrap will-change-transform sm:gap-7"
      >
        {[0, 1, 2].map((copy) => (
          <React.Fragment key={copy}>
            {TICKER_WORDS.map((word, index) => (
              <React.Fragment key={`${copy}-${word}`}>
                <span
                  className={`text-[11px] font-semibold uppercase tracking-[0.22em] sm:text-xs ${
                    index % 3 === 0
                      ? 'text-accent'
                      : index % 3 === 1
                      ? 'text-ink/70'
                      : 'text-pop-pink'
                  }`}
                >
                  {word}
                </span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    index % 2 === 0 ? 'bg-pop-yellow' : 'bg-line'
                  }`}
                />
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
      </motion.div>

      {/* A second, slower row drifts the other way to keep the strip alive. */}
      <div className="mt-2.5 overflow-hidden">
        <div className="flex w-max animate-wave-slow items-center opacity-60">
          {[0, 1].map((copy) => (
            <div
              key={`alt-${copy}`}
              className="flex items-center gap-5 pr-5 sm:gap-7 sm:pr-7"
            >
              {TICKER_WORDS_ALT.map((word) => (
                <React.Fragment key={`alt-${copy}-${word}`}>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted">
                    {word}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-accent/40" />
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-panel to-transparent sm:w-20"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-panel to-transparent sm:w-20"
      />
    </div>
  );
}

function RotatingPrompt() {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (reduceMotion) return undefined;
    const id = window.setInterval(
      () => setIndex((current) => (current + 1) % AI_PROMPTS.length),
      3800
    );
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  return (
    <div className="relative mt-3 min-h-[2.9rem] overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={index}
          initial={reduceMotion ? false : { y: '70%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { y: '-70%', opacity: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="text-[13px] font-bold leading-snug sm:text-sm"
        >
          “{AI_PROMPTS[index]}”
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function ProductPreview() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.975 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.28, ease: EASE }}
      className="relative mx-auto mt-10 max-w-5xl sm:mt-14"
    >
      <Tilt className="relative">
        <motion.div
          aria-hidden="true"
          initial={{ rotate: -6, opacity: 0 }}
          animate={{ rotate: -6, opacity: 1, y: reduceMotion ? 0 : [0, -9, 0] }}
          transition={{
            opacity: { duration: 0.5, delay: 0.4 },
            rotate: { duration: 0.5, delay: 0.4 },
            y: { duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1.1 },
          }}
          className="absolute -left-3 top-8 h-3/4 w-1/2 rounded-[2rem] bg-pop-yellow/90 sm:-left-6"
        />
        <motion.div
          aria-hidden="true"
          initial={{ rotate: 6, opacity: 0 }}
          animate={{ rotate: 6, opacity: 1, y: reduceMotion ? 0 : [0, 8, 0] }}
          transition={{
            opacity: { duration: 0.5, delay: 0.5 },
            rotate: { duration: 0.5, delay: 0.5 },
            y: { duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1.4 },
          }}
          className="absolute -right-3 bottom-6 h-2/3 w-2/5 rounded-[2rem] bg-pop-pink/80 sm:-right-6"
        />

        <div className="relative overflow-hidden rounded-[1.75rem] bg-[#26086E] p-3 shadow-frame ring-1 ring-black/5 sm:rounded-[2rem] sm:p-4">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border border-white/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-8 top-8 h-32 w-32 rounded-full border border-white/10"
          />
          <motion.div
            aria-hidden="true"
            animate={
              reduceMotion
                ? undefined
                : { x: [0, 14, -8, 0], y: [0, -10, 6, 0], opacity: [0.5, 0.85, 0.5] }
            }
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="pointer-events-none absolute -bottom-20 left-1/4 h-56 w-56 rounded-full bg-accent/50 blur-3xl"
          />
          {!reduceMotion && (
            <motion.div
              aria-hidden="true"
              initial={{ x: '-130%' }}
              animate={{ x: '420%' }}
              transition={{
                duration: 5.5,
                repeat: Infinity,
                repeatDelay: 3.5,
                ease: 'easeInOut',
              }}
              className="pointer-events-none absolute inset-y-0 w-1/3 skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            />
          )}

          <div className="relative grid gap-3 rounded-[1.35rem] bg-[#1B0656] p-3 sm:grid-cols-[1.12fr_0.88fr] sm:p-4">
            <div className="light-island rounded-[1.15rem] bg-white p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs font-bold text-ink">
                  <span className="h-2.5 w-2.5 rounded-full bg-pop-pink" aria-hidden="true" />
                  Today
                </span>
                <motion.span
                  animate={reduceMotion ? undefined : { opacity: [1, 0.55, 1] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                  className="rounded-full bg-lavender px-2.5 py-1 text-[10px] font-bold text-accent"
                >
                  Autosaved
                </motion.span>
              </div>

              <p className="mt-5 text-xl font-bold tracking-[-0.04em] text-ink sm:text-2xl">
                Launch week
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                One note for the plan, one list for the next steps.
              </p>

              <ul className="mt-4 space-y-2.5">
                {PREVIEW_TASKS.map((task, index) => (
                  <motion.li
                    key={task.label}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.7 + index * 0.09, ease: EASE }}
                    className="flex items-center gap-2.5"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        task.done
                          ? 'bg-accent text-white'
                          : 'border-2 border-line bg-white text-transparent'
                      }`}
                      aria-hidden="true"
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        task.done ? 'text-faint line-through' : 'text-ink'
                      }`}
                    >
                      {task.label}
                    </span>
                  </motion.li>
                ))}
              </ul>

              <div className="mt-5 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-lavender px-2.5 py-1 text-[10px] font-semibold text-accent">
                  Product
                </span>
                <span className="rounded-full bg-raised px-2.5 py-1 text-[10px] font-semibold text-muted">
                  This week
                </span>
              </div>

              <div className="mt-5 border-t border-line/70 pt-3">
                <div className="flex items-center justify-between text-[10px] font-semibold text-faint">
                  <span>4 of 6 done</span>
                  <span>67%</span>
                </div>
                <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-raised">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.9, delay: 0.95, ease: EASE }}
                    style={{ width: '66.7%', transformOrigin: 'left' }}
                    className="h-full rounded-full bg-gradient-to-r from-accent to-pop-pink"
                  />
                  {!reduceMotion && (
                    <motion.span
                      aria-hidden="true"
                      animate={{ x: ['-120%', '320%'] }}
                      transition={{
                        duration: 2.4,
                        repeat: Infinity,
                        repeatDelay: 2.2,
                        ease: 'easeInOut',
                        delay: 1.8,
                      }}
                      className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="light-island rounded-[1.15rem] bg-pop-yellow p-4 text-ink">
                <p className="text-[10px] font-bold text-ink/60">
                  Tasks finished this week
                </p>
                <p className="mt-1 text-4xl font-extrabold tracking-[-0.07em]">
                  <CountUp to={12} />
                </p>
                <div className="mt-4 flex h-12 items-end gap-1.5" aria-hidden="true">
                  {PREVIEW_BARS.map((height, index) => (
                    <motion.span
                      key={height}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{
                        duration: 0.55,
                        delay: 0.8 + index * 0.06,
                        ease: EASE,
                      }}
                      style={{ height: `${height}%`, transformOrigin: 'bottom' }}
                      className={`w-full rounded-sm ${
                        index === PREVIEW_BARS.length - 1 ? 'bg-accent' : 'bg-ink/75'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="relative flex flex-1 flex-col justify-between overflow-hidden rounded-[1.15rem] bg-pop-pink p-4 text-white">
                <motion.div
                  aria-hidden="true"
                  animate={
                    reduceMotion
                      ? undefined
                      : { scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }
                  }
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                  className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/15 blur-xl"
                />
                <div className="relative flex items-center gap-2 text-xs font-bold">
                  <motion.span
                    animate={reduceMotion ? undefined : { rotate: [0, 14, -8, 0], scale: [1, 1.08, 1] }}
                    transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="inline-flex"
                  >
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </motion.span>
                  AI planner
                </div>

                <RotatingPrompt />

                <p className="relative mt-2 flex items-center gap-1.5 text-[11px] font-medium text-white/80">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  3 notes and 6 tasks created
                </p>
              </div>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 1.05, ease: EASE }}
          className="absolute -bottom-5 left-5 hidden items-center gap-2 rounded-full border border-line bg-panel px-3.5 py-2 text-xs font-semibold text-ink shadow-lift sm:flex"
        >
          <motion.span
            animate={reduceMotion ? undefined : { rotate: [0, -8, 8, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.4 }}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-accent"
          >
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
          </motion.span>
          Quick capture with one shortcut
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: reduceMotion ? 0 : [0, -4, 0] }}
          transition={{
            opacity: { duration: 0.45, delay: 1.25 },
            y: { duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 1.7 },
          }}
          className="absolute -bottom-7 right-5 hidden items-center gap-2.5 rounded-2xl border border-line bg-panel px-3.5 py-2.5 text-left shadow-lift sm:flex"
        >
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pop-pink/10 text-pop-pink">
            <span
              className="absolute inset-0 animate-ping rounded-full bg-pop-pink/15"
              style={{ animationDuration: '2.8s' }}
              aria-hidden="true"
            />
            <motion.span
              animate={reduceMotion ? undefined : { rotate: [0, -16, 12, -6, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 3.6, ease: 'easeInOut' }}
              className="relative inline-flex"
            >
              <BellRing className="h-4 w-4" aria-hidden="true" />
            </motion.span>
          </span>
          <span>
            <span className="block text-[11px] font-bold text-ink">Reminder sent</span>
            <span className="block text-[10px] text-faint">Share the first draft · 10 min</span>
          </span>
        </motion.div>
      </Tilt>
    </motion.div>
  );
}

function FeatureCard({ feature }) {
  const Icon = feature.icon;
  const spotlight = useSpotlight();

  return (
    <motion.article
      ref={spotlight.ref}
      onPointerMove={spotlight.onPointerMove}
      variants={fadeUp}
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      id={feature.id === 'ai' ? 'ai' : undefined}
      className="group relative scroll-mt-24 overflow-hidden rounded-[1.4rem] border border-line bg-panel p-5 shadow-panel transition-colors duration-200 hover:border-accent/30 sm:p-6"
    >
      <SpotlightOverlay />

      <span
        className={`relative flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 ease-standard group-hover:-rotate-6 group-hover:scale-110 ${feature.tone}`}
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="relative mt-5 text-lg font-semibold tracking-[-0.03em] text-ink">
        {feature.title}
      </h3>
      <p className="relative mt-2 text-sm leading-relaxed text-muted">{feature.copy}</p>
      <ul className="relative mt-4 space-y-2">
        {feature.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2 text-[13px] font-medium text-ink">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent transition-transform duration-300 group-hover:scale-110">
              <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
            </span>
            {bullet}
          </li>
        ))}
      </ul>

      <span
        aria-hidden="true"
        className="absolute inset-x-5 bottom-0 h-0.5 origin-left scale-x-0 rounded-full bg-gradient-to-r from-accent via-pop-pink to-pop-yellow transition-transform duration-500 ease-standard group-hover:scale-x-100"
      />
    </motion.article>
  );
}

const PLAN_TONES = {
  free: {
    card: 'border-line bg-panel',
    muted: 'text-muted',
    icon: 'bg-lavender text-accent',
    button: 'btn-ghost w-full',
    badge: 'bg-lavender text-accent',
    check: 'bg-accent/10 text-accent',
    feature: 'text-ink',
  },
  pro: {
    card: 'border-[#26086E] bg-[#26086E] text-white',
    muted: 'text-white/60',
    icon: 'bg-white/10 text-pop-yellow',
    button:
      'light-island inline-flex w-full items-center justify-center gap-2 rounded-xl bg-pop-yellow px-5 py-3 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5',
    badge: 'light-island bg-pop-yellow text-ink',
    check: 'bg-white/10 text-pop-yellow',
    feature: 'text-white/80',
  },
  premium: {
    card: 'border-accent/15 bg-lavender',
    muted: 'text-muted',
    icon: 'bg-panel/80 text-accent',
    button: 'btn-primary w-full',
    badge: 'bg-panel text-accent ring-1 ring-accent/15',
    check: 'bg-panel/80 text-accent',
    feature: 'text-ink',
  },
};

function PricingCard({ plan, onSignUp, onChoosePlan }) {
  const tone = PLAN_TONES[plan.id];
  const isPro = plan.id === 'pro';
  const spotlight = useSpotlight();
  const reduceMotion = useReducedMotion();
  const choose = () => {
    if (plan.price === 0) onSignUp();
    else if (onChoosePlan) onChoosePlan(plan.id);
    else onSignUp();
  };

  return (
    <motion.article
      ref={spotlight.ref}
      onPointerMove={spotlight.onPointerMove}
      variants={fadeUp}
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className={`group relative flex flex-col overflow-hidden rounded-[1.5rem] border p-5 sm:p-6 ${tone.card}`}
    >
      {isPro && (
        <motion.div
          aria-hidden="true"
          animate={
            reduceMotion
              ? undefined
              : { x: [0, -8, 6, 0], y: [0, 8, -4, 0], opacity: [0.55, 0.9, 0.55] }
          }
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-accent/70 blur-3xl"
        />
      )}

      <SpotlightOverlay
        tone={isPro ? 'rgb(var(--yellow) / 0.18)' : 'rgb(var(--accent) / 0.12)'}
      />

      <div className="relative flex items-start justify-between gap-2">
        <motion.span
          whileHover={reduceMotion ? undefined : { rotate: -8, scale: 1.08 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone.icon}`}
          aria-hidden="true"
        >
          {plan.id === 'free' ? (
            <Sparkles className="h-4 w-4" />
          ) : plan.id === 'pro' ? (
            <Crown className="h-4 w-4" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
        </motion.span>
        {plan.badge && (
          <span
            className={`relative rounded-full px-2.5 py-1 text-[10px] font-bold ${tone.badge}`}
          >
            {isPro && (
              <span
                aria-hidden="true"
                className="absolute inset-0 animate-ping rounded-full bg-pop-yellow/40"
                style={{ animationDuration: '2.8s' }}
              />
            )}
            <span className="relative">{plan.badge}</span>
          </span>
        )}
      </div>

      <h3 className="relative mt-4 text-xl font-semibold tracking-[-0.035em]">{plan.name}</h3>
      <p className={`relative mt-1 text-xs leading-relaxed ${tone.muted}`}>{plan.description}</p>

      <div className="relative mt-5 flex items-end gap-1.5">
        <CountUp
          to={plan.price}
          prefix="₹"
          className="text-4xl font-bold tracking-[-0.065em]"
        />
        <span className={`pb-1.5 text-xs ${tone.muted}`}>/ {plan.cadence}</span>
      </div>

      <ul className="relative mt-5 flex-1 space-y-2.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-xs leading-relaxed">
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${tone.check}`}
            >
              <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
            </span>
            <span className={tone.feature}>{feature}</span>
          </li>
        ))}
      </ul>

      <motion.button
        type="button"
        onClick={choose}
        whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 420, damping: 24 }}
        className={`group/btn relative mt-6 overflow-hidden ${tone.button}`}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-standard group-hover/btn:translate-x-full"
        />
        <span className="relative z-10 inline-flex items-center gap-2">
          {plan.cta}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </motion.button>
    </motion.article>
  );
}

export default function LandingPage({ onSignIn, onSignUp, onChoosePlan }) {
  const heroRef = React.useRef(null);
  const featuresRef = React.useRef(null);
  const pricingRef = React.useRef(null);
  const reduceMotion = useReducedMotion();

  // Page progress stays outside React state so scrolling never re-renders the page.
  const { scrollYProgress: pageProgress } = useScroll();
  const progressScale = useSpring(pageProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  // The hero preview drifts at a different rate than the copy, creating depth.
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const previewY = useTransform(heroProgress, [0, 1], [0, 76]);
  const previewRotate = useTransform(heroProgress, [0, 1], [0, -1.1]);
  const auroraY = useTransform(heroProgress, [0, 1], [0, -58]);

  // Card grids drift slowly against their headings while the sections pass through.
  const { scrollYProgress: featuresProgress } = useScroll({
    target: featuresRef,
    offset: ['start end', 'end start'],
  });
  const featuresY = useTransform(featuresProgress, [0, 1], [28, -28]);

  const { scrollYProgress: pricingProgress } = useScroll({
    target: pricingRef,
    offset: ['start end', 'end start'],
  });
  const pricingY = useTransform(pricingProgress, [0, 1], [32, -32]);

  return (
    <div className="min-h-dvh bg-canvas px-2.5 py-2.5 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
      <motion.div
        aria-hidden="true"
        data-scroll-progress="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] origin-left rounded-r-full bg-gradient-to-r from-accent via-pop-pink to-pop-yellow"
        style={{ scaleX: reduceMotion ? pageProgress : progressScale }}
      />
      <div className="mx-auto max-w-[1440px] overflow-hidden rounded-[1.75rem] border border-line/80 bg-panel shadow-frame sm:rounded-[2.25rem]">
        <header className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3.5 sm:px-6 md:grid-cols-[1fr_auto_1fr] md:px-8 md:py-4">
          <a
            href="#top"
            className="justify-self-start transition-transform duration-300 hover:scale-[1.03]"
            aria-label="TDL home"
          >
            <Brand size="md" />
          </a>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-0.5 rounded-full border border-line/80 bg-raised/80 p-1 md:flex"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="group relative rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-muted transition-colors hover:bg-panel hover:text-ink"
              >
                {link.label}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-3.5 bottom-0.5 h-0.5 origin-left scale-x-0 rounded-full bg-accent transition-transform duration-300 ease-standard group-hover:scale-x-100"
                />
              </a>
            ))}
          </nav>

          <div className="flex items-center justify-end gap-1 sm:gap-2">
            <button
              type="button"
              onClick={onSignIn}
              className="rounded-full px-2.5 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink sm:px-3"
            >
              Log in
            </button>
            <motion.button
              type="button"
              onClick={onSignUp}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
              className="group/cta relative overflow-hidden rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-strong"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-standard group-hover/cta:translate-x-full"
              />
              <span className="relative z-10">Start free</span>
            </motion.button>
          </div>
        </header>

        <main id="top">
          <section
            ref={heroRef}
            id="preview"
            className="relative scroll-mt-4 px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14 lg:pt-16"
          >
            <HeroAurora reduceMotion={reduceMotion} y={reduceMotion ? 0 : auroraY} />

            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="relative mx-auto max-w-4xl text-center"
            >
              <motion.span
                variants={fadeUp}
                className="relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-line bg-raised px-3.5 py-1.5 text-xs font-semibold text-muted"
              >
                {!reduceMotion && (
                  <motion.span
                    aria-hidden="true"
                    initial={{ x: '-130%' }}
                    animate={{ x: '230%' }}
                    transition={{
                      duration: 1.6,
                      delay: 1.1,
                      repeat: Infinity,
                      repeatDelay: 3.4,
                      ease: 'easeInOut',
                    }}
                    className="pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-ink/10 to-transparent"
                  />
                )}
                <motion.span
                  animate={reduceMotion ? undefined : { scale: [1, 1.35, 1], opacity: [1, 0.55, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="h-2 w-2 rounded-full bg-pop-pink"
                  aria-hidden="true"
                />
                <span className="relative">Notes, tasks, and AI in one place</span>
              </motion.span>

              <h1 className="mx-auto mt-6 text-[clamp(2.7rem,7.2vw,5.3rem)] font-semibold leading-[1.02] tracking-[-0.06em] text-ink">
                <span className="block">
                  <AnimatedWords text="Think clearly." delay={0.12} />
                </span>
                <span className="relative block">
                  <motion.span
                    aria-hidden="true"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.7, delay: 0.8, ease: EASE }}
                    className="absolute inset-x-[2%] bottom-[0.08em] z-0 h-[0.22em] origin-left rounded-full bg-pop-yellow"
                  />
                  <span className="relative z-10">
                    <AnimatedWords text="Finish calmly." delay={0.26} />
                  </span>
                </span>
              </h1>

              <motion.p
                variants={fadeUp}
                className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted sm:text-lg"
              >
                A focused workspace for your notes, tasks, and next steps. Capture an idea,
                plan it with AI, and get it done without hopping between apps.
              </motion.p>

              <motion.div
                variants={fadeUp}
                className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row"
              >
                <Magnetic className="relative w-full sm:w-auto">
                  <motion.span
                    aria-hidden="true"
                    animate={
                      reduceMotion ? undefined : { scale: [1, 1.06, 1], opacity: [0.5, 0.22, 0.5] }
                    }
                    transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                    className="pointer-events-none absolute inset-0 rounded-xl bg-accent/45 blur-lg"
                  />
                  <motion.button
                    type="button"
                    onClick={onSignUp}
                    whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                    className="group/cta btn-primary relative h-12 w-full overflow-hidden px-6 text-[15px] sm:w-auto"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-standard group-hover/cta:translate-x-full"
                    />
                    <span className="relative z-10 inline-flex items-center gap-2">
                      Start free
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </motion.button>
                </Magnetic>

                <Magnetic className="w-full sm:w-auto" strength={4}>
                  <a
                    href="#pricing"
                    className="group/cta btn-ghost relative h-12 w-full overflow-hidden px-6 text-[15px] sm:w-auto"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-accent/10 to-transparent transition-transform duration-700 ease-standard group-hover/cta:translate-x-full"
                    />
                    <span className="relative z-10">See plans</span>
                  </a>
                </Magnetic>
              </motion.div>

              <motion.p
                variants={fadeUp}
                className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs font-medium text-faint"
              >
                {['Free to start', 'Private by default', 'No credit card'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                    {item}
                  </span>
                ))}
              </motion.p>
            </motion.div>

            <motion.div
              style={{
                y: reduceMotion ? 0 : previewY,
                rotate: reduceMotion ? 0 : previewRotate,
              }}
              className="origin-top will-change-transform"
            >
              <ProductPreview />
            </motion.div>

            <motion.a
              href="#features"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.45 }}
              className="group relative mx-auto mt-12 flex w-fit items-center gap-2 rounded-full border border-line bg-raised px-3.5 py-2 text-xs font-semibold text-muted transition-colors hover:border-accent/30 hover:text-ink"
            >
              See how it works
              <motion.span
                animate={reduceMotion ? undefined : { y: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className="inline-flex text-accent"
                aria-hidden="true"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </motion.span>
            </motion.a>
          </section>

          <ScrollTicker />

          <motion.section
            ref={featuresRef}
            id="features"
            {...reveal}
            variants={stagger}
            className="scroll-mt-4 border-t border-line/70 bg-raised px-4 py-12 sm:px-6 sm:py-14"
          >
            <div className="mx-auto max-w-6xl">
              <motion.div variants={fadeUp} className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-semibold tracking-[-0.045em] text-ink sm:text-4xl">
                  Three things, done well.
                </h2>
                <motion.span
                  aria-hidden="true"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
                  className="mx-auto mt-4 block h-1 w-16 origin-left rounded-full bg-gradient-to-r from-accent to-pop-pink"
                />
                <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                  No dashboards to configure. Just the essentials for thinking and finishing.
                </p>
              </motion.div>

              <motion.div
                variants={stagger}
                style={{ y: reduceMotion ? 0 : featuresY }}
                className="mt-8 grid gap-3 pb-3 will-change-transform md:grid-cols-3"
              >
                {FEATURES.map((feature) => (
                  <FeatureCard key={feature.id} feature={feature} />
                ))}
              </motion.div>

              <motion.div
                variants={fadeUp}
                className="group relative mt-4 flex flex-col items-start justify-between gap-4 overflow-hidden rounded-[1.5rem] border border-accent/15 bg-panel p-5 sm:flex-row sm:items-center sm:px-6"
              >
                {!reduceMotion && (
                  <motion.span
                    aria-hidden="true"
                    animate={{ x: ['-160%', '520%'] }}
                    transition={{
                      duration: 6,
                      repeat: Infinity,
                      repeatDelay: 3,
                      ease: 'easeInOut',
                    }}
                    className="pointer-events-none absolute inset-y-0 w-1/4 -skew-x-12 bg-gradient-to-r from-transparent via-accent/5 to-transparent"
                  />
                )}
                <div className="relative flex items-start gap-3">
                  <span className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-pop-pink/10 text-pop-pink">
                    <span
                      className="absolute inset-0 animate-ping rounded-2xl bg-pop-pink/10"
                      style={{ animationDuration: '3s' }}
                      aria-hidden="true"
                    />
                    <motion.span
                      animate={
                        reduceMotion ? undefined : { rotate: [0, -14, 10, -6, 0] }
                      }
                      transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        repeatDelay: 3.4,
                        ease: 'easeInOut',
                      }}
                      className="relative inline-flex"
                    >
                      <BellRing className="h-5 w-5" aria-hidden="true" />
                    </motion.span>
                  </span>
                  <div>
                    <p className="text-lg font-semibold tracking-[-0.02em] text-ink">
                      Reminders that reach you.
                    </p>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
                      A Premium perk: in-app alerts, browser notifications, and a free voice
                      call when a task is due. Free and Pro keep unlimited notes and tasks.
                    </p>
                  </div>
                </div>
                <div className="relative flex shrink-0 flex-wrap items-center gap-1.5">
                  <span className="chip bg-lavender text-accent">Web + mobile</span>
                  <span className="chip light-island bg-pop-yellow text-ink">Premium</span>
                </div>
              </motion.div>
            </div>
          </motion.section>

          <motion.section
            ref={pricingRef}
            id="pricing"
            {...reveal}
            variants={stagger}
            className="scroll-mt-4 border-t border-line/70 bg-panel px-4 py-12 sm:px-6 sm:py-14"
          >
            <div className="mx-auto max-w-5xl">
              <motion.div variants={fadeUp} className="mx-auto max-w-2xl text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-lavender px-3 py-1 text-[11px] font-semibold text-accent">
                  <motion.span
                    animate={
                      reduceMotion ? undefined : { rotate: [0, -8, 8, 0], scale: [1, 1.1, 1] }
                    }
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    className="inline-flex"
                  >
                    <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                  </motion.span>
                  Simple pricing
                </span>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-ink sm:text-4xl">
                  Pick a pace that fits.
                </h2>
                <motion.span
                  aria-hidden="true"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
                  className="mx-auto mt-4 block h-1 w-16 origin-left rounded-full bg-gradient-to-r from-pop-pink to-pop-yellow"
                />
                <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                  Start free. Add more AI and PDF imports when you need them. Smart reminders
                  and voice calls come with Premium.
                </p>
              </motion.div>

              <motion.div
                variants={stagger}
                style={{ y: reduceMotion ? 0 : pricingY }}
                className="mt-8 grid items-stretch gap-3 pb-3 will-change-transform md:grid-cols-3"
              >
                {PLANS.map((plan) => (
                  <PricingCard
                    key={plan.id}
                    plan={plan}
                    onSignUp={onSignUp}
                    onChoosePlan={onChoosePlan}
                  />
                ))}
              </motion.div>

              <motion.div
                variants={fadeUp}
                className="mt-5 flex flex-col items-center justify-center gap-2 text-center text-[11px] text-faint sm:flex-row sm:gap-4"
              >
                <span className="inline-flex items-center gap-1.5">
                  <motion.span
                    animate={reduceMotion ? undefined : { rotate: [0, -12, 10, 0] }}
                    transition={{
                      duration: 1.1,
                      repeat: Infinity,
                      repeatDelay: 3.6,
                      ease: 'easeInOut',
                    }}
                    className="inline-flex text-accent"
                  >
                    <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
                  </motion.span>
                  Smart reminders included with Premium
                </span>
                <span className="hidden h-3 w-px bg-line sm:block" aria-hidden="true" />
                <span>Prices in INR · Switch or cancel anytime</span>
              </motion.div>
            </div>
          </motion.section>

          <footer className="flex flex-col items-center justify-between gap-4 border-t border-line/70 px-5 py-6 text-xs text-faint sm:flex-row sm:px-8">
            <Brand size="sm" />
            <p>© 2026 TDL. Private by default.</p>
            <div className="flex items-center gap-4">
              <a
                href="#pricing"
                className="group relative font-semibold transition-colors hover:text-ink"
              >
                Pricing
                <span
                  aria-hidden="true"
                  className="absolute -bottom-0.5 left-0 h-px w-0 rounded-full bg-accent transition-all duration-300 ease-standard group-hover:w-full"
                />
              </a>
              <button
                type="button"
                onClick={onSignIn}
                className="group relative font-semibold transition-colors hover:text-ink"
              >
                Log in
                <span
                  aria-hidden="true"
                  className="absolute -bottom-0.5 left-0 h-px w-0 rounded-full bg-accent transition-all duration-300 ease-standard group-hover:w-full"
                />
              </button>
              <button
                type="button"
                onClick={onSignUp}
                className="group relative font-semibold transition-colors hover:text-ink"
              >
                Create account
                <span
                  aria-hidden="true"
                  className="absolute -bottom-0.5 left-0 h-px w-0 rounded-full bg-accent transition-all duration-300 ease-standard group-hover:w-full"
                />
              </button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
