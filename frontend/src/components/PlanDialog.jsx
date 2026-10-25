import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bell,
  Check,
  Crown,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { PLANS, getPlan } from '../lib/plans';

const CARD_TONES = {
  free: {
    card: 'border-line bg-panel text-ink',
    muted: 'text-muted',
    icon: 'bg-lavender text-accent',
    button: 'btn-ghost w-full',
    check: 'bg-accent/10 text-accent',
  },
  pro: {
    card: 'border-[#26086E] bg-[#26086E] text-white',
    muted: 'text-white/60',
    icon: 'bg-white/10 text-pop-yellow',
    button:
      'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-pop-yellow px-4 py-2.5 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5',
    check: 'bg-white/10 text-pop-yellow',
  },
  premium: {
    card: 'border-accent/15 bg-lavender text-ink',
    muted: 'text-muted',
    icon: 'bg-panel/80 text-accent',
    button: 'btn-primary w-full',
    check: 'bg-panel/80 text-accent',
  },
};

export default function PlanDialog() {
  const setOpen = useStore((s) => s.setPlanDialogOpen);
  const plan = useStore((s) => s.plan);
  const setPlan = useStore((s) => s.setPlan);
  const usage = useStore((s) => s.planUsage);
  const current = getPlan(plan);

  React.useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setOpen]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 px-3 py-5 backdrop-blur-sm sm:px-4"
      onClick={() => setOpen(false)}
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-dialog-heading"
        className="panel-raised max-h-[92dvh] w-full max-w-5xl overflow-y-auto p-4 sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-accent">
              <Crown className="h-3.5 w-3.5" aria-hidden="true" />
              Plans
            </p>
            <h2
              id="plan-dialog-heading"
              className="mt-1.5 text-2xl font-semibold tracking-[-0.045em] text-ink sm:text-3xl"
            >
              Pick a pace that fits.
            </h2>
            <p className="mt-1.5 max-w-xl text-sm text-muted">
              Plans decide your monthly AI allowance and file imports. Reminders work on every
              plan.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="icon-btn h-8 w-8 shrink-0"
            aria-label="Close plans"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-accent/10 bg-lavender px-3.5 py-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-panel text-accent">
            <Bell className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold text-ink">Notifications stay on every plan</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
              In-app reminders are always included. Browser alerts are included too when you
              allow them.
            </p>
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-panel px-2 py-1 text-[10px] font-semibold text-accent">
            Included
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {PLANS.map((item) => {
            const tone = CARD_TONES[item.id];
            const isCurrent = item.id === plan;
            return (
              <motion.article
                key={item.id}
                whileHover={{ y: -3 }}
                transition={{ type: 'spring', stiffness: 320, damping: 25 }}
                className={`relative flex flex-col rounded-[1.3rem] border p-4 sm:p-5 ${tone.card}`}
              >
                {item.badge && (
                  <span
                    className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      item.highlight
                        ? 'bg-pop-yellow text-ink'
                        : 'bg-panel text-accent ring-1 ring-accent/15'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone.icon}`}
                  aria-hidden="true"
                >
                  {item.id === 'free' ? (
                    <Sparkles className="h-4 w-4" />
                  ) : item.id === 'pro' ? (
                    <Crown className="h-4 w-4" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                </span>

                <h3 className="mt-3 text-lg font-semibold tracking-[-0.03em]">{item.name}</h3>
                <p className={`mt-0.5 text-[11px] leading-relaxed ${tone.muted}`}>
                  {item.description}
                </p>

                <div className="mt-4 flex items-end gap-1.5">
                  <span className="text-3xl font-bold tracking-[-0.06em]">₹{item.price}</span>
                  <span className={`pb-1 text-[11px] ${tone.muted}`}>/ {item.cadence}</span>
                </div>

                <ul className="mt-4 flex-1 space-y-2">
                  {item.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[11px] leading-relaxed">
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${tone.check}`}
                      >
                        <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
                      </span>
                      <span className={item.highlight ? 'text-white/80' : 'text-ink'}>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4">
                  {isCurrent ? (
                    <span
                      className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold ${
                        item.highlight
                          ? 'bg-white/10 text-white/75'
                          : 'bg-accent/10 text-accent'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      Current plan
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPlan(item.id)}
                      className={tone.button}
                    >
                      {item.cta}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </motion.article>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-3 text-[10px] leading-relaxed text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            You are on <span className="font-semibold text-ink">{current.name}</span>. AI usage
            this month: {usage.planner} {usage.planner === 1 ? 'planner run' : 'planner runs'} and{' '}
            {usage.notes} {usage.notes === 1 ? 'note action' : 'note actions'}.
          </p>
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            Demo billing: plan changes apply instantly. Connect Razorpay or Stripe before real
            payments.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
