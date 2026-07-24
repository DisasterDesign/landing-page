/**
 * Seed ProspectSuppression with every placeId from prospecting runs 1+2
 * (Dizengoff Center 22.7 + Sderot Duani Yavne 23.7), so run 3's discovery
 * and publish never re-surface those businesses (Elad, 24.7.2026:
 * "כבר הרצנו 2 — לסנן אותם קודם כל").
 *
 * Source: the recovered archive at
 * ~/Documents/fuzion-recovery-2026-07-23/prospecting-runs-1-2-recovered-from-dump.json
 * (the original archive was overwritten by a second run of the reset script;
 * rebuilt from the 23.7 pg_dump).
 *
 * placeId-only rows: phone/domain hashes need PROSPECTING_HASH_SECRET which
 * is intentionally not available locally. placeId is the primary exclusion
 * key in both discovery (worker) and publish (selectPublishableProspects).
 *
 * Dry-run by default. APPLY=1 to write. Idempotent (skipDuplicates on the
 * unique placeId).
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { PrismaClient } from "@prisma/client";

const APPLY = process.env.APPLY === "1";
const ELAD_USER_ID = "cmnelbdzv00014ic7rvsgc5mt";
const ARCHIVE =
  process.env.ARCHIVE_PATH ??
  `${homedir()}/Documents/fuzion-recovery-2026-07-23/prospecting-runs-1-2-recovered-from-dump.json`;

const db = new PrismaClient();

async function main() {
  const archive = JSON.parse(readFileSync(ARCHIVE, "utf8"));
  const placeIds = archive.suppressionSeed?.placeIds ?? [];
  if (placeIds.length === 0) throw new Error("Archive has no placeIds — aborting");
  console.log(APPLY ? "=== APPLY ===" : "=== DRY RUN (APPLY=1 to write) ===");
  console.log(`archive placeIds: ${placeIds.length}`);
  const existing = await db.prospectSuppression.count();
  console.log(`suppression rows before: ${existing}`);
  if (!APPLY) return;

  const result = await db.prospectSuppression.createMany({
    data: placeIds.map((placeId) => ({
      placeId,
      reason:
        "ריצות 1+2 (דיזנגוף סנטר + שדרות דואני יבנה, 22-23.7.2026) — סינון ידני לפני ריצה 3 לפי הנחיית אלעד",
      createdById: ELAD_USER_ID,
    })),
    skipDuplicates: true,
  });
  console.log(`inserted: ${result.count}`);
  console.log(`suppression rows after: ${await db.prospectSuppression.count()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
