import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArchiveRestore, Clock, Pin, Star, Tag, Trash2 } from 'lucide-react';
import { relativeTime } from '../lib/format';

export default function TiltNoteCard({ note, onSelect, onDelete, onPin, onArchive, archived = false }) {
  const reduceMotion = useReducedMotion();
  const cardRef = React.useRef(null);
  const canTilt = React.useRef(false);

  React.useEffect(() => {
    try {
      canTilt.current =
        !reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    } catch {
      canTilt.current = false;
    }
  }, [reduceMotion]);

  const handlePointerMove = (event) => {
    if (!canTilt.current || !cardRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = (event.clientX - rect.left) / rect.width - 0.5;
    const offsetY = (event.clientY - rect.top) / rect.height - 0.5;
    cardRef.current.style.transform = `perspective(900px) rotateX(${(-offsetY * 5).toFixed(
      2
    )}deg) rotateY(${(offsetX * 5).toFixed(2)}deg) translateZ(0)`;
  };

  const resetTilt = () => {
    if (cardRef.current) cardRef.current.style.transform = '';
  };

  const tags = (note.tags ?? []).filter(Boolean).slice(0, 3);
  const extraTags = Math.max((note.tags ?? []).filter(Boolean).length - tags.length, 0);

  return (
    <motion.article
      layout
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
      transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      onMouseMove={handlePointerMove}
      onMouseLeave={resetTilt}
      className="panel-raised group relative overflow-hidden p-5 transition-colors duration-200 hover:border-accent/40"
    >
      <div ref={cardRef} className="relative transition-transform duration-150 ease-out">
        <button
          type="button"
          onClick={() => onSelect(note.id)}
          className="absolute inset-0 z-0 rounded-2xl"
          aria-label={`Open note: ${note.title || 'Untitled'}`}
        />

        <div className="pointer-events-none relative z-10">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {note.pinned && (
                <span className="chip border-accent/30 bg-accent/10 text-accent">
                  <Star className="h-3 w-3" aria-hidden="true" /> Pinned
                </span>
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
                  note.pinned ? 'text-accent' : 'text-faint md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'
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

          <h3 className="line-clamp-2 font-display text-xl leading-snug text-ink">
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
            {archived && (
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
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
