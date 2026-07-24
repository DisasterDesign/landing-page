/**
 * Manual curated publish — runs 1+2 (Elad, 24.7.2026):
 * "יש לעדכן מכל הסריקות שנעשו עד עכשיו לרבות יבנה ודיזינגוף... לסנן ולהטמיע
 * במערכת שתהיה מוכנה לעבודה לאיש מכירות. ניתן לעשות ידני הפעם."
 *
 * Takes the vetted selection (Claude-vetted + adversarially verified,
 * businesses from the recovered runs-1+2 archive) and replays a full engine
 * publish so the seller queue actually shows the leads — sellerIntentWhere
 * requires prospect→batch(sellerId, supersededAt:null), so bare leads are
 * invisible to the seller. Structure created: ProspectingCycle (rev 2 of
 * week 19.7) + APPROVED TerritoryProposal + WeeklyProspectBatch + Prospect
 * rows, then the canonical publishProspectAsLead per business (lead +
 * PUBLISHED event + prospect linkage), then the standard seller notification.
 *
 * Phones are NOT stored on leads — the projection live-enriches from Google
 * Places at view time (phoneSource: "GOOGLE"), same as engine publishes.
 *
 * Inputs:
 *   SELECTION_PATH — JSON [{placeId, displayName, openingAngle, reason}]
 *   (archive fields come from the recovered archive JSON)
 *
 * Dry-run by default. APPLY=1 to write. Idempotent: cycle/batch looked up
 * by (weekStart, revision); publishProspectAsLead short-circuits on
 * promotedLeadId; prospect creation skips existing placeIds.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { publishProspectAsLead } from "@/lib/prospecting/publisher";
import { createNotification } from "@/lib/notifications";

const APPLY = process.env.APPLY === "1";
const prisma = new PrismaClient();

const DEGARON_ID = "cmqmntkoh0000mxw9fo5rnq8b";
const ELAD_ID = "cmnelbdzv00014ic7rvsgc5mt";
const WEEK_START = new Date("2026-07-19T00:00:00.000Z");
const REVISION = 2;
const TERRITORY = "קיורציה ידנית — דיזנגוף ת\"א + שדרות דואני יבנה (ריצות 1+2)";

const ARCHIVE_PATH = `${homedir()}/Documents/fuzion-recovery-2026-07-23/prospecting-runs-1-2-recovered-from-dump.json`;
const SELECTION_PATH = process.env.SELECTION_PATH;
if (!SELECTION_PATH) throw new Error("SELECTION_PATH is required");

interface Selected {
  placeId: string;
  displayName: string;
  openingAngle: string;
  reason: string;
}

/** Archive values came from a pg_dump COPY — arrays are Postgres literals
 *  like `{"a","b"}` (or `{}`), not JSON. */
function pgNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pgTextArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value !== "string" || !value.startsWith("{")) return [];
  const inner = value.slice(1, -1);
  if (!inner) return [];
  const items: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (inQuotes) {
      if (ch === "\\") {
        current += inner[i + 1] ?? "";
        i += 1;
      } else if (ch === '"') inQuotes = false;
      else current += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      items.push(current);
      current = "";
    } else current += ch;
  }
  if (current) items.push(current);
  return items.filter(Boolean);
}

