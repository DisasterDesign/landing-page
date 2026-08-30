/**
 * Which monthly-charge events are worth interrupting a human for.
 *
 * Policy (18.8.2026): a successful recurring charge is silent. With ~22
 * recurring clients, announcing each one produced dozens of pushes and emails
 * a month that all said "everything is fine", and the exceptions that actually
 * need action — a failed charge, a standing order Cardcom switched off, a
 * charge we cannot reconcile against booked revenue — were lost inside them.
 * Received money is always visible in /admin/finance; only exceptions push.
 *
 * Three separate routes (recurring-webhook, payments/webhook, the reconcile
 * cron) implement the same rule, so it lives here once and is pinned by
 * recurring-notifications.test.ts.
 */
export function recurringChargeNeedsAttention(outcome: {
  /** Cardcom reported the charge as collected. */
  success: boolean;
  /** We could not prove the historical revenue was not already booked. */
  reviewRequired: boolean;
}): boolean {
  // Review wins over success: double-booking income is worse than a ping.
  return outcome.reviewRequired || !outcome.success;
}
