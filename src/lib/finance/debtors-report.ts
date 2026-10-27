import { prisma } from '@/lib/prisma';
import type { PrismaClient } from '@prisma/client';
import type { Viewer } from '@/lib/auth/viewer';
import type { DebtorSnapshotEntry } from '@/lib/cardcom-debtors';
import { inactiveOrderDetails, debtorReportFreshness } from './debtor-report-details';
import { partitionDebtors, type DismissedDebtors } from '@/lib/debtor-dismissal';

/** Stored report only: no provider, synchronization, notification or write dependencies. */
export async function loadDebtorsReport(viewer: Viewer, db: Pick<PrismaClient, 'agreementCharge' | 'agreement' | 'keyValue'> = prisma) {
    if (!viewer.isOwner) throw new Error('Forbidden');
    const [problemCharges, inactiveOrders, snapshotRow] = await Promise.all([
      db.agreementCharge.findMany({
        where: {
          OR: [
            { success: false },
            { status: { in: ["DEBTAUTOBILLING", "LOSTDEBT", "ONHOLD"] } },
          ],
        },
        orderBy: { chargedAt: "desc" },
        take: 100,
        select: {
          id: true,
          amount: true,
          status: true,
          responseCode: true,
          billingAttempts: true,
          cardcomChargeDate: true,
          chargedAt: true,
          invoiceNumber: true,
          agreement: {
            select: {
              id: true,
              customerName: true,
              businessName: true,
              monthlyPrice: true,
              cardcomIsActive: true,
              cardcomNextBillDate: true,
              client: { select: { id: true, name: true, number: true } },
            },
          },
        },
      }),
      db.agreement.findMany({
        where: {
          cardcomIsActive: false,
          client: { archivedAt: null },
        },
        select: {
          id: true,
          customerName: true,
          businessName: true,
          monthlyPrice: true,
          vatExempt: true,
          clientId: true,
          cardcomAccountId: true,
          cardcomRecurringId: true,
          cardcomNextBillDate: true,
          cardcomSyncedAt: true,
          client: { select: { id: true, name: true, number: true, monthlyAmount: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      // Terminal-wide debtors snapshot, refreshed by the daily reconcile.
      // Covers recurring orders created manually in the Cardcom dashboard,
      // which no agreement (and therefore no charge row) knows about.
      db.keyValue.findUnique({ where: { key: "cardcom_debtors_snapshot" } }),
    ]);

    const clientIds = inactiveOrders.flatMap(o => o.clientId ? [o.clientId] : []);
    const accountIds = inactiveOrders.flatMap(o => o.cardcomAccountId != null && o.cardcomAccountId > 0 ? [o.cardcomAccountId] : []);
    const alternatives = clientIds.length || accountIds.length ? await db.agreement.findMany({
      where: { cardcomIsActive: true, OR: [{ clientId: { in: clientIds } }, { cardcomAccountId: { in: accountIds } }] },
      select: { id: true, clientId: true, cardcomAccountId: true, cardcomRecurringId: true, cardcomIsActive: true, cardcomSyncedAt: true },
    }) : [];
    const now = new Date();
    const detailedOrders = inactiveOrders.map(order => ({ ...order, ...inactiveOrderDetails(order, alternatives, now) }));
    const freshness = debtorReportFreshness(snapshotRow?.updatedAt ?? null, inactiveOrders, problemCharges, now);
    const snap = (snapshotRow?.value as Record<string, DebtorSnapshotEntry> | null) ?? {};
    const dismissedRow = await db.keyValue.findUnique({ where: { key: 'cardcom_debtors_dismissed' } });
    const buckets = partitionDebtors(snap, (dismissedRow?.value as DismissedDebtors | null) ?? {});

    return { problemCharges, inactiveOrders: detailedOrders, ...buckets, freshness, snapshotUpdatedAt: snapshotRow?.updatedAt ?? null };
}
