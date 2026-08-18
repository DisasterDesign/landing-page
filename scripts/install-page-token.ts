/**
 * Install a Facebook Page access token that was issued OUTSIDE our OAuth flow.
 *
 * Context (18.8.2026): our Meta app died with Elad's deleted profile, and the
 * replacement app may be created and owned by someone else (Barak / Roy's
 * business portfolio). If we are handed a ready-made Page token instead of an
 * App ID + Secret, the normal /admin/integrations/facebook flow cannot run —
 * it needs an app of our own. This writes the same FacebookIntegration row
 * that flow would have written, so the polling sync can pick it up.
 *
 * What this buys and what it does not:
 *   ✅ /api/cron/facebook-sync polls the lead form and imports leads.
 *   ❌ No real-time webhook. /api/webhooks/facebook verifies Meta's
 *      X-Hub-Signature-256 against META_APP_SECRET and returns 403 without it,
 *      so without the app secret leads arrive on the cron cadence, not in
 *      seconds.
 *
 * Before running, the token MUST be proven to read lead data — not just form
 * metadata. Listing forms works with narrow scopes; reading `field_data` is
 * separately gated. This script performs that check and refuses to install a
 * token that cannot actually retrieve a lead.
 *
 * Dry run:  PAGE_TOKEN=… npx tsx scripts/install-page-token.ts
 * Apply:    PAGE_TOKEN=… APPLY=1 npx tsx scripts/install-page-token.ts
 *
 * Optional: PAGE_ID (default 482956251578120 — Fuzion by Roy Yehezkel)
 *           FORM_ID (default 1505628047948105 — the cron's default form)
 */
import { PrismaClient } from "@prisma/client";

import { encrypt } from "../src/lib/crypto";
import { getFormLeads } from "../src/lib/facebook";

const prisma = new PrismaClient();
const APPLY = process.env.APPLY === "1";

const PAGE_TOKEN = process.env.PAGE_TOKEN ?? "";
const PAGE_ID = process.env.PAGE_ID ?? "482956251578120";
const FORM_ID = process.env.FORM_ID ?? "1505628047948105";
const PAGE_NAME = process.env.PAGE_NAME ?? "Fuzion by Roy Yehezkel";

async function main() {
  if (!PAGE_TOKEN) {
    throw new Error("PAGE_TOKEN is required. Never paste it into a file or a chat — pass it as an env var for this one command.");
  }
  if (!process.env.OAUTH_ENCRYPTION_KEY) {
    throw new Error("OAUTH_ENCRYPTION_KEY is not set locally — the token is stored encrypted at rest and cannot be written without it.");
  }

  const owner = await prisma.user.findFirst({
    where: { isOwner: true },
    select: { id: true, name: true },
  });
  if (!owner) throw new Error("No isOwner user found.");

  // The decisive check. A token scoped only to list pages/forms will happily
  // return form metadata and then fail on the leads themselves, which is the
  // failure that would otherwise surface silently, in production, with real
  // leads going missing.
  console.log(`Verifying the token can actually READ LEAD DATA from form ${FORM_ID}…`);
  let sample: Awaited<ReturnType<typeof getFormLeads>> = [];
  try {
    sample = await getFormLeads(FORM_ID, PAGE_TOKEN, 1);
  } catch (e) {
    console.error("\n✖ The token cannot read leads from this form.");
    console.error(String(e).slice(0, 400));
    console.error(
      "\nThis usually means the token is missing lead-retrieval rights, or was issued by\n" +
        "someone without the ADVERTISE task on the Page. Listing forms is NOT proof —\n" +
        "ask for a token that returns field_data on this endpoint, then re-run.",
    );
    process.exitCode = 1;
    return;
  }

  const withData = sample.filter((l) => Array.isArray(l.field_data) && l.field_data.length > 0);
  console.log(`  → returned ${sample.length} lead(s), ${withData.length} with field data.`);
  if (sample.length > 0 && withData.length === 0) {
    console.error(
      "\n✖ Leads came back but every field_data was empty — the token is being stripped of\n" +
        "the personal data we need. Refusing to install; this would import blank leads.",
    );
    process.exitCode = 1;
    return;
  }
  if (sample.length === 0) {
    console.log(
      "  ⚠ The form returned no leads at all. That may simply mean it is empty right now,\n" +
        "    but it is NOT proof the token works. Submit a test lead and re-run before relying on this.",
    );
  }

  const existing = await prisma.facebookIntegration.findUnique({
    where: { pageId: PAGE_ID },
    select: { id: true, pageName: true, createdAt: true },
  });

  console.log(`\n${APPLY ? "APPLY" : "DRY RUN"} — install page token`);
  console.log(`  page:  ${PAGE_ID} (${PAGE_NAME})`);
  console.log(`  form:  ${FORM_ID}`);
  console.log(`  owner: ${owner.name} (${owner.id})`);
  console.log(`  token: <${PAGE_TOKEN.length} chars, stored AES-256-GCM encrypted>`);
  console.log(`  row:   ${existing ? `exists since ${existing.createdAt.toISOString().slice(0, 10)} → will be updated` : "new"}`);
  console.log(
    `  note:  subscribedAt stays null — we did not subscribe this Page to the leadgen\n` +
      `         webhook (that needs our own app). Leads arrive via the polling cron.`,
  );

  if (!APPLY) {
    console.log("\nDry run only. Re-run with APPLY=1 to write.");
    return;
  }

  const row = await prisma.facebookIntegration.upsert({
    where: { pageId: PAGE_ID },
    create: {
      userId: owner.id,
      pageId: PAGE_ID,
      pageName: PAGE_NAME,
      pageAccessToken: encrypt(PAGE_TOKEN),
    },
    update: {
      pageName: PAGE_NAME,
      pageAccessToken: encrypt(PAGE_TOKEN),
    },
    select: { id: true, pageId: true, pageName: true },
  });

  console.log(`\nWrote integration ${row.id} → ${row.pageName} (${row.pageId})`);
  console.log("Next: confirm /api/cron/facebook-sync is scheduled, then submit a test lead.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
