/**
 * Recovers the current slug for a generation-1 blog URL.
 *
 * The blog went through three slug generations. `BlogPost.oldSlug` is a single
 * column, so the second migration overwrote what the first had stored, and the
 * only generation Google actually indexed — Hebrew title, `--`, subtitle, then
 * a random `-xxxx-moagNNNN` suffix — stopped resolving and started 404ing.
 * Search Console had seven of them on 2026-08-09 and would have collected the
 * rest as it re-crawled the ~22 posts with a transliterated `oldSlug`.
 *
 * The hashes are unrecoverable, but they don't need to be: the current slug is
 * always a leading segment of the legacy one once `--` is folded back to `-`.
 * So match on the longest current slug that the request begins with, at a
 * segment boundary.
 *
 * Returns null when nothing matches, so the caller still 404s rather than
 * guessing. Also returns null for an exact current slug — that is a live URL
 * and belongs to the normal lookup, not to this fallback.
 */
export function matchLegacySlug(
  requested: string,
  currentSlugs: string[],
): string | null {
  // Generation-1 used `--` between the title and the subtitle where the current
  // slug uses a single `-`, so fold it before comparing.
  const normalized = requested.replace(/-{2,}/g, "-");

  let best: string | null = null;
  for (const slug of currentSlugs) {
    // Strictly longer: an equal-length match is the live slug itself.
    if (normalized.length <= slug.length) continue;
    if (!normalized.startsWith(slug)) continue;
    // Require a segment boundary, so `אחסון-אתרים` cannot swallow a request
    // that merely shares its opening characters mid-word.
    if (normalized[slug.length] !== "-") continue;
    if (best === null || slug.length > best.length) best = slug;
  }
  return best;
}
