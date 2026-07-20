/**
 * יצירה + תזמון של 30 מאמרי איקומרס מבוססי-מקורות.
 *
 * מקור: קבצי JSON שנכתבו ע"י workflow הכתיבה (blog-write/out).
 * כל מאמר: content markdown → HTML (markdown-it, html:true), נוצר כ-READY,
 * ואז מתוזמן ראשון+רביעי מ-19.7.2026, 07:00 UTC (10:00 ישראל), כל 3-4 ימים.
 * ה-cron `/api/cron/blog-publish` הופך SCHEDULED→PUBLISHED בזמן.
 *
 * dry-run:  node scripts/create-schedule-ecommerce-posts.mjs
 * החלה:     APPLY=1 node scripts/create-schedule-ecommerce-posts.mjs
 */
import { PrismaClient } from "@prisma/client";
import MarkdownIt from "markdown-it";
import fs from "fs";
import path from "path";
import {
  nextSunday, addDays, setHours, setMinutes, setSeconds, setMilliseconds, startOfDay,
} from "date-fns";

const APPLY = process.env.APPLY === "1";
const BLOG_DIR = "/private/tmp/claude-501/-Users-eladnissim-Desktop-Projects-Fuzion-fuzion-webz/74ad655c-a017-475a-bac9-b0ff666ed178/scratchpad/blog-write";
const OUT_DIR = `${BLOG_DIR}/out`;
const TOPICS_FILE = `${BLOG_DIR}/topics.json`;
const AUTHOR_ID = "cmnelbdzv00014ic7rvsgc5mt"; // אלעד (ADMIN), כמו שאר הפוסטים
const CATEGORY = "מסחר אלקטרוני";
const TAGS = ["איקומרס", "חנות אונליין"];

// n -> targetKeyword, from the keyword-research topic plan
const topicKw = {};
try {
  const t = JSON.parse(fs.readFileSync(TOPICS_FILE, "utf8"));
  const arr = Array.isArray(t) ? t : (t.topics || []);
  for (const x of arr) if (x.n != null) topicKw[x.n] = x.targetKeyword || null;
} catch { /* topics optional */ }

const md = new MarkdownIt({ html: true, linkify: false, breaks: false });
const prisma = new PrismaClient();

function stripLeadingH1(markdown) {
  // הכותרת מוצגת בנפרד (post.title) — מסירים H1 מוביל כדי לא לכפול
  return markdown.trim().replace(/^#\s+[^\n]*\r?\n+/, "");
}

// Safety net: no em/en-dash may reach the DB (the #1 AI tell). Replace
// " — " separators (common in the מקורות list) with ", " and any stray
// em/en-dash with a comma. Fixes are done properly in the articles too.
function stripEmDash(text) {
  return text.replace(/\s+[—–]\s+/g, ", ").replace(/[—–]/g, ",");
}

function nextSundayAt7UTC(from) {
  const base = startOfDay(from);
  const sunday = from.getUTCDay() === 0 ? base : nextSunday(base);
  return setMilliseconds(setSeconds(setMinutes(setHours(sunday, 7), 0), 0), 0);
}

const HEBREW_DAY = { 0: "ראשון", 3: "רביעי" };

// ---- load articles ----
const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".json"));
const arts = files
  .map((f) => {
    const a = JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), "utf8"));
    a.__file = f;
    // Use the Hebrew topic slug (filename) as the canonical DB slug — some
    // writers returned Latin/transliterated slugs in a.slug; the filename is
    // always the readable Hebrew topic slug.
    a.__slug = path.basename(f, ".json");
    return a;
  })
  .filter((a) => a && a.__slug && a.content && a.title)
  .sort((x, y) => (x.n ?? 999) - (y.n ?? 999));

console.log(`נמצאו ${arts.length} מאמרים ב-OUT (${files.length} קבצים).`);
if (arts.length === 0) { await prisma.$disconnect(); process.exit(1); }

// ---- guard: slug collisions with existing posts ----
const existing = await prisma.blogPost.findMany({
  where: { slug: { in: arts.map((a) => a.__slug) } },
  select: { slug: true, status: true },
});
const existingSlugs = new Set(existing.map((e) => e.slug));
if (existingSlugs.size > 0) {
  console.log(`\n⚠️  ${existingSlugs.size} slugs כבר קיימים ב-DB, ידולגו:`);
  existing.forEach((e) => console.log(`   - ${e.slug} (${e.status})`));
}
const toCreate = arts.filter((a) => !existingSlugs.has(a.__slug));

// ---- schedule plan ----
const firstSunday = nextSundayAt7UTC(new Date());
let cursor = firstSunday;
const plan = toCreate.map((a, i) => {
  const scheduledAt = new Date(cursor);
  cursor = addDays(cursor, i % 2 === 0 ? 3 : 4); // ראשון→+3(רביעי)→+4(ראשון)
  return { a, scheduledAt };
});

console.log(`\nתוכנית תזמון (${plan.length} מאמרים, ראשון+רביעי 07:00 UTC):`);
console.log("  #   n   תאריך        יום     מילים  cit  slug");
console.log("  --  --  -----------  ------  -----  ---  ----");
for (let i = 0; i < plan.length; i++) {
  const { a, scheduledAt } = plan[i];
  const d = scheduledAt.toISOString().slice(0, 10);
  const day = (HEBREW_DAY[scheduledAt.getUTCDay()] ?? "?").padEnd(6, " ");
  const wc = String(a.wordCount ?? "?").padStart(5);
  const cc = String((a.citations || []).length).padStart(3);
  console.log(`  ${String(i + 1).padStart(2)}  ${String(a.n ?? "?").padStart(2)}  ${d}  ${day}  ${wc}  ${cc}  ${a.__slug}`);
}
console.log(`\nטווח: ${plan[0]?.scheduledAt.toISOString().slice(0,10)} → ${plan[plan.length-1]?.scheduledAt.toISOString().slice(0,10)}`);

if (!APPLY) {
  console.log("\n[DRY RUN] לא נכתב כלום. הרץ עם APPLY=1 כדי ליצור ולתזמן.");
  await prisma.$disconnect();
  process.exit(0);
}

// ---- apply ----
const now = new Date();
let created = 0;
for (const { a, scheduledAt } of plan) {
  const html = md.render(stripEmDash(stripLeadingH1(a.content)));
  await prisma.blogPost.create({
    data: {
      title: stripEmDash(a.title),
      slug: a.__slug,
      excerpt: a.excerpt ? stripEmDash(a.excerpt) : null,
      content: html,
      category: CATEGORY,
      tags: TAGS,
      metaTitle: a.metaTitle ? stripEmDash(a.metaTitle) : null,
      metaDesc: a.metaDesc ? stripEmDash(a.metaDesc) : null,
      targetKeyword: topicKw[a.n] || a.targetKeyword || null,
      keywords: (topicKw[a.n] || a.targetKeyword) ? [topicKw[a.n] || a.targetKeyword] : [],
      status: "SCHEDULED",
      scheduledAt,
      published: false,
      lastReviewedAt: now,
      reviewNotes: "מבוסס-מקורות + אימות אדוורסרי (deep-research workflow, יולי 2026)",
      authorId: AUTHOR_ID,
    },
  });
  created++;
  console.log(`  ✓ ${a.__slug}  →  ${scheduledAt.toISOString().slice(0,10)}`);
}

console.log(`\nבוצע: נוצרו ותוזמנו ${created} מאמרים.`);
await prisma.$disconnect();
