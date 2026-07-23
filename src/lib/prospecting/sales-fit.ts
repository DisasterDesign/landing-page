import type { SalesFitAssessment } from "./types";

export const SALES_FIT_VERSION = 1;
export const MIN_SALES_FIT_CONFIDENCE = 0.8;
export const MIN_OWNER_REACHABILITY_SCORE = 70;

export const SALES_FIT_DENYLIST_VERSION = 1;

const CHAIN_NAME_TERMS = [
  "ארומה",
  "סופר פארם",
  "רמי לוי",
  "שופרסל",
  "ויקטורי",
  "מקס סטוק",
  "אייבורי",
  "קסטרו",
  "פוקס",
  "פוקס הום",
  "גולף",
  "קפה גרג",
  "קפה לנדוור",
  "מקדונלדס",
] as const;

const CHAIN_NAME_PATTERNS = [
  /\bksp\b/i,
  /\bdomino'?s\b/i,
  /\bpizza\s+hut\b/i,
] as const;

const LARGE_ORGANIZATION_PATTERN =
  /(?:בנק|בית\s+חולים|מרכז\s+רפואי|אוניברסיט|מכללה|עיריית|מועצה\s+מקומית|משרד\s+ממשלתי|חברת\s+חשמל|תאגיד\s+מים|קניון|shopping\s+mall|hospital|university|municipality)/iu;
const UNSUITABLE_CATEGORY_PATTERN =
  /(?:מרכז\s+לוגיסטי|שירות\s+לוגיסטי|מפעל|בית\s+חרושת|מחסן\s+הפצה|logistics?|factory|distribution\s+center)/iu;

function normalizedBusinessText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u0591-\u05c7]/g, "")
    .toLocaleLowerCase("he")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function includesNormalizedTerm(value: string, term: string): boolean {
  return ` ${value} `.includes(` ${term} `);
}

export function detectHardSalesFitExclusion(input: {
  displayName: string;
  category: string | null;
  rating: number | null;
  reviewCount: number | null;
}): SalesFitAssessment | null {
  const normalizedName = normalizedBusinessText(input.displayName);
  const normalizedCategory = normalizedBusinessText(input.category ?? "");
  const combined = `${normalizedName} ${normalizedCategory}`.trim();

  if (
    CHAIN_NAME_TERMS.some((term) => includesNormalizedTerm(normalizedName, term)) ||
    CHAIN_NAME_PATTERNS.some((pattern) => pattern.test(normalizedName))
  ) {
    return {
      classification: "CHAIN_OR_FRANCHISE",
      confidence: 1,
      ownerReachabilityScore: 0,
      reason: "העסק זוהה כרשת או כמותג זכיינות",
      evidence: ["MULTI_LOCATION", "FRANCHISE_LANGUAGE"],
    };
  }
  if (LARGE_ORGANIZATION_PATTERN.test(combined)) {
    return {
      classification: "LARGE_ORGANIZATION",
      confidence: 1,
      ownerReachabilityScore: 0,
      reason: "זהו גוף גדול או מוסדי שאינו מתאים לפנייה ישירה לבעל העסק",
      evidence: ["INSTITUTIONAL_TYPE"],
    };
  }
  if (UNSUITABLE_CATEGORY_PATTERN.test(combined)) {
    return {
      classification: "UNSUITABLE_CATEGORY",
      confidence: 1,
      ownerReachabilityScore: 0,
      reason: "סוג העסק אינו מתאים למסלול מכירה ישיר לבעלים",
      evidence: ["INDUSTRIAL_TYPE"],
    };
  }
  return null;
}

export function isPublishableSalesFit(value: SalesFitAssessment): boolean {
  return (
    value.classification === "INDEPENDENT_LIKELY" &&
    value.confidence >= MIN_SALES_FIT_CONFIDENCE &&
    value.ownerReachabilityScore >= MIN_OWNER_REACHABILITY_SCORE
  );
}
