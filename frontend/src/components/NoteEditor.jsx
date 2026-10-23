import React from 'react';
import { Archive, ArchiveRestore, ArrowLeft, Pin, Save, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatDateTime, plural } from '../lib/format';

const AUTOSAVE_MS = 700;

export default function NoteEditor({ note }) {
  const updateNote = useStore((s) => s.updateNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const togglePin = useStore((s) => s.togglePin);
  const toggleArchive = useStore((s) => s.toggleArchive);
  const selectNote = useStore((s) => s.selectNote);

  const [title, setTitle] = React.useState(note.title ?? '');
  const [content, setContent] = React.useState(note.content ?? '');
  const [tagsText, setTagsText] = React.useState((note.tags ?? []).join(', '));
  const [status, setStatus] = React.useState('idle');

  const dirtyRef = React.useRef(false);
  const latestRef = React.useRef({ title, content, tagsText });
  latestRef.current = { title, content, tagsText };

  React.useEffect(() => {
    setTitle(note.title ?? '');
    setContent(note.content ?? '');
    setTagsText((note.tags ?? []).join(', '));
    setStatus('idle');
    dirtyRef.current = false;
  }, [note.id]);

  const parseTags = (value) =>
    value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8);

  const persist = React.useCallback(
    async (value) => {
      setStatus('saving');
      const updated = await updateNote(note.id, {
        title: value.title,
        content: value.content,
        tags: parseTags(value.tagsText),
      });
      if (updated) {
        dirtyRef.current = false;
        setStatus('saved');
      } else {
        // Keep the draft marked dirty so the next edit retries the save.
        setStatus('error');
      }
    },
    [note.id, updateNote]
  );

  React.useEffect(() => {
    if (!dirtyRef.current) return undefined;
    setStatus('saving');
    const timer = setTimeout(() => persist(latestRef.current), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [title, content, tagsText, persist]);

  React.useEffect(
    () => () => {
      if (dirtyRef.current) persist(latestRef.current);
    },
    [persist]
  );

  const markDirty = () => {
    dirtyRef.current = true;
    setStatus('idle');
  };

  const saveNow = () => {
    if (dirtyRef.current) persist(latestRef.current);
  };

  const handleDelete = () => {
    if (window.confirm('Delete this note? This cannot be undone.')) {
      // Prevent the unmount flush from trying to update a deleted note.
      dirtyRef.current = false;
      deleteNote(note.id);
    }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  const statusLabel =
    status === 'saving'
      ? 'Saving…'
      : status === 'saved'
      ? 'Saved'
      : status === 'error'
      ? 'Not saved — backend unreachable'
      : 'Autosave on';

  return (
    <div
      className="panel-raised p-5 md:p-8"
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          saveNow();
        }
      }}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => selectNote(null)}
          className="btn-ghost px-2.5 py-1.5 text-xs"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => togglePin(note.id)}
            className={`icon-btn ${note.pinned ? 'text-accent' : ''}`}
            aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
            aria-pressed={Boolean(note.pinned)}
          >
            <Pin className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => toggleArchive(note.id)}
            className="icon-btn"
            aria-label={note.archived ? 'Restore note from archive' : 'Archive note'}
          >
            {note.archived ? (
              <ArchiveRestore className="h-[18px] w-[18px]" aria-hidden="true" />
            ) : (
              <Archive className="h-[18px] w-[18px]" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="icon-btn hover:text-danger"
            aria-label="Delete note"
          >
            <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          <button type="button" onClick={saveNow} className="btn-primary ml-1 text-xs">
            <Save className="h-4 w-4" aria-hidden="true" /> Save
          </button>
        </div>
      </div>

      <input
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          markDirty();
        }}
        placeholder="Untitled note"
        aria-label="Note title"
        className="w-full bg-transparent font-display text-3xl leading-tight text-ink outline-none placeholder:text-faint md:text-4xl"
      />

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
        <span role="status" aria-live="polite">
          {statusLabel}
        </span>
        <span aria-hidden="true">·</span>
        <span>{formatDateTime(note.updatedAt)}</span>
      </div>

      <div className="mt-4">
        <label htmlFor="note-tags" className="sr-only">
          Tags, separated by commas
        </label>
        <input
          id="note-tags"
          value={tagsText}
          onChange={(event) => {
            setTagsText(event.target.value);
            markDirty();
          }}
          placeholder="Add tags, separated by commas"
          className="input py-2 text-xs"
        />
      </div>

      <textarea
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          markDirty();
        }}
        placeholder="Start writing…"
        aria-label="Note content"
        className="mt-5 min-h-[45vh] w-full resize-y bg-transparent text-[15px] leading-7 text-ink outline-none placeholder:text-faint md:min-h-[55vh]"
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-4 text-xs text-faint">
        <span>
          {wordCount} {plural(wordCount, 'word')}
        </span>
        <span>
          <kbd className="kbd">⌘S</kbd> to save now
        </span>
      </div>
    </div>
  );
}
