import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ListChecks,
  RotateCcw,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { plural, relativeTime } from '../lib/format';

function TrashItem({ item, kind, busy, onRestore, onDelete }) {
  const label = kind === 'note' ? item.title?.trim() || 'Untitled note' : item.text;
  const detail =
    kind === 'note'
      ? item.content?.trim() || 'Empty note'
      : `${item.priority ?? 'medium'} priority${item.completed ? ' · completed' : ''}`;
  const deletedAt = item.trashedAt ?? item.updatedAt ?? item.createdAt;

  return (
    <li className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{label}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">{detail}</p>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-faint">
          <Clock className="h-3 w-3" aria-hidden="true" />
          Deleted {relativeTime(deletedAt)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onRestore(item.id)}
          disabled={busy}
          className="btn-ghost px-2.5 py-1.5 text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Restore
        </button>
        <button
          type="button"
          onClick={() => onDelete(item)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-danger/25 bg-danger/5 px-2.5 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/10 disabled:pointer-events-none disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete forever
        </button>
      </div>
    </li>
  );
}

export default function TrashView() {
  const trashedNotes = useStore((s) => s.trashedNotes);
  const trashedTodos = useStore((s) => s.trashedTodos);
  const restoreNote = useStore((s) => s.restoreNote);
  const restoreTodo = useStore((s) => s.restoreTodo);
  const permanentlyDeleteNote = useStore((s) => s.permanentlyDeleteNote);
  const permanentlyDeleteTodo = useStore((s) => s.permanentlyDeleteTodo);
  const emptyTrash = useStore((s) => s.emptyTrash);

  const [busyId, setBusyId] = React.useState(null);
  const total = trashedNotes.length + trashedTodos.length;

  const run = async (id, action) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await action();
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = (item, kind) => {
    const label = kind === 'note' ? item.title?.trim() || 'Untitled note' : item.text;
    if (!window.confirm(`Permanently delete “${label}”? This cannot be undone.`)) return;
    run(item.id, () =>
      kind === 'note' ? permanentlyDeleteNote(item.id) : permanentlyDeleteTodo(item.id)
    );
  };

  const handleEmpty = () => {
    if (!window.confirm(`Permanently delete everything in Trash (${total})? This cannot be undone.`)) {
      return;
    }
    run('trash', emptyTrash);
  };

  return (
    <section aria-labelledby="trash-heading">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="trash-heading" className="text-3xl font-semibold tracking-[-0.045em] text-ink sm:text-4xl">
            Trash
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            {total} {plural(total, 'item')} · Restore anything, or delete it forever.
          </p>
        </div>
        {total > 0 && (
          <button
            type="button"
            onClick={handleEmpty}
            disabled={Boolean(busyId)}
            className="inline-flex items-center gap-2 rounded-xl border border-danger/25 bg-danger/5 px-3 py-2 text-xs font-semibold text-danger transition-colors hover:bg-danger/10 disabled:pointer-events-none disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Empty Trash
          </button>
        )}
      </div>

      {total === 0 ? (
        <div className="panel flex flex-col items-center px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lavender text-accent">
            <Trash2 className="h-6 w-6" aria-hidden="true" />
          </span>
          <h3 className="mt-4 text-xl text-ink">Trash is empty</h3>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Notes and tasks you delete wait here until you restore them or remove them for good.
          </p>
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <section className="panel-raised p-4 sm:p-5" aria-labelledby="trash-notes-heading">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <StickyNote className="h-4 w-4" aria-hidden="true" />
              </span>
              <h3 id="trash-notes-heading" className="text-sm font-semibold text-ink">
                Notes
              </h3>
              <span className="ml-auto font-mono text-[11px] text-faint">{trashedNotes.length}</span>
            </div>

            {trashedNotes.length === 0 ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl bg-raised/70 px-3 py-3 text-xs text-muted">
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                No notes in Trash.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-line/70">
                {trashedNotes.map((note) => (
                  <TrashItem
                    key={note.id}
                    item={note}
                    kind="note"
                    busy={Boolean(busyId)}
                    onRestore={(id) => run(id, () => restoreNote(id))}
                    onDelete={(item) => confirmDelete(item, 'note')}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="panel-raised p-4 sm:p-5" aria-labelledby="trash-tasks-heading">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <ListChecks className="h-4 w-4" aria-hidden="true" />
              </span>
              <h3 id="trash-tasks-heading" className="text-sm font-semibold text-ink">
                Tasks
              </h3>
              <span className="ml-auto font-mono text-[11px] text-faint">{trashedTodos.length}</span>
            </div>

            {trashedTodos.length === 0 ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl bg-raised/70 px-3 py-3 text-xs text-muted">
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                No tasks in Trash.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-line/70">
                {trashedTodos.map((todo) => (
                  <TrashItem
                    key={todo.id}
                    item={todo}
                    kind="todo"
                    busy={Boolean(busyId)}
                    onRestore={(id) => run(id, () => restoreTodo(id))}
                    onDelete={(item) => confirmDelete(item, 'todo')}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <p className="mt-4 flex items-start gap-2 rounded-xl border border-line/70 bg-raised/60 px-3 py-2.5 text-[11px] leading-relaxed text-muted">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
        Deleted items stay in Trash until you empty it. “Delete forever” cannot be undone.
      </p>
    </section>
  );
}
