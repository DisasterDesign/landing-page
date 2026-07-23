import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

import {
  cancelDuplicateAgreementForMigrationInTransaction,
  changeAgreementCredit,
  classifyLegacyOrphanCommissionInTransaction,
  linkAgreementToLeadForMigrationInTransaction,
  linkHistoricalCommissionInTransaction,
} from "@/lib/leads/agreement-lifecycle";
import { cancelDuplicateFollowUpForMigrationInTransaction } from "@/lib/leads/follow-ups";
import type { AuthenticatedLeadActor } from "@/lib/leads/types";

const prisma = new PrismaClient();
const apply = process.env.APPLY === "1";

const reason = z.string().trim().min(1).max(2_000);
const id = z.string().trim().min(1).max(300);
const actionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("LINK_AGREEMENT_TO_LEAD"),
      agreementId: id,
      leadId: id,
      reason,
    })
    .strict(),
  z
    .object({
      type: z.literal("CANCEL_DUPLICATE_AGREEMENT"),
      agreementId: id,
      retainedAgreementId: id,
      reason,
    })
    .strict(),
  z
    .object({
      type: z.literal("CANCEL_DUPLICATE_FOLLOW_UP"),
      followUpId: id,
      reason,
    })
    .strict(),
  z
    .object({
      type: z.literal("SET_AGREEMENT_CREDIT"),
      agreementId: id,
      sellerId: id,
      reason,
    })
    .strict(),
  z
    .object({
      type: z.literal("LINK_COMMISSION_TO_AGREEMENT"),
      commissionId: id,
      agreementId: id,
      reason,
    })
    .strict(),
  z
    .object({
      type: z.literal("CLASSIFY_LEGACY_ORPHAN_COMMISSION"),
      commissionId: id,
      reason,
    })
    .strict(),
]);
const resolutionSchema = z
  .object({
    version: z.literal(1),
    actions: z.array(actionSchema).max(10_000),
  })
  .strict();

type ResolutionAction = z.infer<typeof actionSchema>;

function resolutionFileFromArgs(argv: readonly string[]): string {
  if (argv.length !== 2 || argv[0] !== "--file" || !argv[1]?.trim()) {
    throw new Error(
      "Usage: npm run leads:resolve -- --file /absolute/path/to/resolutions.json",
    );
  }
  return isAbsolute(argv[1]) ? argv[1] : resolve(process.cwd(), argv[1]);
}

function assertRealResolutionFileIsOutsideRepository(
  file: string,
  actionCount: number,
): void {
  if (actionCount === 0) return;
  const pathFromRepository = relative(process.cwd(), file);
  if (
    pathFromRepository !== ".." &&
    !pathFromRepository.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
  ) {
    throw new Error(
      "Non-empty resolution files must be stored outside the Git repository",
    );
  }
}

async function loadPersistedAdmin(): Promise<AuthenticatedLeadActor> {
  const operatorUserId = process.env.OPERATOR_USER_ID?.trim();
  if (!operatorUserId) throw new Error("OPERATOR_USER_ID is required");
  const operator = await prisma.user.findUnique({
    where: { id: operatorUserId },
    select: { id: true, role: true },
  });
  if (!operator || operator.role !== "ADMIN") {
    throw new Error("OPERATOR_USER_ID must identify a persisted ADMIN");
  }
  return { userId: operator.id, role: "ADMIN" };
}

function normalizedPhone(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\D/g, "") ?? "";
  return normalized || null;
}

function normalizedEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLocaleLowerCase("en") ?? "";
  return normalized || null;
}

interface ContactIdentityEvidence {
  phone?: string | null;
  email?: string | null;
}

function hasMatchingContactIdentity(
  left: ContactIdentityEvidence | null,
  right: ContactIdentityEvidence | null,
): boolean {
  if (!left || !right) return false;
  const leftPhone = normalizedPhone(left.phone);
  const rightPhone = normalizedPhone(right.phone);
  if (leftPhone && rightPhone && leftPhone === rightPhone) return true;
  const leftEmail = normalizedEmail(left.email);
  const rightEmail = normalizedEmail(right.email);
  return Boolean(leftEmail && rightEmail && leftEmail === rightEmail);
}

function hasAnyMatchingContactIdentity(
  left: Array<ContactIdentityEvidence | null>,
  right: Array<ContactIdentityEvidence | null>,
): boolean {
  return left.some((leftIdentity) =>
    right.some((rightIdentity) =>
      hasMatchingContactIdentity(leftIdentity, rightIdentity),
    ),
  );
}

