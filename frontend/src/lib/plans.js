export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    cadence: 'forever',
    tagline: 'For a calm start.',
    description: 'The essentials, with a small monthly AI allowance.',
    cta: 'Start free',
    highlight: false,
    features: [
      'Unlimited notes and tasks',
      'In-app reminders on every device',
      'Browser notifications when allowed',
      '5 AI planner runs each month',
      '10 AI note actions each month',
      'Markdown export',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 20,
    cadence: 'month',
    tagline: 'For daily momentum.',
    description: 'More AI, plus PDF imports for real work.',
    cta: 'Choose Pro',
    highlight: true,
    badge: 'Most popular',
    features: [
      'Everything in Free',
      '100 AI planner runs each month',
      '100 AI note actions each month',
      'PDF imports',
      'Priority reminder center',
      'All current features',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 50,
    cadence: 'month',
    tagline: 'For power users.',
    description: 'No AI limits, priority support, and early access.',
    cta: 'Choose Premium',
    highlight: false,
    badge: 'Unlimited',
    features: [
      'Everything in Pro',
      'Unlimited AI planner runs',
      'Unlimited AI note actions',
      'Priority support',
      'Early access to new tools',
      'Support independent software',
    ],
  },
];

export const PLAN_LIMITS = {
  free: { planner: 5, notes: 10, pdf: false },
  pro: { planner: 100, notes: 100, pdf: true },
  premium: { planner: Infinity, notes: Infinity, pdf: true },
};

export function normalizePlan(value) {
  return PLANS.some((plan) => plan.id === value) ? value : 'free';
}

export function getPlan(value) {
  return PLANS.find((plan) => plan.id === normalizePlan(value)) ?? PLANS[0];
}

export function getPlanLimits(value) {
  return PLAN_LIMITS[normalizePlan(value)] ?? PLAN_LIMITS.free;
}

export function formatLimit(value) {
  return value === Infinity ? 'Unlimited' : String(value);
}
