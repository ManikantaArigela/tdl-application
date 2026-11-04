import React from 'react';
import { Plus, ScrollText, SearchX, StickyNote, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import TiltNoteCard from '../components/TiltNoteCard';
import { plural } from '../lib/format';
import { collectTags, noteMatchesFilters } from '../lib/notes';

export default function NotesView({ starred = false, archive = false } = {}) {
  const notes = useStore((s) => s.notes);
  const searchQuery = useStore((s) => s.searchQuery);
  const activeTags = useStore((s) => s.activeTags);
  const toggleTag = useStore((s) => s.toggleTag);
  const clearTags = useStore((s) => s.clearTags);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const addNote = useStore((s) => s.addNote);
  const selectNote = useStore((s) => s.selectNote);
  const togglePin = useStore((s) => s.togglePin);
  const toggleArchive = useStore((s) => s.toggleArchive);
  const deleteNote = useStore((s) => s.deleteNote);
  const createTaskFromNote = useStore((s) => s.createTaskFromNote);
  const setActiveView = useStore((s) => s.setActiveView);
  const setAISummaryOpen = useStore((s) => s.setAISummaryOpen);

  const searching = searchQuery.trim().length > 0;
  const filtering = searching || activeTags.length > 0;

  const matched = React.useMemo(
    () =>
      notes.filter((note) => {
        if (archive ? !note.archived : note.archived) return false;
        return noteMatchesFilters(note, { query: searchQuery, tags: activeTags });
      }),
    [notes, searchQuery, activeTags, archive]
  );

  // Keep a chip visible even if its last note was edited/deleted, otherwise the
  // active filter would be invisible and impossible to clear.
  const tagOptions = React.useMemo(() => {
    const scoped = notes.filter((note) => {
      if (archive) return note.archived;
      if (starred) return !note.archived && note.pinned;
      return !note.archived;
    });
    const options = collectTags(scoped);
    const known = new Set(options.map((option) => option.tag));
    activeTags.forEach((tag) => {
      if (!known.has(tag)) options.push({ tag, label: tag, count: 0 });
    });
    return options;
  }, [notes, archive, starred, activeTags]);

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
          onMakeTask={createTaskFromNote}
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
            {activeTags.length > 0
              ? ` · tagged ${activeTags.map((tag) => `#${tag}`).join(', ')}`
              : ''}
          </p>
        </div>
        {!archive && !starred && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAISummaryOpen(true)}
              className="btn-ghost"
              title="Summarize all notes with Nova AI"
            >
              <ScrollText className="h-4 w-4" aria-hidden="true" /> Summarize
            </button>
            <button type="button" onClick={handleCreate} className="btn-primary">
              <Plus className="h-4 w-4" aria-hidden="true" /> New note
            </button>
          </div>
        )}
      </div>

      {tagOptions.length > 0 && (
        <div
          className="mb-5 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter notes by tag"
        >
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
            Tags
          </span>
          {tagOptions.map(({ tag, label, count }) => {
            const active = activeTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                aria-pressed={active}
                title={active ? `Remove #${label} filter` : `Filter by #${label}`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'border-accent bg-accent text-accent-fg shadow-sm'
                    : 'border-line bg-panel text-muted hover:border-accent/40 hover:bg-lavender hover:text-accent'
                }`}
              >
                <span className="max-w-[10rem] truncate">#{label}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] font-semibold ${
                      active ? 'text-accent-fg/70' : 'text-faint'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          {activeTags.length > 0 && (
            <button
              type="button"
              onClick={clearTags}
              className="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-accent transition-colors hover:bg-lavender"
            >
              <X className="h-3 w-3" aria-hidden="true" /> Clear tags
            </button>
          )}
        </div>
      )}

      {list.length === 0 ? (
        <div className="panel flex flex-col items-center px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lavender text-accent">
            {filtering ? (
              <SearchX className="h-6 w-6" aria-hidden="true" />
            ) : (
              <StickyNote className="h-6 w-6" aria-hidden="true" />
            )}
          </span>
          <h3 className="mt-4 text-xl text-ink">
            {filtering ? 'No notes match those filters' : archive ? 'Nothing archived' : 'No notes yet'}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted">
            {filtering
              ? 'Try a different word or tag, or clear the filters to see everything.'
              : archive
              ? 'Notes you archive will be kept here, out of the way.'
              : 'Capture a thought, a meeting, or a draft. Notes save as you type.'}
          </p>
          {filtering ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                clearTags();
              }}
              className="btn-ghost mt-5"
            >
              Clear filters
            </button>
          ) : (
            !archive && (
              <button type="button" onClick={handleCreate} className="btn-primary mt-5">
                <Plus className="h-4 w-4" aria-hidden="true" /> Write a note
              </button>
            )
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
