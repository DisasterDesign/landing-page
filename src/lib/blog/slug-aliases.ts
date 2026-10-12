import { matchLegacySlug } from "./legacy-slug";

/**
 * Where a stale /blog/<slug> request should go, or null for a real 404.
 *
 * Three sources, in order of certainty:
 *   1. `slugAliases` — explicit historical URLs recorded on the post. Exact
 *      match only. This is where one-off URLs go (e.g. `35-טפסים-שממירים`,
 *      a title-derived slug from an early pipeline run that neither
 *      `oldSlug` nor the gen-1 heuristic can reach).
 *   2. `oldSlug` — the single previous-generation slug the migration kept.
 *   3. `matchLegacySlug` — the generation-1 shape, derived structurally.
 *
 * Pure so the route's branching is pinned by slug-aliases.test.ts; the page
 * supplies the published posts.
 */
export function resolveSlugRedirect(
  requested: string,
  posts: Array<{ slug: string; oldSlug: string | null; slugAliases: string[] }>,
): string | null {
  if (posts.some((p) => p.slug === requested)) return null;
  const byAlias = posts.find((p) => p.slugAliases.includes(requested));
  if (byAlias) return byAlias.slug;
  const byOld = posts.find((p) => p.oldSlug === requested);
  if (byOld) return byOld.slug;
  return matchLegacySlug(requested, posts.map((p) => p.slug));
}
