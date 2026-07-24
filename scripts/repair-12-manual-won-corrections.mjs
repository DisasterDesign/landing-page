/**
 * Repair 12 — manual statistics corrections (Elad, 24.7.2026):
 * two Facebook leads that became paying clients but the lead record
 * does not say so.
 *
 * 1. הלנה לפיד סידלר — lead "Helena" (cmofre4ax0004n2jqxvwpp8ff) is marked
 *    SPAM, yet she signed as a client two days later (Client
 *    cmofv2awb00003qla2yahxqge, 26.4.2026). Correction: SPAM → WON.
 *
 * 2. אייל זכות — no lead exists at all (verified by name / phone / email
 *    sweep), but he entered via Facebook and closed as a client (Client
 *    cmpvf5pgi00003vo9qo0vy62h, 1.6.2026). Correction: reconstruct the
 *    lead as WON, anchored to the client-creation date (the real FB entry
 *    date is unknown — recorded as reconstructed in sourceSnapshot).
 *
 * Consistent with the iron rule (DECISIONS.md 24.7): nothing is deleted;
 * this moves the record TOWARD the truth, with MIGRATED audit events
 * carrying before/after, per the דקל-יהלומי migration-review precedent.
 *
 * Dry-run by default. APPLY=1 to write. Idempotent via event dedupeKeys.
 */
import { PrismaClient } from "@prisma/client";

const APPLY = process.env.APPLY === "1";
const db = new PrismaClient();

const ELAD_USER_ID = "cmnelbdzv00014ic7rvsgc5mt";
const HELENA_LEAD_ID = "cmofre4ax0004n2jqxvwpp8ff";
const HELENA_CLIENT_ID = "cmofv2awb00003qla2yahxqge";
const HELENA_WON_AT = new Date("2026-04-26T14:25:54.348Z");
const EYAL_CLIENT_ID = "cmpvf5pgi00003vo9qo0vy62h";
const EYAL_WON_AT = new Date("2026-06-01T16:24:40.483Z");
const DEDUPE_PREFIX = "manual-stats-correction-2026-07-24";

