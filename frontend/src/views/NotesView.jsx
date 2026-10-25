import React from 'react';
import { Plus, ScrollText, SearchX, StickyNote } from 'lucide-react';
import { useStore } from '../store/useStore';
import TiltNoteCard from '../components/TiltNoteCard';
import { plural } from '../lib/format';

export default function NotesView({ starred = false, archive = false } = {}) {
  const notes = useStore((s) => s.notes);
  const searchQuery = useStore((s) => s.searchQuery);
  const addNote = useStore((s) => s.addNote);
  const selectNote = useStore((s) => s.selectNote);
  const togglePin = useStore((s) => s.togglePin);
  const toggleArchive = useStore((s) => s.toggleArchive);
  const deleteNote = useStore((s) => s.deleteNote);
  const setActiveView = useStore((s) => s.setActiveView);
  const setAISummaryOpen = useStore((s) => s.setAISummaryOpen);

  const query = searchQuery.trim().toLowerCase();
  const searching = query.length > 0;

  const matched = React.useMemo(
    () =>
      notes.filter((note) => {
        if (archive ? !note.archived : note.archived) return false;
        if (!query) return true;
        return (
          (note.title ?? '').toLowerCase().includes(query) ||
          (note.content ?? '').toLowerCase().includes(query) ||
          (note.tags ?? []).some((tag) => tag.toLowerCase().includes(query))
        );
      }),
    [notes, query, archive]
  );

  const list = starred ? matched.filter((note) => note.pinned) : matched;
  const pinned = !starred && !archive ? list.filter((note) => note.pinned) : [];
  const rest = !starred && !archive ? list.filter((note) => !note.pinned) : list;

  const heading = starred ? 'Starred' : archive ? 'Archive' : 'Notes';

  const handleCreate = async () => {
    const created = await addNote({
      title: '',
      content: '',
      tags: [],
      pinned: false,
      archived: false,
    });
    if (created) {
      setActiveView('notes');
      selectNote(created.id);
    }
  };

  const renderGrid = (items) => (
    <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((note, index) => (
        <TiltNoteCard
          key={note.id}
          note={note}
          index={index}
          archived={archive}
          onSelect={selectNote}
          onDelete={deleteNote}
          onPin={togglePin}
          onArchive={toggleArchive}
        />
      ))}
    </div>
  );

  return (
    <section aria-labelledby="notes-heading">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="notes-heading" className="text-3xl font-semibold tracking-[-0.045em] text-ink sm:text-4xl">
            {heading}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {list.length} {plural(list.length, 'note')}
            {searching ? ` matching “${searchQuery.trim()}”` : ''}
          </p>
        </div>
        {!archive && !starred && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAISummaryOpen(true)}
              className="btn-ghost"
              title="Summarize all notes with Gemini"
            >
              <ScrollText className="h-4 w-4" aria-hidden="true" /> Summarize
            </button>
            <button type="button" onClick={handleCreate} className="btn-primary">
              <Plus className="h-4 w-4" aria-hidden="true" /> New note
            </button>
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <div className="panel flex flex-col items-center px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lavender text-accent">
            {searching ? (
              <SearchX className="h-6 w-6" aria-hidden="true" />
            ) : (
              <StickyNote className="h-6 w-6" aria-hidden="true" />
            )}
          </span>
          <h3 className="mt-4 text-xl text-ink">
            {searching ? 'No notes match that search' : archive ? 'Nothing archived' : 'No notes yet'}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted">
            {searching
              ? 'Try a different word, or clear the search to see everything.'
              : archive
              ? 'Notes you archive will be kept here, out of the way.'
              : 'Capture a thought, a meeting, or a draft. Notes save as you type.'}
          </p>
          {!searching && !archive && (
            <button type="button" onClick={handleCreate} className="btn-primary mt-5">
              <Plus className="h-4 w-4" aria-hidden="true" /> Write a note
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {pinned.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-medium tracking-wide text-muted">Pinned</h3>
              {renderGrid(pinned)}
            </div>
          )}
          {rest.length > 0 && (
            <div>
              {pinned.length > 0 && (
                <h3 className="mb-3 text-xs font-medium tracking-wide text-muted">All notes</h3>
              )}
              {renderGrid(rest)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
