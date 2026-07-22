import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export interface PromotionLeadData {
  prospectId: string;
  externalLeadId: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string;
  message: string;
  sellerId: string;
  acquisitionChannel: "GOOGLE_PROSPECTING";
  notes: Array<{ authorId: string; body: string }>;
}

interface PromotionProspect {
  id: string;
  placeId: string;
  status: string;
  promotedLeadId: string | null;
  opportunitySummary: string | null;
  interactions: Array<{
    outcome: string;
    note: string | null;
    createdAt: Date;
    authorId: string;
  }>;
}

export interface PromotionStore {
  findOwnedProspect(prospectId: string, sellerId: string): Promise<PromotionProspect | null>;
  findLeadByExternalId(externalLeadId: string): Promise<{ id: string } | null>;
  createPromotion(data: PromotionLeadData): Promise<{ id: string }>;
  linkExistingLead(prospectId: string, leadId: string): Promise<void>;
}

const prismaPromotionStore: PromotionStore = {
  findOwnedProspect: (prospectId, sellerId) =>
    prisma.prospect.findFirst({
      where: { id: prospectId, assignedSellerId: sellerId },
      select: {
        id: true,
        placeId: true,
        status: true,
        promotedLeadId: true,
        opportunitySummary: true,
        interactions: {
          orderBy: { createdAt: "asc" },
          select: { outcome: true, note: true, createdAt: true, authorId: true },
        },
      },
    }),
  findLeadByExternalId: (externalLeadId) =>
    prisma.contactSubmission.findUnique({
      where: { externalLeadId },
      select: { id: true },
    }),
  createPromotion: (data) =>
    prisma.$transaction(async (transaction) => {
      const lead = await transaction.contactSubmission.create({
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          company: data.company,
          message: data.message,
          service: "בניית אתר ושיפור נוכחות דיגיטלית",
          tags: ["ליד קר", "Google Maps"],
          source: "GOOGLE_PROSPECTING",
          acquisitionChannel: data.acquisitionChannel,
          externalLeadId: data.externalLeadId,
          status: "IN_PROGRESS",
          isRead: true,
          assignees: { connect: { id: data.sellerId } },
          notes: {
            create: data.notes.map((note) => ({
              body: note.body,
              author: { connect: { id: note.authorId } },
            })),
          },
        },
        select: { id: true },
      });
      await transaction.prospect.update({
        where: { id: data.prospectId },
        data: { promotedLeadId: lead.id },
      });
      return lead;
    }),
  linkExistingLead: async (prospectId, leadId) => {
    await prisma.prospect.update({
      where: { id: prospectId },
      data: { promotedLeadId: leadId },
    });
  },
};

export async function promoteProspect(
  input: {
    prospectId: string;
    sellerId: string;
    live: { displayName: string; phone: string | null };
    email?: string | null;
  },
  dependencies: { store?: PromotionStore } = {},
): Promise<{ leadId: string; created: boolean }> {
  const store = dependencies.store ?? prismaPromotionStore;
  const prospect = await store.findOwnedProspect(input.prospectId, input.sellerId);
  if (!prospect) throw new Error("Prospect not found or not owned by seller");
  if (prospect.status !== "QUALIFIED") {
    throw new Error("Only an interested prospect can be promoted");
  }
  if (prospect.promotedLeadId) {
    return { leadId: prospect.promotedLeadId, created: false };
  }

  const externalLeadId = `gplaces:${prospect.placeId}`;
  const existing = await store.findLeadByExternalId(externalLeadId);
  if (existing) {
    await store.linkExistingLead(prospect.id, existing.id);
    return { leadId: existing.id, created: false };
  }

  const data: PromotionLeadData = {
    prospectId: prospect.id,
    externalLeadId,
    name: input.live.displayName,
    email: input.email ?? null,
    phone: input.live.phone,
    company: input.live.displayName,
    message: prospect.opportunitySummary ?? "ליד קר שאישר עניין בשיחת מכירה",
    sellerId: input.sellerId,
    acquisitionChannel: "GOOGLE_PROSPECTING",
    notes: prospect.interactions.map((interaction) => ({
      authorId: interaction.authorId,
      body: [
        `שיחת prospecting · ${interaction.outcome} · ${interaction.createdAt.toLocaleString("he-IL")}`,
        interaction.note,
      ]
        .filter(Boolean)
        .join("\n"),
    })),
  };

  try {
    const lead = await store.createPromotion(data);
    return { leadId: lead.id, created: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await store.findLeadByExternalId(externalLeadId);
      if (raced) {
        await store.linkExistingLead(prospect.id, raced.id);
        return { leadId: raced.id, created: false };
      }
    }
    throw error;
  }
}
