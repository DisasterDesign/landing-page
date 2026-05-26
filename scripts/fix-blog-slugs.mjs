#!/usr/bin/env node
/**
 * One-shot migration: rebuild dirty blog slugs and keep the old ones around
 * for 301 redirects.
 *
 *   Dirty pattern: ends with `-mo[a-z0-9]+-[a-z0-9]+` (the Date.now()+random
 *   suffix the old generateSlug produced) OR starts with `%D7` (URL-encoded
 *   Hebrew, in case any leaked in encoded).
 *
 * For each match:
 *   1. Build a fresh slug from `title` via the same transliteration logic
 *      the upload pipeline now uses.
 *   2. Disambiguate against existing slugs with `-2`, `-3`, …
 *   3. Store the previous slug in `BlogPost.oldSlug` so the storefront can
 *      302→301-redirect stale incoming URLs (`/blog/<oldSlug>` → new slug).
 *   4. Update `slug`.
 *
 *   Default mode is DRY-RUN — pass `--apply` to actually write.
 *
 *   Usage:
 *     node --env-file=.env scripts/fix-blog-slugs.mjs            # preview
 *     node --env-file=.env scripts/fix-blog-slugs.mjs --apply    # commit
 */
import { PrismaClient } from '@prisma/client';
import { slugify as transliterate } from 'transliteration';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const DIRTY_SUFFIX = /-mo[a-z0-9]+-[a-z0-9]+$/;
const URL_ENCODED = /^%[0-9A-F]{2}/i;

function baseSlugFromTitle(title) {
  const cleaned = title
    .replace(/[–——]/g, ' ')
    .replace(/[״׳"'`]/g, '')
    .replace(/[?!:;,.()\[\]{}<>|/\\]/g, '')
    .trim();

  let slug = transliterate(cleaned, { lowercase: true, separator: '-' });
  slug = slug.replace(/-+/g, '-').replace(/^-+|-+$/g, '');

  if (slug.length > 60) {
    slug = slug.slice(0, 60);
    const lastDash = slug.lastIndexOf('-');
    if (lastDash > 30) slug = slug.slice(0, lastDash);
    slug = slug.replace(/-+$/g, '');
  }
  return slug || 'untitled';
}

/**
 * Uniqueness against the live `slug` column + a session-local Set so two
 * posts that share a title don't both claim the same base in a single run.
 */
async function uniqueSlug(base, excludeId, taken) {
  let candidate = base;
  let n = 1;
  while (n < 50) {
    if (!taken.has(candidate)) {
      const existing = await prisma.blogPost.findUnique({ where: { slug: candidate } });
      if (!existing || existing.id === excludeId) {
        taken.add(candidate);
        return candidate;
      }
    }
    n += 1;
    candidate = `${base}-${n}`;
  }
  throw new Error(`Could not find a unique slug for "${base}" after 50 attempts`);
}

function isDirty(slug) {
  return DIRTY_SUFFIX.test(slug) || URL_ENCODED.test(slug);
}

async function main() {
  console.log(APPLY ? '🚀 APPLY mode — writing to DB.' : '👀 DRY-RUN — pass --apply to commit.');
  console.log();

  const all = await prisma.blogPost.findMany({
    select: { id: true, title: true, slug: true, oldSlug: true },
    orderBy: { createdAt: 'asc' },
  });

  const dirty = all.filter((p) => isDirty(p.slug));
  const taken = new Set(all.filter((p) => !isDirty(p.slug)).map((p) => p.slug));

  console.log(`total posts: ${all.length}`);
  console.log(`clean (skip): ${all.length - dirty.length}`);
  console.log(`dirty (migrate): ${dirty.length}`);
  console.log();

  let updated = 0;
  let unchanged = 0;
  let conflicts = 0;

  for (const post of dirty) {
    const base = baseSlugFromTitle(post.title);
    let newSlug;
    try {
      newSlug = await uniqueSlug(base, post.id, taken);
    } catch (e) {
      console.error(`  ✗ ${post.id}: ${e.message}`);
      conflicts += 1;
      continue;
    }

    if (newSlug === post.slug) {
      console.log(`  =  ${post.slug.slice(0, 70)}  (already canonical)`);
      unchanged += 1;
      continue;
    }

    console.log(`  →  ${newSlug}`);
    console.log(`     ← ${post.slug.slice(0, 70)}`);

    if (APPLY) {
      await prisma.blogPost.update({
        where: { id: post.id },
        data: {
          slug: newSlug,
          // Don't overwrite an existing oldSlug — preserves history across
          // multiple runs.
          oldSlug: post.oldSlug ?? post.slug,
        },
      });
    }
    updated += 1;
  }

  console.log();
  console.log(`✓ ${updated} updated, ${unchanged} unchanged, ${conflicts} conflicts.`);
  if (!APPLY) {
    console.log('Dry-run only. Re-run with --apply to commit.');
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
