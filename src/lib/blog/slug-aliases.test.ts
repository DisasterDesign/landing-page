import assert from "node:assert/strict";
import test from "node:test";

import { resolveSlugRedirect } from "./slug-aliases";

/**
 * Three slug generations plus one-off historical URLs that Google still
 * crawls. `oldSlug` remembers one previous generation; `matchLegacySlug`
 * recovers the gen-1 shape heuristically. Anything else — like
 * `35-טפסים-שממירים`, still 404 in Search Console on 10.10.2026 after
 * two months — needs an explicit, stored alias. No guessing: an alias is
 * exact or it is nothing.
 */
const posts = [
  { slug: "טפסים-באתר", oldSlug: "tpsym-btr-7-typym-lytsyrt-tvps-shmmyr", slugAliases: ["35-טפסים-שממירים"] },
  { slug: "העברת-אתר-מוויקס-לאתר-מותאם", oldSlug: "h-brt-tr-mvvyqs", slugAliases: [] },
  { slug: "seo-טכני", oldSlug: null, slugAliases: [] },
];

test("an explicit alias redirects to its post", () => {
  assert.equal(resolveSlugRedirect("35-טפסים-שממירים", posts), "טפסים-באתר");
});

test("oldSlug still redirects", () => {
  assert.equal(resolveSlugRedirect("tpsym-btr-7-typym-lytsyrt-tvps-shmmyr", posts), "טפסים-באתר");
});

test("the gen-1 heuristic still redirects", () => {
  assert.equal(resolveSlugRedirect("העברת-אתר-מוויקס-לאתר-מותאם--שלב-אחר-שלב-ia58-moag02a4", posts), "העברת-אתר-מוויקס-לאתר-מותאם");
});

test("a live slug is not a redirect", () => {
  assert.equal(resolveSlugRedirect("טפסים-באתר", posts), null);
});

test("an unknown slug stays a 404 — never a guess", () => {
  assert.equal(resolveSlugRedirect("35-טפסים-אחרים", posts), null);
  assert.equal(resolveSlugRedirect("מאמר-שלא-קיים", posts), null);
});

test("alias lookup is exact, not prefix", () => {
  assert.equal(resolveSlugRedirect("35-טפסים-שממירים-ועוד", posts), null);
});
