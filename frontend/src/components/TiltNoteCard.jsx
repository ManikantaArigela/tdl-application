import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ArchiveRestore, Clock, Pin, Star, Tag, Trash2 } from 'lucide-react';
import { relativeTime } from '../lib/format';

export default function TiltNoteCard({
  note,
  index = 0,
  onSelect,
  onDelete,
  onPin,
  onArchive,
  archived = false,
}) {
  const reduceMotion = useReducedMotion();

  const tags = (note.tags ?? []).filter(Boolean).slice(0, 3);
  const extraTags = Math.max((note.tags ?? []).filter(Boolean).length - tags.length, 0);

  const accentTones = [
    'from-accent via-pop-pink to-pop-yellow',
    'from-pop-yellow via-pop-pink to-accent',
    'from-pop-pink via-accent to-pop-yellow',
  ];
  const accentTone =
    accentTones[
      (String(note.id || note.title || 'note').charCodeAt(0) + (note.title?.length ?? 0)) %
        accentTones.length
    ];

  return (
    <motion.article
      layout
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 28,
        mass: 0.7,
        delay: reduceMotion ? 0 : Math.min(index * 0.04, 0.24),
      }}
      className="panel-raised group relative overflow-hidden rounded-[1.25rem] p-5 transition-[border-color,box-shadow] duration-200 hover:border-accent/35 hover:shadow-lift"
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentTone}`}
      />
      <button
        type="button"
        onClick={() => onSelect(note.id)}
        className="absolute inset-0 z-0 rounded-[1.25rem]"
        aria-label={`Open note: ${note.title || 'Untitled'}`}
      />

      <div className="relative z-10">
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

          <h3 className="line-clamp-2 font-display text-xl font-semibold leading-snug tracking-[-0.03em] text-ink">
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
                <ArrowUpRight
                  className="h-3 w-3 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
