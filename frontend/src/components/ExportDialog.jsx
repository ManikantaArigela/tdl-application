import React from 'react';
import { motion } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function ExportDialog() {
  const setExportOpen = useStore((s) => s.setExportOpen);
  const exportMarkdown = useStore((s) => s.exportMarkdown);
  const notes = useStore((s) => s.notes);
  const todos = useStore((s) => s.todos);

  const downloadRef = React.useRef(null);

  React.useEffect(() => {
    downloadRef.current?.focus();
  }, []);

  const close = () => setExportOpen(false);

  const handleDownload = () => {
    const content = exportMarkdown();
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nova-export-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    close();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm"
      onClick={close}
    >
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.99 }}
        transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-heading"
        className="panel-raised w-full max-w-sm p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="export-heading" className="text-xl text-ink">
            Export
          </h2>
          <button type="button" onClick={close} className="icon-btn h-8 w-8" aria-label="Close export">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p className="text-sm leading-relaxed text-muted">
          Download {notes.length} {notes.length === 1 ? 'note' : 'notes'} and {todos.length}{' '}
          {todos.length === 1 ? 'todo' : 'todos'} as a single Markdown file.
        </p>

        <button ref={downloadRef} type="button" onClick={handleDownload} className="btn-primary mt-5 w-full">
          <Download className="h-4 w-4" aria-hidden="true" /> Download Markdown
        </button>
      </motion.div>
    </motion.div>
  );
}
