import assert from "node:assert/strict";
import test from "node:test";

import { matchLegacySlug } from "./legacy-slug";

/**
 * The seven URLs Google actually has in its index for fuzionwebz.com, taken
 * verbatim from the Search Console page-indexing report on 2026-08-09. Two are
 * reported as 404, one as "duplicate, Google chose a different canonical", and
 * four are still classified as redirects from a June crawl but return 404 today.
 * All seven are generation-1 slugs: the current slug, then `--`, then the rest
 * of the title, then a random `-xxxx-moagNNNN` suffix.
 */
const CURRENT_SLUGS = [
  "טפסים-באתר",
  "העברת-אתר-מוויקס-לאתר-מותאם",
  "איך-לבדוק-את-הביצועים-של-האתר-שלכם",
  "איך-לבחור-חברת-פיתוח-אתרים",
  "תעודת-ssl",
  "דומיין-ואחסון-לאתר",
  "מה-זה-api-ולמה-זה-חשוב-לאתר-העסקי-שלכם",
  "seo-טכני",
  "אחסון-אתרים",
];

const INDEXED_GEN1: Array<[string, string]> = [
  ["טפסים-באתר--7-טיפים-ליצירת-טופס-שממיר-ufb2-moag01xz", "טפסים-באתר"],
  [
    "העברת-אתר-מוויקס-לאתר-מותאם--שלב-אחר-שלב-ia58-moag02a4",
    "העברת-אתר-מוויקס-לאתר-מותאם",
  ],
  [
    "איך-לבדוק-את-הביצועים-של-האתר-שלכם--כלים-חינמיים-dc7f-moag02ga",
    "איך-לבדוק-את-הביצועים-של-האתר-שלכם",
  ],
  [
    "איך-לבחור-חברת-פיתוח-אתרים--8-שאלות-שחייבים-לשאול-om8e-moag0108",
    "איך-לבחור-חברת-פיתוח-אתרים",
  ],
  ["תעודת-ssl--למה-חובה-ואיך-מתקינים-gdp6-moag01lr", "תעודת-ssl"],
  ["דומיין-ואחסון-לאתר--מדריך-למתחילים-yr9c-moag01fl", "דומיין-ואחסון-לאתר"],
  [
    "מה-זה-api--ולמה-זה-חשוב-לאתר-העסקי-שלכם-xe35-moag01rv",
    "מה-זה-api-ולמה-זה-חשוב-לאתר-העסקי-שלכם",
  ],
];

for (const [requested, expected] of INDEXED_GEN1) {
  test(`recovers the indexed generation-1 slug: ${expected}`, () => {
    assert.equal(matchLegacySlug(requested, CURRENT_SLUGS), expected);
  });
}

test("prefers the longest matching slug when one slug prefixes another", () => {
  // `seo-טכני` and `seo-טכני-מתקדם` both prefix the request; the longer one
  // is the real post, and picking the shorter would redirect readers to the
  // wrong article rather than 404 — a silently wrong answer.
  const slugs = ["seo-טכני", "seo-טכני-מתקדם"];
  assert.equal(
    matchLegacySlug("seo-טכני-מתקדם--צקליסט-מלא-ab12-moag0199", slugs),
    "seo-טכני-מתקדם",
  );
});

test("returns null when nothing matches, so the route still 404s", () => {
  assert.equal(matchLegacySlug("מאמר-שלא-קיים-מעולם", CURRENT_SLUGS), null);
});

test("does not match on a partial word boundary", () => {
  // `אחסון-אתרים` must not swallow a request for a different post that merely
  // starts with the same characters mid-word.
  assert.equal(matchLegacySlug("אחסון-אתריםX-בענן", CURRENT_SLUGS), null);
});

test("ignores an exact current slug — that path is handled before this one", () => {
  assert.equal(matchLegacySlug("טפסים-באתר", CURRENT_SLUGS), null);
});

test("handles a URL-decoded request with no legacy suffix at all", () => {
  // A `--` split with no random suffix still resolves; the suffix is not the
  // thing that identifies a legacy URL, the `--` separator is.
  assert.equal(
    matchLegacySlug("תעודת-ssl--למה-חובה-ואיך-מתקינים", CURRENT_SLUGS),
    "תעודת-ssl",
  );
});
