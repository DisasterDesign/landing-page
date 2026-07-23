import type {
  LeadIntentLevel,
  LeadStage,
  Prisma,
  Role,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { LeadDomainError } from "./errors";
import type { AuthenticatedLeadActor } from "./types";

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

interface SellerAgreementLead extends CommercialLead {
  ownerId: string | null;
}

interface SellerReadableAgreement {
  creditedSellerId: string | null;
  createdBy: string;
  lead: SellerAgreementLead | null;
}

interface SellerManageableAgreement {
  lead: SellerAgreementLead | null;
}

interface LeadReadRoleStore {
  user: {
    findUnique(input: {
      where: { id: string };
      select: { role: true };
    }): Promise<{ role: Role } | null>;
  };
}

export async function requirePersistedLeadReadRole(
  userId: string,
  allowedRoles: readonly ("ADMIN" | "SELLER")[],
  dependencies: { db?: LeadReadRoleStore } = {},
): Promise<"ADMIN" | "SELLER"> {
  const db = dependencies.db ?? prisma;
  const persisted = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (
    !persisted ||
    (persisted.role !== "ADMIN" && persisted.role !== "SELLER") ||
    !allowedRoles.includes(persisted.role)
  ) {
    throw new LeadDomainError(
      "FORBIDDEN",
      "Current user role is not authorized to read leads",
    );
  }
  return persisted.role;
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

export function sellerAgreementScope(
  sellerId: string,
): Prisma.AgreementWhereInput {
  return {
    OR: [
      {
        lead: {
          is: {
            ownerId: sellerId,
            migrationReviewRequired: false,
            intentLevel: { not: null },
            sourceKey: { not: null },
            stage: { not: null },
          },
        },
      },
      { creditedSellerId: sellerId },
      { creditedSellerId: null, createdBy: sellerId },
    ],
  };
}

export function canSellerReadAgreement(
  sellerId: string,
  agreement: SellerReadableAgreement,
): boolean {
  return (
    canSellerManageAgreement(sellerId, agreement) ||
    agreement.creditedSellerId === sellerId ||
    (agreement.creditedSellerId === null && agreement.createdBy === sellerId)
  );
}

export function canSellerManageAgreement(
  sellerId: string,
  agreement: SellerManageableAgreement,
): boolean {
  const lead = agreement.lead;
  return Boolean(
    lead &&
      lead.ownerId === sellerId &&
      !lead.migrationReviewRequired &&
      lead.intentLevel !== null &&
      lead.sourceKey !== null &&
      lead.stage !== null,
  );
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

export async function assertActorCanMutateLead(
  transaction: Pick<Prisma.TransactionClient, "user">,
  actor: AuthenticatedLeadActor,
  lead: CommercialLead & { ownerId: string | null },
): Promise<Role> {
  assertCommercialLeadReady(lead);
  const persisted = await transaction.user.findUnique({
    where: { id: actor.userId },
    select: { role: true },
  });
  if (!persisted || persisted.role !== actor.role) {
    throw new LeadDomainError(
      "FORBIDDEN",
      "Authenticated lead actor no longer has the required role",
    );
  }
  if (persisted.role === "SELLER") {
    assertSellerOwnsLead(actor.userId, lead);
  } else if (persisted.role !== "ADMIN") {
    throw new LeadDomainError("FORBIDDEN", "Lead mutation is not authorized");
  }
  return persisted.role;
}
