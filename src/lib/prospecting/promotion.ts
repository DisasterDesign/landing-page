import { prisma } from "@/lib/prisma";

import { sellerLeadScope } from "@/lib/leads/authorization";
import { LeadDomainError } from "@/lib/leads/errors";

export interface PublishedLeadLookupStore {
  findPublishedLead(
    prospectId: string,
    sellerId: string,
  ): Promise<{ promotedLeadId: string | null } | null>;
}

const prismaPublishedLeadLookupStore: PublishedLeadLookupStore = {
  // Canonical ownership is authoritative; stale Prospect.assignedSellerId
  // must neither block a real reassignment nor grant access after one.
  findPublishedLead: (prospectId, sellerId) =>
    prisma.prospect.findFirst({
      where: {
        id: prospectId,
        promotedLead: { is: sellerLeadScope(sellerId) },
      },
      select: { promotedLeadId: true },
    }),
};

export async function getPublishedLeadForProspect(
  prospectId: string,
  sellerId: string,
  dependencies: { store?: PublishedLeadLookupStore } = {},
): Promise<{ leadId: string }> {
  const store = dependencies.store ?? prismaPublishedLeadLookupStore;
  const prospect = await store.findPublishedLead(prospectId, sellerId);
  if (!prospect?.promotedLeadId) {
    throw new LeadDomainError("NOT_FOUND", "Published lead not found");
  }
  return { leadId: prospect.promotedLeadId };
}
