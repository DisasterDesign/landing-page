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
  partnerId?: string | null;
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

/**
 * What a partner may SEE: their own leads, plus the open pool.
 *
 * An unclaimed lead is visible to every partner so anyone can pick it up.
 * `eligibleSellerId` used to gate this, which made the pool private to one
 * routed seller — every unclaimed lead pointed at Degaron, so Elbaz joined
 * and saw an empty screen. Routing is still recorded (it is the "suggested
 * partner" signal in the timeline), it just no longer decides visibility.
 *
 * Seeing is not touching: `assertSellerOwnsLead` still requires ownership for
 * every mutation, and claiming is the only way to acquire it.
 */
export function sellerLeadScope(
  sellerId: string,
): Prisma.ContactSubmissionWhereInput {
  return {
    OR: [{ ownerId: sellerId }, { ownerId: null }],
    migrationReviewRequired: false,
  };
}

/**
 * What a partner may see. Four disjoint reasons, in the order they matter:
 *  1. they are the current owner of the linked lead (operational);
 *  2. `partnerId` — the explicit "this partner generated the deal";
 *  3. `creditedSellerId` — the legacy mirror, for rows written before
 *     partnerId existed and for the commission history they still key on;
 *  4. they typed a row that nobody is attributed to at all.
 *
 * Branch 4 is the ONLY surviving use of `createdBy`, it is visibility-only,
 * and it is gated on the row having no attribution whatsoever — a deal that
 * belongs to a partner must never be visible to whoever merely typed it in.
 * Elad creates agreements on partners' behalf, which is exactly why crediting
 * the typist misattributed 8 of 14 signed deals.
 */
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
          },
        },
      },
      { partnerId: sellerId },
      { creditedSellerId: sellerId },
      { partnerId: null, creditedSellerId: null, createdBy: sellerId },
    ],
  };
}

export function canSellerReadAgreement(
  sellerId: string,
  agreement: SellerReadableAgreement,
): boolean {
  const partnerId = agreement.partnerId ?? null;
  return (
    canSellerManageAgreement(sellerId, agreement) ||
    partnerId === sellerId ||
    agreement.creditedSellerId === sellerId ||
    (partnerId === null &&
      agreement.creditedSellerId === null &&
      agreement.createdBy === sellerId)
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

export function sellerAgreementOperationalFields(
  canManage: boolean,
  fields: { phone: string; signToken: string },
): Partial<{ phone: string; signToken: string }> {
  return canManage
    ? { phone: fields.phone, signToken: fields.signToken }
    : {};
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
  // Must mirror sellerLeadScope exactly. If the two drift, a partner sees a
  // lead in the list and gets a 403 opening it, or the reverse.
  return lead.ownerId === sellerId || lead.ownerId === null;
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
