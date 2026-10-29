import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LeadDomainError } from "@/lib/leads/errors";

/** Hiding the entire mixed lead prevents amounts, milestones and notes from leaking. */
export function financeLeadScope(viewer?: {isOwner: boolean}): Prisma.ContactSubmissionWhereInput {
  return viewer?.isOwner === true ? {} : { agreements: { none: { financeBook: { not: "SHARED" } } } };
}

type LeadAccessDatabase = Pick<typeof prisma, "user" | "contactSubmission">;
export async function financeLeadViewer(userId: string, dependencies: {db?: LeadAccessDatabase} = {}) {
  const db = dependencies.db ?? prisma;
  const user = await db.user.findUnique({where: {id: userId}, select: {role: true, isOwner: true}});
  if (!user || (user.role !== "ADMIN" && user.role !== "SELLER")) throw new LeadDomainError("FORBIDDEN", "Current user role is not authorized to access leads");
  return {isOwner: user.isOwner};
}

export async function requireFinanceLeadAccess(userId: string, id: string, dependencies: {db?: LeadAccessDatabase} = {}) {
  const db = dependencies.db ?? prisma;
  const viewer = await financeLeadViewer(userId, {db});
  const lead = await db.contactSubmission.findFirst({where: {id, ...financeLeadScope(viewer)}, select: {id: true}});
  if (!lead) throw new LeadDomainError("NOT_FOUND", "Lead not found");
  return viewer;
}
