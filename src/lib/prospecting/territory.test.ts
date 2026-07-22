import assert from "node:assert/strict";
import test from "node:test";

import { createCoverageKey, normalizeTerritoryText } from "./territory";

test("coverage keys normalize punctuation, whitespace, street abbreviations and city casing", () => {
  const variants = [
    { displayName: "רח׳ דיזנגוף", city: "TEL AVIV", kind: "STREET" as const },
    { displayName: "רחוב   דיזנגוף", city: "tel-aviv", kind: "STREET" as const },
    { displayName: "Dizengoff St.", city: "Tel Aviv", kind: "STREET" as const },
  ];

  assert.equal(createCoverageKey(variants[0]), createCoverageKey(variants[1]));
  assert.notEqual(createCoverageKey(variants[1]), createCoverageKey(variants[2]));
  assert.equal(normalizeTerritoryText("  מרכז—מסחרי, רעננה! "), "מרכז מסחרי רעננה");
});

test("territory kind is part of the stable coverage key", () => {
  const common = { displayName: "דיזנגוף", city: "תל אביב" };
  assert.notEqual(
    createCoverageKey({ ...common, kind: "STREET" }),
    createCoverageKey({ ...common, kind: "AREA" }),
  );
});
