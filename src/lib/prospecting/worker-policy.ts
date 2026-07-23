import { isPublishableSalesFit } from "./sales-fit";
import type { SalesFitAssessment } from "./types";

export type ProspectSalesFitDecision =
  | {
      action: "CONTINUE";
      status?: never;
      assessment: SalesFitAssessment;
    }
  | {
      action: "REJECT";
      status: "INVALID" | "FAILED_REVIEW";
      assessment: SalesFitAssessment;
    };

const missingAssessment: SalesFitAssessment = {
  classification: "UNCERTAIN",
  confidence: 0,
  ownerReachabilityScore: 0,
  reason: "לא התקבל מספיק מידע ציבורי כדי לאשר התאמה למכירה",
  evidence: ["INSUFFICIENT_EVIDENCE"],
};

export function decideProspectSalesFit(input: {
  hardExclusion: SalesFitAssessment | null;
  assessment?: SalesFitAssessment | null;
}): ProspectSalesFitDecision {
  if (input.hardExclusion) {
    return {
      action: "REJECT",
      status: "INVALID",
      assessment: input.hardExclusion,
    };
  }

  const assessment = input.assessment ?? missingAssessment;
  if (isPublishableSalesFit(assessment)) {
    return { action: "CONTINUE", assessment };
  }

  return {
    action: "REJECT",
    status:
      assessment.classification === "INDEPENDENT_LIKELY" ||
      assessment.classification === "UNCERTAIN"
        ? "FAILED_REVIEW"
        : "INVALID",
    assessment,
  };
}
