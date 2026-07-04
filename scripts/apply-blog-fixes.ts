/**
 * Apply verified Hebrew copy-edits to published blog posts.
 *
 * Two problems are fixed in one pass:
 *  1. Machine-translation Hebrew errors (the corrected text from the audit).
 *  2. 17 posts were stored as raw Markdown but the blog renders content via
 *     dangerouslySetInnerHTML, so their "## " headings / tables showed
 *     literally on the page. Any post that still contains Markdown heading
 *     syntax is converted to HTML with markdown-it (html:true so existing
 *     inline HTML and fenced code samples pass through correctly).
 *
 * Guard: compares the TEXT (tags stripped) length to the live DB post so a
 * wholesale rewrite or lost sections can't slip through, and refuses any
 * result that still contains a raw "## " heading.
 *
 *   OUT_DIR=/path npx tsx scripts/apply-blog-fixes.ts
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import MarkdownIt from "markdown-it";

const prisma = new PrismaClient();
const md = new MarkdownIt({ html: true, linkify: false, breaks: false });

const OUT_DIR = process.env.OUT_DIR;
if (!OUT_DIR) {
  console.error("OUT_DIR env required");
  process.exit(1);
}

interface Fixed {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  metaTitle: string | null;
  metaDesc: string | null;
}

const hasMarkdownHeading = (s: string) => /(?:^|\n)#{1,4}\s/.test(s);
const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function main() {
  const files = readdirSync(OUT_DIR!).filter((f) => f.endsWith(".json"));
  let applied = 0;
  let skipped = 0;
  const converted: string[] = [];

  for (const file of files) {
    const fixed = JSON.parse(readFileSync(join(OUT_DIR!, file), "utf8")) as Fixed;

    const original = await prisma.blogPost.findUnique({
      where: { id: fixed.id },
      select: { slug: true, content: true },
    });
    if (!original) {
      console.error(`✗ ${fixed.slug}: id not found — skipping`);
      skipped++;
      continue;
    }
    if (original.slug !== fixed.slug) {
      console.error(`✗ ${fixed.slug}: slug mismatch (db: ${original.slug}) — skipping`);
      skipped++;
      continue;
    }

    // Convert to HTML only when the fixed content still carries Markdown
    // headings; pure-HTML posts pass through untouched.
    const needsConversion = hasMarkdownHeading(fixed.content);
    const finalContent = needsConversion ? md.render(fixed.content) : fixed.content;

    // Guard 1: no raw heading marker may survive into stored HTML.
    if (/(?:^|\n)#{1,4}\s/.test(finalContent) || finalContent.includes("\n## ")) {
      console.error(`✗ ${fixed.slug}: raw "##" still present after conversion — skipping`);
      skipped++;
      continue;
    }
    // Guard 2: text content must be preserved (no wholesale rewrite / lost body).
    const origText = stripTags(original.content).length;
    const newText = stripTags(finalContent).length;
    const textRatio = newText / Math.max(1, origText);
    if (textRatio < 0.85 || textRatio > 1.2) {
      console.error(`✗ ${fixed.slug}: text length x${textRatio.toFixed(2)} out of range — skipping`);
      skipped++;
      continue;
    }
    if (newText < 400) {
      console.error(`✗ ${fixed.slug}: suspiciously short (${newText} chars) — skipping`);
      skipped++;
      continue;
    }

    await prisma.blogPost.update({
      where: { id: fixed.id },
      data: {
        title: fixed.title,
        excerpt: fixed.excerpt,
        content: finalContent,
        metaTitle: fixed.metaTitle,
        metaDesc: fixed.metaDesc,
        lastReviewedAt: new Date(),
        reviewNotes: "תיקון עברית (תרגום מכונה) + המרת Markdown→HTML — ביקורת סוכנים 4.7.2026",
      },
    });
    console.log(`✓ ${fixed.slug}${needsConversion ? " [md→html]" : ""} (text x${textRatio.toFixed(2)})`);
    if (needsConversion) converted.push(fixed.slug);
    applied++;
  }
  console.log(`\nDone: ${applied} applied (${converted.length} md→html converted), ${skipped} skipped.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