async function main() {
  console.log(APPLY ? "=== APPLY ===" : "=== DRY RUN (set APPLY=1 to write) ===");

  const helena = await db.contactSubmission.findUnique({
    where: { id: HELENA_LEAD_ID },
    select: { id: true, name: true, stage: true, status: true, wonAt: true, closedAt: true },
  });
  if (!helena) throw new Error("Helena lead not found — aborting");
  console.log("helena before:", JSON.stringify(helena));

  const eyalExisting = await db.contactSubmission.findFirst({
    where: { OR: [{ phone: { contains: "7864572" } }, { email: "eyal.cz1@gmail.com" }] },
    select: { id: true, stage: true },
  });
  console.log("eyal existing lead:", JSON.stringify(eyalExisting));

  if (!APPLY) {
    console.log("\nPlanned:");
    console.log(`1. Helena ${helena.stage} → WON (wonAt/closedAt ${HELENA_WON_AT.toISOString()}), name → הלנה לפיד סידלר, + WON & MIGRATED events`);
    console.log(eyalExisting
      ? `2. Eyal lead already exists (${eyalExisting.id}, ${eyalExisting.stage}) — would only ensure WON`
      : `2. Create reconstructed WON lead for אייל זכות (createdAt/wonAt ${EYAL_WON_AT.toISOString()}) + CREATED & WON & MIGRATED events`);
    return;
  }

  await db.$transaction(async (tx) => {
    // --- Helena: SPAM → WON ---
    if (helena.stage !== "WON") {
      await tx.contactSubmission.update({
        where: { id: HELENA_LEAD_ID },
        data: {
          name: "הלנה לפיד סידלר",
          stage: "WON",
          status: "CLOSED",
          wonAt: HELENA_WON_AT,
          closedAt: HELENA_WON_AT,
          lostAt: null,
          isRead: true,
          migrationReviewRequired: false,
        },
      });
      await tx.leadEvent.createMany({
        data: [
          {
            leadId: HELENA_LEAD_ID,
            type: "WON",
            actorType: "USER",
            actorUserId: ELAD_USER_ID,
            fromStage: helena.stage,
            toStage: "WON",
            occurredAt: HELENA_WON_AT,
            dedupeKey: `${DEDUPE_PREFIX}:helena-won`,
            metadata: {
              action: "MANUAL_STATS_CORRECTION",
              reason:
                "תיקון סטטיסטי ידני (אלעד, 24.7.2026): הליד סומן ספאם בטעות — הלנה נסגרה כלקוחה משלמת יומיים אחרי הפנייה מפייסבוק.",
              clientId: HELENA_CLIENT_ID,
              originalName: helena.name,
            },
          },
          {
            leadId: HELENA_LEAD_ID,
            type: "MIGRATED",
            actorType: "USER",
            actorUserId: ELAD_USER_ID,
            fromStage: helena.stage,
            toStage: "WON",
            occurredAt: new Date(),
            dedupeKey: `${DEDUPE_PREFIX}:helena-audit`,
            metadata: {
              action: "MANUAL_STATS_CORRECTION",
              before: { name: helena.name, stage: helena.stage, status: helena.status },
              after: { name: "הלנה לפיד סידלר", stage: "WON", status: "CLOSED" },
              reason:
                "Matched to Client by exact phone + email (lapidsidler@gmail.com / 0526036361); client created 2026-04-26, two days after the lead.",
            },
          },
        ],
        skipDuplicates: true,
      });
      console.log("helena: updated to WON");
    } else {
      console.log("helena: already WON — skipped");
    }

    // --- Eyal: reconstruct missing lead ---
    if (!eyalExisting) {
      const lead = await tx.contactSubmission.create({
        data: {
          name: "אייל זכות",
          phone: "0507864572",
          email: "eyal.cz1@gmail.com",
          intentLevel: "AD_RESPONSE",
          sourceKey: "meta_lead_ads",
          source: "FACEBOOK",
          acquisitionChannel: "META",
          stage: "WON",
          status: "CLOSED",
          isRead: true,
          wonAt: EYAL_WON_AT,
          closedAt: EYAL_WON_AT,
          createdAt: EYAL_WON_AT,
          migrationReviewRequired: false,
          sourceSnapshot: {
            reconstructed: true,
            reason:
              "שחזור ידני (אלעד, 24.7.2026): הליד המקורי מפייסבוק לא נקלט במערכת; שוחזר לצורכי סטטיסטיקה. התאריך מעוגן ליצירת הלקוח (1.6.2026) — מועד הפנייה המדויק לא ידוע.",
            clientId: EYAL_CLIENT_ID,
          },
        },
        select: { id: true },
      });
      await tx.leadEvent.createMany({
        data: [
          {
            leadId: lead.id,
            type: "CREATED",
            actorType: "USER",
            actorUserId: ELAD_USER_ID,
            toStage: "WON",
            occurredAt: EYAL_WON_AT,
            dedupeKey: `${DEDUPE_PREFIX}:eyal-created`,
            metadata: {
              action: "MANUAL_STATS_CORRECTION",
              reason: "שחזור ליד חסר — נכנס מפייסבוק ונסגר כלקוח; הרשומה המקורית לא נקלטה.",
              clientId: EYAL_CLIENT_ID,
            },
          },
          {
            leadId: lead.id,
            type: "WON",
            actorType: "USER",
            actorUserId: ELAD_USER_ID,
            toStage: "WON",
            occurredAt: EYAL_WON_AT,
            dedupeKey: `${DEDUPE_PREFIX}:eyal-won`,
            metadata: {
              action: "MANUAL_STATS_CORRECTION",
              reason: "נסגר כלקוח משלם (Client cmpvf5pgi00003vo9qo0vy62h, 1.6.2026).",
              clientId: EYAL_CLIENT_ID,
            },
          },
        ],
        skipDuplicates: true,
      });
      console.log("eyal: reconstructed lead", lead.id);
    } else {
      console.log("eyal: lead already exists — skipped creation");
    }
  });

  const wonCount = await db.contactSubmission.count({ where: { stage: "WON" } });
  console.log("WON leads now:", wonCount);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
