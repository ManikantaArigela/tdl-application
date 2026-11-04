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
      'Priority AI queue',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 50,
    cadence: 'month',
    tagline: 'For power users.',
    description: 'Unlimited AI, smart reminders, and voice calls.',
    cta: 'Choose Premium',
    highlight: false,
    badge: 'Everything',
    features: [
      'Everything in Pro',
      'Unlimited AI planner runs',
      'Unlimited AI note actions',
      'Smart reminders + voice calls',
      'Priority support',
      'Early access to new tools',
    ],
  },
];

/**
 * Entitlements are the single source of truth for plan-gated UI. The backend
 * enforces the same rules, so changing localStorage cannot unlock a feature.
 */
export const PLAN_LIMITS = {
  free: {
    planner: 5,
    notes: 10,
    pdf: false,
    reminders: false,
    voiceCalls: false,
    prioritySupport: false,
    earlyAccess: false,
  },
  pro: {
    planner: 100,
    notes: 100,
    pdf: true,
    reminders: false,
    voiceCalls: false,
    prioritySupport: false,
    earlyAccess: false,
  },
  premium: {
    planner: Infinity,
    notes: Infinity,
    pdf: true,
    reminders: true,
    voiceCalls: true,
    prioritySupport: true,
    earlyAccess: true,
  },
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

export function isPremiumPlan(value) {
  return normalizePlan(value) === 'premium';
}

export function planAllows(value, feature) {
  return Boolean(getPlanLimits(value)[feature]);
}

export function formatLimit(value) {
  return value === Infinity ? 'Unlimited' : String(value);
}
