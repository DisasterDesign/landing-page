/** Stored agreement evidence only. Active alternatives do not establish replacement or an unpaid balance. */
export interface StoredOrderState {
  id: string;
  clientId?: string | null;
  cardcomAccountId?: number | null;
  cardcomRecurringId?: number | null;
  cardcomIsActive?: boolean | null;
  cardcomSyncedAt?: Date | null;
}
export function inactiveOrderDetails(
  order: StoredOrderState & { monthlyPrice: number; vatExempt?: boolean },
  candidates: readonly StoredOrderState[],
  now = new Date(),
) {
  const positive = (n: number | null | undefined) => n != null && Number.isSafeInteger(n) && n > 0;
  const distinct = new Map<string, StoredOrderState>();
  for (const candidate of candidates) {
    // A boolean on another agreement is not enough to identify a different provider order.
    if (candidate.id === order.id || candidate.cardcomIsActive !== true ||
      !positive(order.cardcomAccountId) || !positive(order.cardcomRecurringId) ||
      !positive(candidate.cardcomAccountId) || !positive(candidate.cardcomRecurringId)) continue;
    if (candidate.cardcomAccountId === order.cardcomAccountId && candidate.cardcomRecurringId === order.cardcomRecurringId) continue;
    if (!(order.clientId != null && candidate.clientId === order.clientId) && candidate.cardcomAccountId !== order.cardcomAccountId) continue;
    const key = JSON.stringify([candidate.cardcomAccountId, candidate.cardcomRecurringId]);
    const previous = distinct.get(key);
    if (!previous || (candidate.cardcomSyncedAt?.getTime() ?? -Infinity) > (previous.cardcomSyncedAt?.getTime() ?? -Infinity)) distinct.set(key, candidate);
  }
  const alternatives = [...distinct.values()];
  const validDates = alternatives.flatMap(a => a.cardcomSyncedAt && Number.isFinite(a.cardcomSyncedAt.getTime()) ? [a.cardcomSyncedAt] : []);
  const stateAt = order.cardcomSyncedAt;
  return {
    priceBasis: order.vatExempt ? 'AGREEMENT_VAT_EXEMPT' as const : 'AGREEMENT_NET' as const,
    expectedAgreementGross: Math.round(order.monthlyPrice * (order.vatExempt ? 1 : 1.18) * 100) / 100,
    orderStateStale: !stateAt || !Number.isFinite(stateAt.getTime()) || now.getTime() - stateAt.getTime() > 36 * 3600000,
    alternatives: {
      status: alternatives.length ? 'ACTIVE_ALTERNATIVE_RECORDED' as const : 'NOT_ESTABLISHED' as const,
      count: alternatives.length,
      sameAccountCount: alternatives.filter(a => positive(order.cardcomAccountId) && a.cardcomAccountId === order.cardcomAccountId).length,
      newestSyncedAt: validDates.length ? new Date(Math.max(...validDates.map(d => d.getTime()))) : null,
      // An account/client match does not prove that a specific service or debt was replaced.
      replacementVerified: false as const,
    },
  };
}

export function debtorReportFreshness(snapshotAt: Date | null, orders: readonly StoredOrderState[], charges: readonly { chargedAt: Date }[], now = new Date()) {
  const dates = orders.flatMap(o => o.cardcomSyncedAt && Number.isFinite(o.cardcomSyncedAt.getTime()) ? [o.cardcomSyncedAt.getTime()] : []);
  const recorded = charges.flatMap(c => Number.isFinite(c.chargedAt.getTime()) ? [c.chargedAt.getTime()] : []);
  return {
    terminalSnapshotAt: snapshotAt,
    terminalSnapshotStale: !snapshotAt || now.getTime() - snapshotAt.getTime() > 36 * 3600000,
    oldestOrderStateAt: dates.length ? new Date(Math.min(...dates)) : null,
    missingOrderStateCount: orders.length - dates.length,
    staleOrderStateCount: orders.filter(o => !o.cardcomSyncedAt || !Number.isFinite(o.cardcomSyncedAt.getTime()) || now.getTime() - o.cardcomSyncedAt.getTime() > 36 * 3600000).length,
    newestChargeRecordedAt: recorded.length ? new Date(Math.max(...recorded)) : null,
    chargeCoverage: 'STORED_ROWS_ONLY' as const,
  };
}
