/**
 * One-shot backfill for FB leads stored with name="ליד מפייסבוק".
 *
 * Older `mapLeadFieldsToContact` missed Hebrew underscore-separated
 * field keys ("שם_מלא", "מספר_טלפון", 'דוא"ל'), so those values
 * landed in the `message` body as "key: value" lines while the
 * structured columns stayed empty / placeholder.
 *
 * This script re-parses each stale row's `message` and fills the
 * `name` / `email` / `phone` columns from it.
 *
 * Usage:
 *   node scripts/backfill-fb-lead-names.mjs          # dry-run (default)
 *   node scripts/backfill-fb-lead-names.mjs --apply  # actually write
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const normalize = (s) => s.replace(/_/g, " ").trim();
const NAME_KEYS = new Set(["שם מלא", "שם", "שם פרטי", "שם משפחה"]);
const FIRST_KEYS = new Set(["שם פרטי"]);
const LAST_KEYS = new Set(["שם משפחה"]);
const PHONE_KEYS = new Set(["מספר טלפון", "טלפון", "phone", "phone number"]);
const EMAIL_KEYS = new Set(['דוא"ל', "דואל", "email", "כתובת מייל", "מייל"]);

const isCompanyKey = (k) => /חברה|עסק|company|business/i.test(k);

function parseBody(message) {
  const out = {
    name: null,
    firstName: null,
    lastName: null,
    phone: null,
    email: null,
    leftover: [],
  };
  for (const rawLine of message.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      out.leftover.push(line);
      continue;
    }
    const keyRaw = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (!value) continue;
    const key = normalize(keyRaw);
    if (isCompanyKey(key)) {
      out.leftover.push(line);
      continue;
    }
    if (FIRST_KEYS.has(key) && !out.firstName) {
      out.firstName = value;
    } else if (LAST_KEYS.has(key) && !out.lastName) {
      out.lastName = value;
    } else if (NAME_KEYS.has(key) && !out.name) {
      out.name = value;
    } else if (PHONE_KEYS.has(key) && !out.phone) {
      out.phone = value;
    } else if (EMAIL_KEYS.has(key) && !out.email) {
      out.email = value;
    } else {
      out.leftover.push(line);
    }
  }
  const finalName =
    out.name ||
    [out.firstName, out.lastName].filter(Boolean).join(" ") ||
    null;
  return {
    name: finalName,
    phone: out.phone,
    email: out.email,
    leftover: out.leftover.join("\n"),
  };
}

const stale = await prisma.contactSubmission.findMany({
  where: { name: "ליד מפייסבוק" },
  select: {
    id: true,
    name: true,
    email: true,
    phone: true,
    message: true,
  },
});

console.log(`Found ${stale.length} stale rows.\n`);
console.log(APPLY ? "MODE: APPLY (will write to DB)" : "MODE: DRY-RUN (no writes)");
console.log("─".repeat(70));

let updated = 0;
let unchanged = 0;
const previews = [];

for (const lead of stale) {
  const parsed = parseBody(lead.message);
  if (!parsed.name && !parsed.email && !parsed.phone) {
    unchanged++;
    continue;
  }
  // Build the patch — only touch a column when we have a better value
  // than what's already there, except for `name` where the existing
  // value is always the stale literal we're trying to replace.
  const patch = {};
  if (parsed.name) patch.name = parsed.name;
  if (!lead.email && parsed.email) patch.email = parsed.email;
  if (!lead.phone && parsed.phone) patch.phone = parsed.phone;
  // Compact the message body by removing the lines we just promoted
  // into structured columns. Keep whatever was leftover (typically the
  // service-category line like "אתר מכירות אונליין") so the admin
  // panel still shows what the customer asked about.
  if (parsed.leftover && parsed.leftover !== lead.message) {
    patch.message = parsed.leftover;
  }

  previews.push({
    id: lead.id,
    name: patch.name ?? "(unchanged)",
    email: patch.email ?? lead.email ?? "(empty)",
    phone: patch.phone ?? lead.phone ?? "(empty)",
    messagePreview:
      (patch.message ?? lead.message).slice(0, 60).replace(/\n/g, " · ") +
      ((patch.message ?? lead.message).length > 60 ? "…" : ""),
  });

  if (APPLY) {
    await prisma.contactSubmission.update({
      where: { id: lead.id },
      data: patch,
    });
  }
  updated++;
}

for (const p of previews.slice(0, 10)) {
  console.log(
    `[${p.id}] ${p.name.padEnd(28)} | ${p.email.padEnd(28)} | ${p.phone.padEnd(16)} | ${p.messagePreview}`
  );
}
if (previews.length > 10) {
  console.log(`… +${previews.length - 10} more rows`);
}

console.log("─".repeat(70));
console.log(`Would update: ${updated}`);
console.log(`No match in message body (left as-is): ${unchanged}`);
if (!APPLY) {
  console.log(`\nDry-run only. Re-run with --apply to write.`);
}

await prisma.$disconnect();
