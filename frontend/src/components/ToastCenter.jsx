import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, Undo2, X } from 'lucide-react';
import { useToastStore } from '../store/useToastStore';

const TONES = {
  success: { icon: CheckCircle2, className: 'bg-success/10 text-success' },
  danger: { icon: AlertTriangle, className: 'bg-danger/10 text-danger' },
  info: { icon: Info, className: 'bg-accent/10 text-accent' },
};

export default function ToastCenter() {
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);

  const runAction = (item) => {
    dismissToast(item.id);
    if (!item.onAction) return;
    try {
      Promise.resolve(item.onAction()).catch(() => {
        /* the store reports request failures through syncError */
      });
    } catch {
      /* a failing action must never leave the toast stack broken */
    }
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(8.5rem+env(safe-area-inset-top))] z-40 flex max-h-[calc(100dvh-10rem)] flex-col items-center gap-2 overflow-y-auto overscroll-contain px-4 min-[360px]:top-[calc(5rem+env(safe-area-inset-top))] min-[360px]:max-h-[calc(100dvh-7rem)] md:top-20 md:max-h-[calc(100dvh-8rem)]"
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence initial={false}>
        {toasts.map((item) => {
          const tone = TONES[item.tone] ?? TONES.info;
          const Icon = tone.icon;
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              role="status"
              className="panel-raised pointer-events-auto flex w-full max-w-md items-start gap-3 p-3.5"
            >
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone.className}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">
                    {item.description}
                  </p>
                )}
                {item.actionLabel && item.onAction && (
                  <button
                    type="button"
                    onClick={() => runAction(item)}
                    className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent/15"
                  >
                    {item.actionLabel.toLowerCase() === 'undo' ? (
                      <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : null}
                    {item.actionLabel}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => dismissToast(item.id)}
                className="icon-btn h-7 w-7 shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
