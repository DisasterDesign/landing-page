import { createHmac } from "node:crypto";

import { prisma } from "@/lib/prisma";

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeDomain(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  } catch {
    return trimmed.toLowerCase().replace(/^www\./, "").replace(/[\s/]+/g, "");
  }
}

function normalizeSuppressionValue(value: string): string {
  const trimmed = value.trim();
  if (/^\+?[\d\s().-]+$/.test(trimmed)) return normalizePhone(trimmed);
  if (trimmed.includes(".") || trimmed.includes("://")) return normalizeDomain(trimmed);
  return trimmed.toLocaleLowerCase("en").replace(/\s+/g, " ");
}

export function hashSuppressionValue(value: string, secret: string): string {
  if (!secret) throw new Error("Suppression hash secret is required");
  return createHmac("sha256", secret).update(normalizeSuppressionValue(value)).digest("hex");
}

export async function suppressProspect(input: {
  prospectId: string;
  placeId: string;
  phone?: string | null;
  domain?: string | null;
  reason: string;
  createdById: string;
  secret: string;
}): Promise<void> {
  const phoneHash = input.phone ? hashSuppressionValue(normalizePhone(input.phone), input.secret) : null;
  const domainHash = input.domain
    ? hashSuppressionValue(normalizeDomain(input.domain), input.secret)
    : null;

  await prisma.$transaction(async (transaction) => {
    await transaction.prospectSuppression.create({
      data: {
        placeId: input.placeId,
        phoneHash,
        domainHash,
        reason: input.reason,
        sourceProspectId: input.prospectId,
        createdById: input.createdById,
      },
    });
    await transaction.prospect.update({
      where: { id: input.prospectId },
      data: { status: "DO_NOT_CALL", nextFollowUpAt: null },
    });
  });
}
