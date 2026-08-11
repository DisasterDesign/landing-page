/**
 * Cardcom standing orders with no client behind them.
 *
 * Written after the 2026-08-11 reconciliation, which found ₪236/month being
 * collected from a client nobody had recorded and a price stored net-of-VAT in
 * a field read as gross — between them, money owed to a partner that no report
 * could see. Both were eighteen months old and both would have surfaced on day
 * one from this comparison.
 *
 * The check is deliberately one-directional: an order with no client is a
 * finding, a client with no order is not. Most clients predate the agreement
 * flow and have no account id at all, so the reverse check would fire on
 * almost everyone and be switched off within a week.
 */

export interface ChargeRow {
  accountId: number | null;
  payer: string;
  amount: number;
  /** ISO-ish date string; compared lexically, which is safe for ISO. */
  chargedAt: string;
}

export interface UnlinkedOrder {
  accountId: number;
  payer: string;
  /** The most recent amount charged — prices change. */
  amount: number;
  charges: number;
  lastChargedAt: string;
}

export function findUnlinkedOrders(
  charges: ChargeRow[],
  linked: Set<number>,
): UnlinkedOrder[] {
  const byAccount = new Map<number, UnlinkedOrder>();

  for (const c of charges) {
    // No account means a one-off — a quote, or a charge keyed in by hand. It is
    // not a standing order and must not be reported as a missing client.
    // Cardcom spells "none" as 0 rather than null, which is how a manual ₪354
    // charge showed up as an orphaned order on the first dry run.
    if (!c.accountId) continue;
    if (linked.has(c.accountId)) continue;

    const seen = byAccount.get(c.accountId);
    if (!seen) {
      byAccount.set(c.accountId, {
        accountId: c.accountId,
        payer: c.payer,
        amount: c.amount,
        charges: 1,
        lastChargedAt: c.chargedAt,
      });
      continue;
    }
    seen.charges += 1;
    if (c.chargedAt > seen.lastChargedAt) {
      seen.lastChargedAt = c.chargedAt;
      seen.amount = c.amount;
      seen.payer = c.payer;
    }
  }

  // Biggest first: the top row is the one costing the most to ignore.
  return [...byAccount.values()].sort((a, b) => b.amount - a.amount);
}

const NAMED = 5;

export function summariseUnlinked(
  orders: UnlinkedOrder[],
): { title: string; body: string } | null {
  if (orders.length === 0) return null;

  const total = orders.reduce((s, o) => s + o.amount, 0);
  const lines = orders
    .slice(0, NAMED)
    .map((o) => `${o.payer} — ₪${Math.round(o.amount)} (חשבון ${o.accountId})`);
  const rest = orders.length - NAMED;

  return {
    title: `⚠️ ${orders.length} הוראות קבע בקארדקום בלי לקוח`,
    body:
      `₪${Math.round(total).toLocaleString("he-IL")} לחודש נגבים ולא רשומים.\n` +
      lines.join("\n") +
      (rest > 0 ? `\nועוד ${rest}.` : ""),
  };
}
