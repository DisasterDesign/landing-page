import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDiscoveryQueries,
  createCoverageKey,
  normalizeTerritoryText,
  validateTerritoryProposal,
} from "./territory";

const validStreetProposal = {
  displayName: "רחוב רוטשילד",
  city: "ראשון לציון",
  kind: "STREET" as const,
  searchQueries: [
    "עסקים ברחוב רוטשילד ראשון לציון",
    "עסקים ברחובות הסמוכים לרוטשילד ראשון לציון",
  ],
  rationale: "רחוב מסחרי תחום עם תמהיל של עסקים מקומיים",
  independentBusinessRationale: "רוב בתי העסק פונים לרחוב ונראים מקומיים ועצמאיים",
  riskFactors: ["יש לסנן מספר סניפי רשת"],
  expectedBusinessTypes: ["מספרות", "חנויות מקומיות"],
  confidence: 0.85,
};

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

test("territory validation accepts a bounded commercial street", () => {
  assert.deepEqual(validateTerritoryProposal(validStreetProposal), { ok: true });
});

test("territory validation rejects malls, generic areas and institutional complexes", () => {
  const rejected = [
    {
      ...validStreetProposal,
      displayName: "דיזנגוף סנטר",
      kind: "COMMERCIAL_CENTER" as const,
      rationale: "קניון גדול עם תנועת מבקרים",
    },
    {
      ...validStreetProposal,
      kind: "AREA" as const,
      displayName: "כל העיר יבנה",
    },
    {
      ...validStreetProposal,
      displayName: "קמפוס בית החולים",
      rationale: "מתחם מוסדי גדול",
    },
  ];

  for (const proposal of rejected) {
    assert.equal(validateTerritoryProposal(proposal).ok, false);
  }
});

test("discovery queries expand only approved seeds through the fixed taxonomy", () => {
  assert.deepEqual(
    buildDiscoveryQueries(["רחוב אחד", "רחוב שני"], ["חנויות", "קליניקות"]),
    [
      "חנויות רחוב אחד",
      "קליניקות רחוב אחד",
      "חנויות רחוב שני",
      "קליניקות רחוב שני",
    ],
  );
});
