/**
 * Migrate unreadable vowel-stripped transliteration slugs (tr-ldryklym-...)
 * to readable Hebrew slugs derived from the post title.
 *
 * - Targets: PUBLISHED posts whose slug is latin with vowel-ratio < 0.2, and
 *   ALL SCHEDULED posts (safe — never published).
 * - Sets oldSlug = current slug so the existing 308-redirect keeps ranking
 *   equity for published posts (blog/[slug] falls back to oldSlug lookup).
 * - Rewrites in-content /blog/<old-slug> links across every post.
 *
 *   npx tsx scripts/migrate-blog-slugs.ts          # dry run (prints mapping)
 *   APPLY=1 npx tsx scripts/migrate-blog-slugs.ts  # write changes
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.env.APPLY === "1";

const vowelRatio = (s: string) => {
  const letters = s.replace(/[^a-z]/gi, "");
  if (!letters) return 1; // Hebrew slug → not transliterated
  return (letters.match(/[aeiou]/gi) ?? []).length / letters.length;
};

// Title → readable Hebrew slug. Prefer the pre-dash headline when it's
// substantial; otherwise take up to 6 cleaned words of the full title.
function slugFromTitle(title: string): string {
  const clean = (s: string) =>
    s
      .replace(/[״"׳'’‘]/g, "")
      .replace(/[—–-]/g, " ")
      .replace(/[?!,.:;()\[\]%]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const [head] = title.split("—");
  const headWords = clean(head).split(" ").filter(Boolean);
  const fullWords = clean(title).split(" ").filter(Boolean);
  const words = headWords.length >= 2 ? headWords : fullWords.slice(0, 6);
  // Never end a slug on a dangling connective ("...משפיעות-על").
  const STOP = new Set(["על", "של", "וכל", "כל", "בעל", "הן", "הם", "או", "עם", "גם", "איך", "למה", "את", "בלי", "אל", "מה"]);
  while (words.length > 2 && STOP.has(words[words.length - 1])) words.pop();
  return words.join("-");
}

async function main() {
  const posts = await prisma.blogPost.findMany({
    where: { status: { in: ["PUBLISHED", "SCHEDULED"] } },
    select: { id: true, slug: true, oldSlug: true, title: true, status: true },
  });

  const taken = new Set(posts.map((p) => p.slug));
  const targets = posts.filter(
    (p) =>
      p.status === "SCHEDULED" ||
      (!/[א-ת]/.test(p.slug) && vowelRatio(p.slug) < 0.2)
  );

  console.log(`targets: ${targets.length} of ${posts.length} (published+scheduled)`);

  const mapping: { id: string; from: string; to: string; status: string }[] = [];
  for (const p of targets) {
    let candidate = slugFromTitle(p.title);
    // Collision handling: suffix -2, -3...
    let final = candidate;
    let n = 2;
    while (taken.has(final)) {
      final = `${candidate}-${n++}`;
    }
    taken.delete(p.slug);
    taken.add(final);
    mapping.push({ id: p.id, from: p.slug, to: final, status: p.status });
  }

  for (const m of mapping) {
    console.log(`${m.status === "PUBLISHED" ? "PUB" : "SCH"}  ${m.from}\n  →  ${m.to}`);
  }

  if (!APPLY) {
    console.log("\nDRY RUN — set APPLY=1 to write.");
    return;
  }

  // 1. Update slugs (+ oldSlug for the 308 redirect)
  for (const m of mapping) {
    await prisma.blogPost.update({
      where: { id: m.id },
      data: { slug: m.to, oldSlug: m.from },
    });
  }
  console.log(`\n${mapping.length} slugs updated.`);

  // 2. Rewrite in-content internal links across ALL posts
  const all = await prisma.blogPost.findMany({
    select: { id: true, content: true },
  });
  let rewritten = 0;
  for (const post of all) {
    let c = post.content;
    for (const m of mapping) {
      c = c.split(`/blog/${m.from}`).join(`/blog/${m.to}`);
    }
    if (c !== post.content) {
      await prisma.blogPost.update({ where: { id: post.id }, data: { content: c } });
      rewritten++;
    }
  }
  console.log(`${rewritten} posts had in-content links rewritten.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
