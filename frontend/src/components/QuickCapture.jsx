import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Plus, X } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function QuickCapture() {
  const toggleQuickCapture = useStore((s) => s.toggleQuickCapture);
  const quickCaptureType = useStore((s) => s.quickCaptureType);
  const addTodo = useStore((s) => s.addTodo);
  const addNote = useStore((s) => s.addNote);

  const [text, setText] = React.useState('');
  const [type, setType] = React.useState(quickCaptureType);
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    setType(quickCaptureType);
  }, [quickCaptureType]);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const canSave = text.trim().length > 0 && !saving;

  const save = async () => {
    const value = text.trim();
    if (!value || saving) return;
    setSaving(true);
    const created =
      type === 'todo'
        ? await addTodo({ text: value, priority: 'medium', completed: false })
        : await addNote({ title: value, content: '', tags: [], pinned: false, archived: false });
    setSaving(false);
    if (created) {
      setText('');
      toggleQuickCapture();
    }
  };

  return (
    <>
      <motion.button
        type="button"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={toggleQuickCapture}
        className="fixed inset-0 z-40 cursor-default bg-black/40 backdrop-blur-[2px]"
        aria-label="Close quick capture"
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        role="dialog"
        aria-modal="true"
        aria-label="Quick capture"
        className="fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:bottom-8 sm:right-8 sm:w-full sm:max-w-md"
      >
        <div className="panel-raised p-4 shadow-lift sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg text-ink">Quick capture</h2>
            <button
              type="button"
              onClick={toggleQuickCapture}
              className="icon-btn h-8 w-8"
              aria-label="Close quick capture"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2" role="group" aria-label="Capture type">
            {[
              { id: 'note', label: 'Note' },
              { id: 'todo', label: 'Todo' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setType(option.id)}
                aria-pressed={type === option.id}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  type === option.id
                    ? 'border-accent bg-accent/10 text-ink'
                    : 'border-line text-muted hover:bg-raised'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label htmlFor="quick-capture-input" className="sr-only">
            {type === 'todo' ? 'Task text' : 'Note title'}
          </label>
          <input
            id="quick-capture-input"
            ref={inputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                save();
              }
            }}
            placeholder={type === 'todo' ? 'What needs doing?' : 'What is on your mind?'}
            className="input"
          />

          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-faint">Enter to save</span>
            <button type="button" onClick={save} className="btn-primary text-xs" disabled={!canSave}>
              {type === 'todo' ? (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