async function preflight(action: ResolutionAction): Promise<void> {
  if (action.type === "LINK_AGREEMENT_TO_LEAD") {
    const [agreement, lead, activeCollision] = await Promise.all([
      prisma.agreement.findUnique({
        where: { id: action.agreementId },
        select: {
          leadId: true,
          phone: true,
          email: true,
          clientId: true,
          client: { select: { phone: true, email: true } },
        },
      }),
      prisma.contactSubmission.findUnique({
        where: { id: action.leadId },
        select: { id: true, phone: true, email: true },
      }),
      prisma.agreement.findFirst({
        where: {
          leadId: action.leadId,
          id: { not: action.agreementId },
          status: { in: ["DRAFT", "SENT", "SIGNED"] },
        },
        select: { id: true },
      }),
    ]);
    if (!agreement) throw new Error("Agreement not found");
    if (!lead) throw new Error("Lead not found");
    if (agreement.leadId && agreement.leadId !== action.leadId) {
      throw new Error("Agreement is already linked to another Lead");
    }
    if (activeCollision) {
      throw new Error("Link would create an active Agreement collision");
    }
    if (
      !hasAnyMatchingContactIdentity(
        [agreement, agreement.client],
        [lead],
      )
    ) {
      throw new Error("Agreement and Lead lack compatible contact/client evidence");
    }
    return;
  }
  if (action.type === "CANCEL_DUPLICATE_AGREEMENT") {
    if (action.agreementId === action.retainedAgreementId) {
      throw new Error("Duplicate and retained Agreement IDs must differ");
    }
    const [duplicate, retained] = await Promise.all([
      prisma.agreement.findUnique({
        where: { id: action.agreementId },
        select: {
          status: true,
          paymentStatus: true,
          paidAt: true,
          leadId: true,
          phone: true,
          email: true,
          clientId: true,
          client: { select: { phone: true, email: true } },
        },
      }),
      prisma.agreement.findUnique({
        where: { id: action.retainedAgreementId },
        select: {
          status: true,
          leadId: true,
          phone: true,
          email: true,
          clientId: true,
          client: { select: { phone: true, email: true } },
        },
      }),
    ]);
    if (!duplicate || !retained) throw new Error("Agreement not found");
    if (duplicate.paymentStatus === "COMPLETED" || duplicate.paidAt) {
      throw new Error("A paid Agreement cannot be cancelled as a duplicate");
    }
    if (!["DRAFT", "SENT", "SIGNED"].includes(retained.status)) {
      throw new Error("Retained Agreement is not active");
    }
    if (
      duplicate.leadId &&
      retained.leadId &&
      duplicate.leadId !== retained.leadId
    ) {
      throw new Error("Duplicate and retained Agreements do not share a Lead");
    }
    const shareLead =
      duplicate.leadId !== null && duplicate.leadId === retained.leadId;
    const shareClient = Boolean(
      duplicate.clientId && duplicate.clientId === retained.clientId,
    );
    const shareContact = hasAnyMatchingContactIdentity(
      [duplicate, duplicate.client],
      [retained, retained.client],
    );
    if (!shareLead && !shareClient && !shareContact) {
      throw new Error(
        "Unlinked duplicate and retained Agreements lack shared contact or Client identity",
      );
    }
    return;
  }
  if (action.type === "CANCEL_DUPLICATE_FOLLOW_UP") {
    const followUp = await prisma.leadFollowUp.findUnique({
      where: { id: action.followUpId },
      select: { status: true },
    });
    if (!followUp) throw new Error("Follow-up not found");
    if (followUp.status !== "SCHEDULED") {
      throw new Error("Follow-up is not scheduled");
    }
    return;
  }
  if (action.type === "SET_AGREEMENT_CREDIT") {
    const [agreement, seller] = await Promise.all([
      prisma.agreement.findUnique({
        where: { id: action.agreementId },
        select: { id: true },
      }),
      prisma.user.findFirst({
        where: { id: action.sellerId, role: "SELLER" },
        select: { id: true },
      }),
    ]);
    if (!agreement) throw new Error("Agreement not found");
    if (!seller) throw new Error("Credited seller is invalid");
    return;
  }
  if (action.type === "LINK_COMMISSION_TO_AGREEMENT") {
    const [commission, agreement] = await Promise.all([
      prisma.sellerCommission.findUnique({
        where: { id: action.commissionId },
        select: {
          sellerId: true,
          agreementLinkStatus: true,
          agreementRefId: true,
        },
      }),
      prisma.agreement.findUnique({
        where: { id: action.agreementId },
        select: {
          creditedSellerId: true,
          paymentStatus: true,
          paidAt: true,
        },
      }),
    ]);
    if (!commission || !agreement) throw new Error("Commission or Agreement not found");
    if (
      commission.agreementLinkStatus &&
      (commission.agreementLinkStatus !== "LINKED" ||
        commission.agreementRefId !== action.agreementId)
    ) {
      throw new Error("Commission already has a conflicting classification");
    }
    if (agreement.paymentStatus !== "COMPLETED" || !agreement.paidAt) {
      throw new Error("Target Agreement has no verified first payment");
    }
    if (
      agreement.creditedSellerId &&
      agreement.creditedSellerId !== commission.sellerId
    ) {
      throw new Error("Commission seller does not match Agreement credit");
    }
    return;
  }
  const commission = await prisma.sellerCommission.findUnique({
    where: { id: action.commissionId },
    select: {
      agreementId: true,
      agreementLinkStatus: true,
      agreementRefId: true,
    },
  });
  if (!commission) throw new Error("Commission not found");
  if (
    commission.agreementLinkStatus &&
    !(
      commission.agreementLinkStatus === "LEGACY_ORPHAN" &&
      commission.agreementRefId === null
    )
  ) {
    throw new Error("Commission already has a conflicting classification");
  }
  const legacyAgreement = await prisma.agreement.findUnique({
    where: { id: commission.agreementId },
    select: { id: true },
  });
  if (legacyAgreement) {
    throw new Error("Legacy Agreement still exists; orphan classification is forbidden");
  }
}

