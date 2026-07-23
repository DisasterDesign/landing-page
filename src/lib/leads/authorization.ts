import type { LeadIntentLevel, LeadStage, Prisma } from "@prisma/client";

import { LeadDomainError } from "./errors";

interface SellerReadableLead {
  ownerId: string | null;
  eligibleSellerId: string | null;
  migrationReviewRequired: boolean;
  intentLevel: LeadIntentLevel | null;
  sourceKey: string | null;
  stage: LeadStage | null;
}

interface CommercialLead {
  migrationReviewRequired: boolean;
  intentLevel: LeadIntentLevel | null;
  sourceKey: string | null;
  stage: LeadStage | null;
}

export function sellerLeadScope(
  sellerId: string,
): Prisma.ContactSubmissionWhereInput {
  return {
    OR: [{ ownerId: sellerId }, { ownerId: null, eligibleSellerId: sellerId }],
    migrationReviewRequired: false,
    intentLevel: { not: null },
    sourceKey: { not: null },
    stage: { not: null },
  };
}

export function canSellerReadLead(
  sellerId: string,
  lead: SellerReadableLead,
): boolean {
  if (
    lead.migrationReviewRequired ||
    lead.intentLevel === null ||
    lead.sourceKey === null ||
    lead.stage === null
  ) {
    return false;
  }
  return (
    lead.ownerId === sellerId ||
    (lead.ownerId === null && lead.eligibleSellerId === sellerId)
  );
}

export function assertSellerOwnsLead(
  sellerId: string,
  lead: CommercialLead & { ownerId: string | null },
): void {
  assertCommercialLeadReady(lead);
  if (lead.ownerId !== sellerId) {
    throw new LeadDomainError("FORBIDDEN", "Lead is not owned by this seller");
  }
}

export function assertCommercialLeadReady(
  lead: CommercialLead,
): asserts lead is {
  migrationReviewRequired: false;
  intentLevel: LeadIntentLevel;
  sourceKey: string;
  stage: LeadStage;
} {
  if (
    lead.migrationReviewRequired ||
    lead.intentLevel === null ||
    lead.sourceKey === null ||
    lead.stage === null
  ) {
    throw new LeadDomainError("FORBIDDEN", "Lead requires admin review");
  }
}
