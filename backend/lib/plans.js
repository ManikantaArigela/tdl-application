/**
 * Account-plan policy.
 *
 * Plan ids are intentionally small and stable so the frontend and backend can
 * share the same vocabulary. Reminders (including push and in-app voice calls)
 * are a Premium entitlement; the server is the source of truth so a local
 * preference edit cannot unlock them.
 */

const PLAN_IDS = ['free', 'pro', 'premium'];

const normalizePlan = (value) => (PLAN_IDS.includes(value) ? value : 'free');

const isPremiumPlan = (value) => normalizePlan(value) === 'premium';

const planAllowsReminders = (value) => isPremiumPlan(value);

module.exports = {
  PLAN_IDS,
  normalizePlan,
  isPremiumPlan,
  planAllowsReminders,
};