async function main() {
  const selection = JSON.parse(readFileSync(SELECTION_PATH, "utf8")) as Selected[];
  const archive = JSON.parse(readFileSync(ARCHIVE_PATH, "utf8")) as {
    prospects: Array<Record<string, unknown>>;
  };
  const archiveByPlace = new Map(
    archive.prospects.map((p) => [p.placeId as string, p]),
  );
  console.log(APPLY ? "=== APPLY ===" : "=== DRY RUN (APPLY=1 to write) ===");
  console.log(`selection: ${selection.length} businesses`);

  const missing = selection.filter((s) => !archiveByPlace.has(s.placeId));
  if (missing.length > 0) {
    throw new Error(`selection placeIds missing from archive: ${missing.map((m) => m.displayName).join(", ")}`);
  }
  for (const s of selection) {
    const a = archiveByPlace.get(s.placeId)!;
    console.log(
      ` - ${s.displayName} | ${a.websiteStatus} | quality=${a.qualityScore ?? "null→0"} | ${String(s.reason).slice(0, 60)}…`,
    );
  }
  if (!APPLY) return;

  const publishedAt = new Date();

  // Cycle revision 2 for the current prospecting week (revision 1 is the
  // cancelled auto-proposal). Idempotent lookups by the unique pairs.
  const cycle =
    (await prisma.prospectingCycle.findUnique({
      where: { weekStart_revision: { weekStart: WEEK_START, revision: REVISION } },
    })) ??
    (await prisma.prospectingCycle.create({
      data: {
        weekStart: WEEK_START,
        revision: REVISION,
        status: "PUBLISHED",
        targetCount: selection.length,
        assignedSellerId: DEGARON_ID,
        approvedAt: publishedAt,
        publishedAt,
      },
    }));

  const coverageKey = createHash("sha256")
    .update("manual-curation-runs-1-2-2026-07-24")
    .digest("hex");
  const proposal = await prisma.territoryProposal.findFirst({
    where: { cycleId: cycle.id, coverageKey },
  });
  if (!proposal) {
    await prisma.territoryProposal.create({
      data: {
        cycleId: cycle.id,
        displayName: TERRITORY,
        city: "יבנה + תל אביב",
        kind: "AREA",
        searchQuery: "manual-curation-runs-1-2",
        searchQueries: ["manual-curation-runs-1-2"],
        coverageKey,
        rationale:
          "קיורציה ידנית של הסריקות הקיימות (דיזנגוף סנטר 22.7 + שדרות דואני יבנה 23.7) לפי הנחיית אלעד מ-24.7: כל מועמד נבדק פרטנית (עצמאות, טלפון, סטטוס תפעולי חי, חולשת אתר) ואומת אדברסרית לפני פרסום. האוטומציה המלאה חוזרת בעוד שבועיים.",
        independentBusinessRationale:
          "כל עסק נבדק פרטנית מול דוקטרינת העצמאות — רשתות/זכיינויות/יחידות קניון נפסלו.",
        expectedBusinessTypes: ["מגוון — ראה לידים"],
        confidence: 1,
        status: "APPROVED",
        approvedById: ELAD_ID,
        approvedAt: publishedAt,
      },
    });
  }

  const batch =
    (await prisma.weeklyProspectBatch.findUnique({ where: { cycleId: cycle.id } })) ??
    (await prisma.weeklyProspectBatch.create({
      data: {
        cycleId: cycle.id,
        weekStart: WEEK_START,
        revision: REVISION,
        sellerId: DEGARON_ID,
        publishedAt,
      },
    }));

  let created = 0;
  const failures: string[] = [];
  for (const s of selection) {
    const a = archiveByPlace.get(s.placeId)!;
    const scoringVersion = pgNumber(a.scoringVersion) ?? 1;
    const archivedAngles = pgTextArray(a.callAngles);
    // The vetting opening angle leads; archived engine angles follow.
    // Snapshot schema allows at most 3 call angles.
    const callAngles = [s.openingAngle, ...archivedAngles.filter((t) => t !== s.openingAngle)].slice(0, 3);
    const prospect =
      (await prisma.prospect.findUnique({ where: { placeId: s.placeId } })) ??
      (await prisma.prospect.create({
        data: {
          placeId: s.placeId,
          cycleId: cycle.id,
          status: "READY",
          websiteStatus: (a.websiteStatus as never) ?? "UNKNOWN",
          auditedDomain: (a.auditedDomain as string | null) ?? null,
          businessShape: (a.businessShape as string | null) ?? null,
          businessShapeVersion: pgNumber(a.businessShapeVersion),
          // publishProspectAsLead requires 0-4; unscored candidates were
          // individually vetted as weak/no-website — hard-zero band.
          qualityScore: pgNumber(a.qualityScore) ?? 0,
          rawQualityScore: pgNumber(a.rawQualityScore),
          scoringVersion,
          opportunitySummary:
            (a.opportunitySummary as string | null) ?? s.reason,
          callAngles,
          salesFitClassification: (a.salesFitClassification as never) ?? null,
          salesFitConfidence: pgNumber(a.salesFitConfidence),
          ownerReachabilityScore: pgNumber(a.ownerReachabilityScore),
          salesFitReason: (a.salesFitReason as string | null) ?? s.reason,
        },
      }));

    try {
      const result = await prisma.$transaction((transaction) =>
        publishProspectAsLead(transaction, {
          prospect: {
            id: prospect.id,
            placeId: s.placeId,
            promotedLeadId: prospect.promotedLeadId,
            websiteStatus: prospect.websiteStatus,
            auditedDomain: prospect.auditedDomain,
            businessShape: prospect.businessShape,
            businessShapeVersion: prospect.businessShapeVersion,
            qualityScore: prospect.qualityScore ?? 0,
            scoringVersion: prospect.scoringVersion,
            opportunitySummary: prospect.opportunitySummary,
            // Recomputed (≤3, vetting angle first) — a prospect row from a
            // previous partial run may carry more than the snapshot allows.
            callAngles,
          },
          displayName: s.displayName,
          territory: TERRITORY,
          cycleId: cycle.id,
          batchId: batch.id,
          weekStart: WEEK_START,
          sellerId: DEGARON_ID,
          publishedAt,
        }),
      );
      if (result.created) created += 1;
      console.log(`${result.created ? "created" : "existed"}: ${s.displayName} → lead ${result.leadId}`);
    } catch (error) {
      failures.push(s.displayName);
      console.error(`FAILED: ${s.displayName} —`, error instanceof Error ? error.message : error);
    }
  }

  await createNotification({
    recipientId: DEGARON_ID,
    type: "PROSPECTING_BATCH_READY",
    title: "רשימת לידים קרים חדשה מוכנה",
    body: `${selection.length} עסקים נבדקו ופורסמו לעבודה — ${TERRITORY}`,
    url: "/seller/leads",
    dedupeKey: `prospecting-batch:${cycle.id}:${DEGARON_ID}`,
  });

  console.log(`done: ${created} new leads, cycle ${cycle.id}, batch ${batch.id}`);
  if (failures.length > 0) {
    console.error(`failures (${failures.length}): ${failures.join(", ")}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
