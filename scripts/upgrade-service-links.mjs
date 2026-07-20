// Upgrade blog-post internal links from the generic /services hub to the
// SPECIFIC service page matching each post's keyword cluster. Anchor text is
// untouched; only the href gets sharper. Idempotent.
//   node scripts/upgrade-service-links.mjs          # dry run
//   APPLY=1 node scripts/upgrade-service-links.mjs  # write
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const apply = process.env.APPLY === "1";

const STORE = "/services/בניית-חנות-אינטרנטית";
const BUSINESS = "/services/בניית-אתר-לעסק";
const GENERAL = "/services/בניית-אתרים";
const CUSTOM = "/services/פיתוח-אתרים-בהתאמה-אישית";

function clusterOf(kw, slug) {
  const s = `${kw ?? ""} ${slug}`;
  if (/API|בהתאמה איש/.test(s) && /API|מערכת/.test(s)) return CUSTOM;
  if (/חנות|סליק|צ׳קאאוט|שופיפיי|עגל|מוצר|משלוח|החזרות|קניות|מכירות|ecommerce/.test(s)) return STORE;
  if (/אתר ל|לעסק|תדמית|מרפא|קליניק|רואה|מאמן|נדל|כושר|צלם|אדריכל|גן ילדים/.test(s)) return BUSINESS;
  return GENERAL;
}

const posts = await p.blogPost.findMany({
  where: { OR: [{ published: true }, { status: "SCHEDULED" }] },
  select: { id: true, slug: true, targetKeyword: true, content: true },
});

let upgraded = 0, skipped = 0;
for (const post of posts) {
  const target = clusterOf(post.targetKeyword, post.slug);
  const c = post.content || "";
  if (c.includes(target)) { skipped++; continue; } // already specific
  // Two generic forms exist in content: relative (from the linker) and the
  // absolute site URL (from original generation). Upgrade whichever is there.
  let next = null;
  if (c.includes('href="/services"')) {
    next = c.replace('href="/services"', `href="${target}"`);
  } else if (c.includes('href="https://www.fuzionwebz.com/services"')) {
    next = c.replace('href="https://www.fuzionwebz.com/services"', `href="${target}"`);
  }
  if (!next) { skipped++; continue; }
  console.log(`  ${post.slug} -> ${target.replace("/services/", "")}`);
  upgraded++;
  if (apply) await p.blogPost.update({ where: { id: post.id }, data: { content: next } });
}
console.log(`\n${apply ? "APPLIED" : "DRY RUN"} — upgraded: ${upgraded}, skipped: ${skipped}`);
await p.$disconnect();