async function applyAction(
  action: ResolutionAction,
  actor: AuthenticatedLeadActor,
): Promise<void> {
  if (action.type === "SET_AGREEMENT_CREDIT") {
    await changeAgreementCredit({
      agreementId: action.agreementId,
      creditedSellerId: action.sellerId,
      reason: action.reason,
      actor,
    });
    return;
  }
  await prisma.$transaction(
    async (transaction) => {
      if (action.type === "LINK_AGREEMENT_TO_LEAD") {
        await linkAgreementToLeadForMigrationInTransaction(transaction, {
          agreementId: action.agreementId,
          leadId: action.leadId,
          reason: action.reason,
          actor,
        });
      } else if (action.type === "CANCEL_DUPLICATE_AGREEMENT") {
        await cancelDuplicateAgreementForMigrationInTransaction(transaction, {
          agreementId: action.agreementId,
          retainedAgreementId: action.retainedAgreementId,
          reason: action.reason,
          actor,
        });
      } else if (action.type === "CANCEL_DUPLICATE_FOLLOW_UP") {
        await cancelDuplicateFollowUpForMigrationInTransaction(transaction, {
          followUpId: action.followUpId,
          reason: action.reason,
          actor,
        });
      } else if (action.type === "LINK_COMMISSION_TO_AGREEMENT") {
        await linkHistoricalCommissionInTransaction(transaction, {
          commissionId: action.commissionId,
          agreementId: action.agreementId,
          reason: action.reason,
          actor,
        });
      } else {
        await classifyLegacyOrphanCommissionInTransaction(transaction, {
          commissionId: action.commissionId,
          reason: action.reason,
          actor,
        });
      }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 30_000,
    },
  );
}

async function main(): Promise<void> {
  const file = resolutionFileFromArgs(process.argv.slice(2));
  const raw = JSON.parse(await readFile(file, "utf8")) as unknown;
  const resolution = resolutionSchema.parse(raw);
  assertRealResolutionFileIsOutsideRepository(file, resolution.actions.length);
  console.log(`mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(
    `resolution file: version=${resolution.version} actions=${resolution.actions.length}`,
  );
  if (resolution.actions.length === 0) {
    console.log("No actions; parser verification complete.");
    return;
  }

  const actor = await loadPersistedAdmin();
  for (const [index, action] of resolution.actions.entries()) {
    await preflight(action);
    console.log(
      `${apply ? "APPLY" : "VALID"} action=${index + 1} type=${action.type}`,
    );
    if (apply) await applyAction(action, actor);
  }
}

main()
  .catch((error) => {
    if (error instanceof z.ZodError) {
      console.error(JSON.stringify(error.issues, null, 2));
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
