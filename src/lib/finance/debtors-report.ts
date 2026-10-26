import { prisma } from '@/lib/prisma';
import type { PrismaClient } from '@prisma/client';
import type { Viewer } from '@/lib/auth/viewer';
import type { DebtorSnapshotEntry } from '@/lib/cardcom-debtors';
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

    const snap = (snapshotRow?.value as Record<string, DebtorSnapshotEntry> | null) ?? {};
    const dismissedRow = await db.keyValue.findUnique({ where: { key: 'cardcom_debtors_dismissed' } });
    const buckets = partitionDebtors(snap, (dismissedRow?.value as DismissedDebtors | null) ?? {});

    return { problemCharges, inactiveOrders, ...buckets, snapshotUpdatedAt: snapshotRow?.updatedAt ?? null };
}
