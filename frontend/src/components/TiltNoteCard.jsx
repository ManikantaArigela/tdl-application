import React from 'react';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { ArrowUpRight, ArchiveRestore, Clock, Pin, Star, Tag, Trash2 } from 'lucide-react';
import { relativeTime } from '../lib/format';

export default function TiltNoteCard({ note, onSelect, onDelete, onPin, onArchive, archived = false }) {
  const reduceMotion = useReducedMotion();
  const [tiltEnabled, setTiltEnabled] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  // Normalised pointer position inside the card (0 → 1 on both axes).
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(pointerY, [0, 1], [4.5, -4.5]), {
    stiffness: 260,
    damping: 26,
    mass: 0.6,
  });
  const rotateY = useSpring(useTransform(pointerX, [0, 1], [-4.5, 4.5]), {
    stiffness: 260,
    damping: 26,
    mass: 0.6,
  });

  const glowX = useTransform(pointerX, (value) => `${value * 100}%`);
  const glowY = useTransform(pointerY, (value) => `${value * 100}%`);
  const spotlight = useMotionTemplate`radial-gradient(240px circle at ${glowX} ${glowY}, rgb(var(--accent) / 0.16), transparent 72%)`;

  React.useEffect(() => {
    let query;
    try {
      query = window.matchMedia('(hover: hover) and (pointer: fine)');
    } catch {
      return undefined;
    }

    const sync = () => setTiltEnabled(query.matches && !reduceMotion);
    sync();
    if (query.addEventListener) query.addEventListener('change', sync);
    else query.addListener(sync);

    return () => {
      if (query.removeEventListener) query.removeEventListener('change', sync);
      else query.removeListener(sync);
    };
  }, [reduceMotion]);

  const handlePointerMove = (event) => {
    if (!tiltEnabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - rect.left) / rect.width);
    pointerY.set((event.clientY - rect.top) / rect.height);
  };

  const resetTilt = () => {
    pointerX.set(0.5);
    pointerY.set(0.5);
    setHovered(false);
  };

  const tags = (note.tags ?? []).filter(Boolean).slice(0, 3);
  const extraTags = Math.max((note.tags ?? []).filter(Boolean).length - tags.length, 0);

  return (
    <motion.article
      layout
      initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26, mass: 0.7 }}
      whileHover={reduceMotion ? undefined : { y: -5 }}
      onPointerMove={handlePointerMove}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={resetTilt}
      className="panel-raised group relative overflow-hidden rounded-2xl p-5 transition-[border-color,box-shadow] duration-300 hover:border-accent/40 hover:shadow-lift"
    >
      {/* Cursor-following glow */}
      <motion.span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300 ${
          hovered ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ background: spotlight }}
      />

      {/* Light sweep across the card on hover */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 group-hover:animate-sheen"
      />

      {/* Accent hairline that draws in from the left */}
      <span
        aria-hidden="true"
        className="absolute inset-x-5 top-0 h-px origin-left scale-x-0 bg-gradient-to-r from-accent via-accent/40 to-transparent transition-transform duration-500 ease-out group-hover:scale-x-100"
      />

      <button
        type="button"
        onClick={() => onSelect(note.id)}
        className="absolute inset-0 z-0 rounded-2xl"
        aria-label={`Open note: ${note.title || 'Untitled'}`}
      />

      <motion.div
        className="relative z-10"
        style={tiltEnabled ? { rotateX, rotateY, transformPerspective: 900 } : undefined}
      >
        <div className="pointer-events-none relative z-10">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {note.pinned && (
                <motion.span
                  layout
                  initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="chip border-accent/30 bg-accent/10 text-accent"
                >
                  <Star className="h-3 w-3" aria-hidden="true" /> Pinned
                </motion.span>
              )}
              {archived && (
                <span className="chip">
                  <ArchiveRestore className="h-3 w-3" aria-hidden="true" /> Archived
                </span>
              )}
            </div>

            <div className="pointer-events-auto flex items-center gap-1">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onPin(note.id);
                }}
                className={`icon-btn h-8 w-8 ${
                  note.pinned
                    ? 'text-accent'
                    : 'text-faint md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'
                }`}
                aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
                aria-pressed={Boolean(note.pinned)}
              >
                <Pin className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(note.id);
                }}
                className="icon-btn h-8 w-8 text-faint hover:text-danger md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                aria-label={`Delete note: ${note.title || 'Untitled'}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <h3 className="line-clamp-2 font-display text-xl leading-snug text-ink transition-colors duration-200 group-hover:text-accent-strong">
            {note.title || 'Untitled'}
          </h3>

          {note.content ? (
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{note.content}</p>
          ) : (
            <p className="mt-2 text-sm italic text-faint">Empty note</p>
          )}

          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="chip">
                  <Tag className="h-3 w-3" aria-hidden="true" /> {tag}
                </span>
              ))}
              {extraTags > 0 && <span className="text-xs text-faint">+{extraTags}</span>}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-line/70 pt-3 text-xs text-faint">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" aria-hidden="true" />
              <span>Edited {relativeTime(note.updatedAt)}</span>
            </span>
            {archived ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onArchive(note.id);
                }}
                className="pointer-events-auto rounded px-1.5 py-0.5 text-xs font-medium text-accent hover:bg-accent/10"
              >
                Restore
              </button>
            ) : (
              <span className="flex items-center gap-1 transition-colors duration-200 group-hover:text-accent">
                Open
                <ArrowUpRight className="h-3 w-3 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </motion.article>
  );
}
