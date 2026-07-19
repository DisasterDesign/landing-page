// Add missing internal links to blog posts: one contextual link to /services
// (first natural keyword phrase in a plain paragraph) and one to /contact.
// Only touches posts that have NO internal links at all; only linkifies
// EXISTING phrases — never injects new sentences into the content.
//   node scripts/add-internal-links.mjs          # dry run
//   APPLY=1 node scripts/add-internal-links.mjs  # write
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const apply = process.env.APPLY === "1";

const SERVICE_PHRASES = [
  // Longest/most specific first — the anchor should be the richest phrase
  // that actually appears in the text.
  "בניית חנות אינטרנטית", "חנות בהתאמה אישית", "חנות אינטרנטית",
  "בניית חנות", "בניית אתרים", "בניית אתר", "הקמת אתר", "חנות אונליין",
  "אתר תדמית", "דף נחיתה", "אתר מכירות", "אתר משלכם", "החנות שלכם", "החנות שלך",
];
const CONTACT_PHRASES = ["צרו איתנו קשר", "צרו קשר", "לדבר איתנו", "ייעוץ ראשוני", "שיחת ייעוץ"];

// Wrap the first occurrence of any phrase inside a <p>…</p> that has no <a>
// and is not a heading. Returns [newHtml, usedPhrase] or null.
function linkifyFirst(html, phrases, href) {
  const paras = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)];
  for (const m of paras) {
    const inner = m[1];
    if (inner.includes("<a ") || inner.includes("<h")) continue;
    for (const phrase of phrases) {
      const idx = inner.indexOf(phrase);
      if (idx === -1) continue;
      const linked = inner.slice(0, idx) +
        `<a href="${href}">${phrase}</a>` +
        inner.slice(idx + phrase.length);
      return [html.replace(m[0], `<p>${linked}</p>`), phrase];
    }
  }
  return null;
}

const posts = await p.blogPost.findMany({
  where: { OR: [{ published: true }, { status: "SCHEDULED" }] },
  select: { id: true, slug: true, content: true },
});

let touched = 0;
for (const post of posts) {
  let c = post.content || "";
  if (/href="[^"]*\/(contact|services|blog\/)/.test(c)) continue; // already linked

  const notes = [];
  const s = linkifyFirst(c, SERVICE_PHRASES, "/services");
  if (s) { c = s[0]; notes.push(`services←"${s[1]}"`); }
  const k = linkifyFirst(c, CONTACT_PHRASES, "/contact");
  if (k) { c = k[0]; notes.push(`contact←"${k[1]}"`); }

  if (!notes.length) { console.log(`  ✗ ${post.slug}: no natural anchor found — skipped`); continue; }
  touched++;
  console.log(`  ✓ ${post.slug}: ${notes.join(" | ")}`);
  if (apply) await p.blogPost.update({ where: { id: post.id }, data: { content: c } });
}
console.log(`\n${apply ? "APPLIED" : "DRY RUN"} — posts touched: ${touched}`);
await p.$disconnect();
