/**
 * Audit every live standing order against Cardcom: which document type does
 * it actually issue?
 *
 * Background (28.7.2026): `RecurringPayments.DocTypeToCreate` was hardcoded
 * to 3 — "קבלה מלכ״ר", a zero-VAT receipt — in every standing order this
 * codebase ever created. 18 charges went out that way. The code now sends 1
 * (חשבונית מס/קבלה), but that only affects orders created from now on; the
 * live ones still carry 3 inside Cardcom and must be corrected there.
 *
 * READ ONLY. It asks Cardcom for the current state of each order and prints
 * the ones that still need fixing, so nothing is corrected blind and nothing
 * is missed. It never writes to Cardcom or to our DB — updating a live order
 * can move its billing date or its amount, and that is not a risk worth
 * taking on real collections.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/audit-recurring-document-type.ts
 */
import { PrismaClient } from "@prisma/client";

import { getRecurringPaymentState } from "@/lib/cardcom";

const prisma = new PrismaClient();

const DOC_TYPES: Record<number, string> = {
  1: "חשבונית מס/קבלה ✓",
  3: "קבלה מלכ״ר (ללא מע״מ) ✗",
};

async function main() {
  const agreements = await prisma.agreement.findMany({
    where: { cardcomRecurringId: { not: null } },
    select: {
      id: true,
      customerName: true,
      businessName: true,
      monthlyPrice: true,
      vatExempt: true,
      cardcomRecurringId: true,
      cardcomAccountId: true,
    },
    orderBy: { createdAt: "asc" },
  });
  console.log(`הסכמים עם הוראת קבע: ${agreements.length}\n`);

  const needsFix: string[] = [];
  let unknown = 0;

  for (const agreement of agreements) {
    const label = agreement.businessName || agreement.customerName;
    if (!agreement.cardcomAccountId) {
      console.log(`?  ${label} — אין AccountId שמור, לא ניתן לשאול את קארדקום`);
      unknown += 1;
      continue;
    }
    try {
      const states = await getRecurringPaymentState(agreement.cardcomAccountId);
      const state = states.find(
        (candidate) => candidate.RecurringId === agreement.cardcomRecurringId,
      );
      if (!state) {
        console.log(`?  ${label} — הוראה ${agreement.cardcomRecurringId} לא נמצאה בחשבון ${agreement.cardcomAccountId}`);
        unknown += 1;
        continue;
      }
      const docType = state.DocTypeToCreate;
      const verdict = docType ? DOC_TYPES[docType] ?? `סוג ${docType}` : "לא דווח";
      const active = state.IsActive ? "פעילה" : "כבויה";
      console.log(
        `${docType === 1 ? "✓" : "✗"}  ${label.padEnd(34)} | הוראה ${String(state.RecurringId).padEnd(6)} | ${active.padEnd(6)} | ${verdict} | חיוב הבא ${state.NextDateToBill?.slice(0, 10) ?? "—"}`,
      );
      if (state.IsActive && docType !== 1) {
        needsFix.push(`${label} — הוראה ${state.RecurringId}`);
      }
    } catch (error) {
      console.log(`!  ${label} — שגיאה: ${error instanceof Error ? error.message : error}`);
      unknown += 1;
    }
  }

  console.log(`\n=== סיכום ===`);
  console.log(`דורשות תיקון בדשבורד קארדקום: ${needsFix.length}`);
  for (const item of needsFix) console.log(`  • ${item}`);
  if (unknown > 0) {
    console.log(`לא ניתן היה לאמת: ${unknown} — לבדוק ידנית, הן עלולות להיות פגומות גם כן.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
