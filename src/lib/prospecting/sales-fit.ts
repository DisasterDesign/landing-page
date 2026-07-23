import type { SalesFitAssessment } from "./types";

export const SALES_FIT_VERSION = 1;
export const MIN_SALES_FIT_CONFIDENCE = 0.8;
export const MIN_OWNER_REACHABILITY_SCORE = 70;

export function isPublishableSalesFit(value: SalesFitAssessment): boolean {
  return (
    value.classification === "INDEPENDENT_LIKELY" &&
    value.confidence >= MIN_SALES_FIT_CONFIDENCE &&
    value.ownerReachabilityScore >= MIN_OWNER_REACHABILITY_SCORE
  );
}
