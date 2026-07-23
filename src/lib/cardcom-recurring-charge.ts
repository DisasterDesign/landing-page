import {
  Prisma,
  type AgreementTier,
} from "@prisma/client";

import { applyPaymentToProduct } from "@/lib/client-products";
import { prisma } from "@/lib/prisma";
import { withVat } from "@/lib/vat";

const MAX_TRANSACTION_ATTEMPTS = 3;
const RETRYABLE_TRANSACTION_CODES = new Set(["P2002", "P2034"]);

export type LegacyRecurringRevenueClassification =
  | "ALREADY_APPLIED"
  | "NOT_APPLIED"
  | "REVIEW_REQUIRED";

export type VerifiedRecurringChargeInput = {
  recurringId: number;
  providerDealId: string;
  amount: number;
  success: boolean;
  status?: string | null;
  responseCode?: number | null;
  billingAttempts?: number | null;
  invoiceNumber?: string | null;
  providerChargedAt?: Date | null;
  rawPayload: Prisma.InputJsonValue;
};

export type VerifiedRecurringChargeResult = {
  chargeId: string;
  providerChargeKey: string;
  agreementId: string;
  customerName: string;
  tier: AgreementTier | null;
  clientId: string | null;
  amount: number;
  success: boolean;
  invoiceNumber: string | null;
  disposition: "created" | "updated" | "unchanged";
  revenueApplied: boolean;
  reviewRequired: boolean;
  previousStatus: string | null;
};

type TransactionRunner = <T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  options: { isolationLevel: Prisma.TransactionIsolationLevel },
) => Promise<T>;

export type RecurringChargeWriterDependencies = {
  transaction?: TransactionRunner;
  applyPaymentToProduct?: typeof applyPaymentToProduct;
  now?: () => Date;
};

type AgreementProjection = {
  id: string;
  monthlyPrice: number;
  vatExempt: boolean;
  customerName: string;
  tier: AgreementTier | null;
  clientId: string | null;
};

type ChargeProjection = {
  id: string;
  agreementId: string;
  amount: number;
  cardcomDealId: string | null;
  providerChargeKey: string | null;
  invoiceNumber: string | null;
  cardcomRecurringId: number | null;
  success: boolean;
  status: string | null;
  responseCode: number | null;
  billingAttempts: number | null;
  cardcomChargeDate: Date | null;
  chargedAt: Date;
  rawPayload: Prisma.JsonValue | null;
  revenueAppliedAt: Date | null;
  revenueReviewRequired: boolean;
};

export function cardcomRecurringProviderChargeKey(providerDealId: string): string {
  const normalized = providerDealId.trim();
  if (!normalized) {
    throw new Error("A Cardcom provider deal ID is required");
  }
  return `cardcom:recurring:${normalized}`;
}

export function cardcomRecurringHistoryProviderDealId(row: {
  RecurringId: number;
  Status: string;
  TranzactionId?: number | string;
  CreateDate?: string;
}): string | null {
  if (row.TranzactionId != null) {
    const providerDealId = String(row.TranzactionId).trim();
    return providerDealId || null;
  }
  // Only Cardcom's transaction ID is shared by push and pull. A synthetic
  // success key could coexist with the webhook's InternalDealNumber and apply
  // the same revenue twice. Failed attempts carry no revenue, so their stable
  // recurring-id/date identity remains useful for status reconciliation.
  if (row.Status === "SUCCESSFUL" || !row.CreateDate) return null;
  const createdAt = new Date(row.CreateDate);
  if (Number.isNaN(createdAt.getTime())) return null;
  return `history-attempt:${row.RecurringId}:${createdAt.toISOString()}`;
}

/**
 * Identify which pre-canonical writer produced a legacy charge row.
 *
 * This function intentionally recognizes only the exact persisted shapes of
 * the three previous writers. Unknown payloads remain quarantined instead of
 * inferring whether Client.amount was already incremented.
 */
export function classifyLegacyRecurringRevenue(
  rawPayload: Prisma.JsonValue | null,
): LegacyRecurringRevenueClassification {
  if (!isJsonObject(rawPayload)) return "REVIEW_REQUIRED";

  if (rawPayload.source === "cardcom-reconcile") {
    return "NOT_APPLIED";
  }

  if (hasOwn(rawPayload, "Status")) {
    // The legacy dedicated webhook upserted by deal ID and replaced
    // rawPayload. It could therefore overwrite a main-webhook payload whose
    // transaction had already incremented revenue. Status alone cannot prove
    // either direction.
    return "REVIEW_REQUIRED";
  }

  if (hasOwn(rawPayload, "source")) {
    return "REVIEW_REQUIRED";
  }

  const response =
    hasOwn(rawPayload, "DealResponse")
      ? rawPayload.DealResponse
      : hasOwn(rawPayload, "ResponseCode")
        ? rawPayload.ResponseCode
        : undefined;
  if (response === undefined) return "REVIEW_REQUIRED";

  const numericResponse =
    typeof response === "number"
      ? response
      : typeof response === "string" && response.trim()
        ? Number(response)
        : Number.NaN;
  if (!Number.isFinite(numericResponse)) return "REVIEW_REQUIRED";
  return numericResponse === 0 ? "ALREADY_APPLIED" : "NOT_APPLIED";
}

export async function recordVerifiedRecurringCharge(
  input: VerifiedRecurringChargeInput,
  dependencies: RecurringChargeWriterDependencies = {},
): Promise<VerifiedRecurringChargeResult> {
  const normalized = normalizeInput(input);
  const runTransaction: TransactionRunner =
    dependencies.transaction ??
    ((operation, options) => prisma.$transaction(operation, options));
  const applyProduct =
    dependencies.applyPaymentToProduct ?? applyPaymentToProduct;
  const now = dependencies.now ?? (() => new Date());

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt++) {
    try {
      return await runTransaction(
        (transaction) =>
          recordInTransaction(transaction, normalized, applyProduct, now),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        attempt === MAX_TRANSACTION_ATTEMPTS ||
        !isRetryableTransactionError(error)
      ) {
        throw error;
      }
    }
  }

  throw new Error("Recurring charge transaction retry exhausted");
}

async function recordInTransaction(
  transaction: Prisma.TransactionClient,
  input: ReturnType<typeof normalizeInput>,
  applyProduct: typeof applyPaymentToProduct,
  now: () => Date,
): Promise<VerifiedRecurringChargeResult> {
  const agreementMatches = await transaction.agreement.findMany({
    where: { cardcomRecurringId: input.recurringId },
    take: 2,
    select: {
      id: true,
      monthlyPrice: true,
      vatExempt: true,
      customerName: true,
      tier: true,
      clientId: true,
    },
  });
  if (agreementMatches.length !== 1) {
    throw new Error(
      `Expected exactly one agreement for Cardcom recurring ID ${input.recurringId}; found ${agreementMatches.length}`,
    );
  }
  const agreement: AgreementProjection = agreementMatches[0];
  assertAgreementAmount(agreement, input.amount);
  if (input.success && !agreement.clientId) {
    throw new Error(
      `Successful recurring charge ${input.providerDealId} has no linked client`,
    );
  }

  const providerChargeKey = cardcomRecurringProviderChargeKey(
    input.providerDealId,
  );
  const canonicalMatches = await transaction.agreementCharge.findMany({
    where: { providerChargeKey },
    take: 2,
    select: chargeSelect,
  });
  if (canonicalMatches.length > 1) {
    throw new Error(
      `Provider charge key ${providerChargeKey} matched multiple charge rows`,
    );
  }
  if (canonicalMatches.length === 1) {
    return updateCanonicalCharge(
      transaction,
      canonicalMatches[0],
      agreement,
      input,
      providerChargeKey,
      applyProduct,
      now,
    );
  }

  const dealMatches = await transaction.agreementCharge.findMany({
    where: { cardcomDealId: input.providerDealId },
    take: 2,
    select: chargeSelect,
  });
  if (dealMatches.length > 1) {
    throw new Error(
      `Cardcom deal ${input.providerDealId} matched multiple legacy charge rows`,
    );
  }
  if (dealMatches.length === 1) {
    if (dealMatches[0].providerChargeKey !== null) {
      throw new Error(
        `Cardcom deal ${input.providerDealId} is already bound to a different provider charge key`,
      );
    }
    return claimLegacyCharge(
      transaction,
      dealMatches[0],
      agreement,
      input,
      providerChargeKey,
      applyProduct,
      now,
    );
  }

  return createCharge(
    transaction,
    agreement,
    input,
    providerChargeKey,
    applyProduct,
    now,
  );
}

async function createCharge(
  transaction: Prisma.TransactionClient,
  agreement: AgreementProjection,
  input: ReturnType<typeof normalizeInput>,
  providerChargeKey: string,
  applyProduct: typeof applyPaymentToProduct,
  now: () => Date,
): Promise<VerifiedRecurringChargeResult> {
  const paidAt = checkedNow(now);
  const charge = await transaction.agreementCharge.create({
    data: {
      agreementId: agreement.id,
      amount: input.amount,
      cardcomDealId: input.providerDealId,
      providerChargeKey,
      invoiceNumber: input.invoiceNumber,
      cardcomRecurringId: input.recurringId,
      success: input.success,
      status: input.status,
      responseCode: input.responseCode,
      billingAttempts: input.billingAttempts,
      cardcomChargeDate: input.providerChargedAt,
      chargedAt: paidAt,
      rawPayload: input.rawPayload,
      revenueReviewRequired: false,
    },
    select: chargeSelect,
  });

  let revenueApplied = false;
  if (input.success) {
    await applyRevenue(
      transaction,
      agreement,
      input.amount,
      paidAt,
      applyProduct,
    );
    await transaction.agreementCharge.update({
      where: { id: charge.id },
      data: { revenueAppliedAt: paidAt },
    });
    revenueApplied = true;
  }

  return resultFor({
    charge: {
      ...charge,
      revenueAppliedAt: revenueApplied ? paidAt : null,
    },
    agreement,
    providerChargeKey,
    disposition: "created",
    revenueApplied,
    previousStatus: null,
  });
}

async function updateCanonicalCharge(
  transaction: Prisma.TransactionClient,
  existing: ChargeProjection,
  agreement: AgreementProjection,
  input: ReturnType<typeof normalizeInput>,
  providerChargeKey: string,
  applyProduct: typeof applyPaymentToProduct,
  now: () => Date,
): Promise<VerifiedRecurringChargeResult> {
  assertExistingChargeMatches(existing, agreement, input);
  const previousStatus = existing.status;
  const merged = mergeTrustedFields(existing, input, providerChargeKey);
  const paidAt = checkedNow(now);
  let revenueApplied = false;

  if (
    input.success &&
    existing.revenueAppliedAt === null &&
    !existing.revenueReviewRequired
  ) {
    await applyRevenue(
      transaction,
      agreement,
      input.amount,
      paidAt,
      applyProduct,
    );
    merged.revenueAppliedAt = paidAt;
    revenueApplied = true;
  }

  const data = changedChargeData(existing, merged);
  const disposition =
    Object.keys(data).length === 0 ? "unchanged" : "updated";
  const charge =
    disposition === "unchanged"
      ? existing
      : await transaction.agreementCharge.update({
          where: { id: existing.id },
          data,
          select: chargeSelect,
        });

  return resultFor({
    charge,
    agreement,
    providerChargeKey,
    disposition,
    revenueApplied,
    previousStatus,
  });
}

async function claimLegacyCharge(
  transaction: Prisma.TransactionClient,
  existing: ChargeProjection,
  agreement: AgreementProjection,
  input: ReturnType<typeof normalizeInput>,
  providerChargeKey: string,
  applyProduct: typeof applyPaymentToProduct,
  now: () => Date,
): Promise<VerifiedRecurringChargeResult> {
  assertExistingChargeMatches(existing, agreement, input);
  const previousStatus = existing.status;
  const classification = classifyLegacyRecurringRevenue(existing.rawPayload);
  const paidAt = checkedNow(now);
  const merged = mergeTrustedFields(existing, input, providerChargeKey);
  let revenueApplied = false;

  if (existing.revenueAppliedAt !== null) {
    merged.revenueReviewRequired = false;
  } else if (classification === "ALREADY_APPLIED") {
    merged.revenueAppliedAt = existing.chargedAt;
    merged.revenueReviewRequired = false;
  } else if (classification === "NOT_APPLIED") {
    merged.revenueReviewRequired = false;
    if (input.success) {
      await applyRevenue(
        transaction,
        agreement,
        input.amount,
        paidAt,
        applyProduct,
      );
      merged.revenueAppliedAt = paidAt;
      revenueApplied = true;
    }
  } else {
    merged.revenueReviewRequired = true;
  }

  const charge = await transaction.agreementCharge.update({
    where: { id: existing.id },
    data: changedChargeData(existing, merged),
    select: chargeSelect,
  });

  return resultFor({
    charge,
    agreement,
    providerChargeKey,
    disposition: "updated",
    revenueApplied,
    previousStatus,
  });
}

async function applyRevenue(
  transaction: Prisma.TransactionClient,
  agreement: AgreementProjection,
  amount: number,
  paidAt: Date,
  applyProduct: typeof applyPaymentToProduct,
): Promise<void> {
  if (!agreement.clientId) {
    throw new Error(`Agreement ${agreement.id} has no linked client`);
  }
  await transaction.client.update({
    where: { id: agreement.clientId },
    data: {
      amount: { increment: amount },
      paymentDate: paidAt,
    },
  });
  await applyProduct(
    transaction,
    agreement.clientId,
    agreement.id,
    amount,
    paidAt,
  );
}

function assertAgreementAmount(
  agreement: AgreementProjection,
  amount: number,
): void {
  const expectedAmount = agreement.vatExempt
    ? agreement.monthlyPrice
    : withVat(agreement.monthlyPrice);
  if (!moneyEquals(amount, expectedAmount)) {
    throw new Error(
      `Recurring charge amount ${amount} does not match agreement ${agreement.id} amount ${expectedAmount}`,
    );
  }
}

function assertExistingChargeMatches(
  charge: ChargeProjection,
  agreement: AgreementProjection,
  input: ReturnType<typeof normalizeInput>,
): void {
  if (charge.agreementId !== agreement.id) {
    throw new Error(
      `Cardcom deal ${input.providerDealId} belongs to a different agreement`,
    );
  }
  if (!moneyEquals(charge.amount, input.amount)) {
    throw new Error(
      `Cardcom deal ${input.providerDealId} has an amount conflict`,
    );
  }
  if (
    charge.cardcomRecurringId !== null &&
    charge.cardcomRecurringId !== input.recurringId
  ) {
    throw new Error(
      `Cardcom deal ${input.providerDealId} has a recurring agreement conflict`,
    );
  }
  if (
    charge.cardcomDealId !== null &&
    charge.cardcomDealId.trim() !== input.providerDealId
  ) {
    throw new Error(
      `Provider charge key points to a different Cardcom deal`,
    );
  }
}

function mergeTrustedFields(
  existing: ChargeProjection,
  input: ReturnType<typeof normalizeInput>,
  providerChargeKey: string,
): ChargeProjection {
  return {
    ...existing,
    cardcomDealId: input.providerDealId,
    providerChargeKey,
    invoiceNumber: input.invoiceNumber ?? existing.invoiceNumber,
    cardcomRecurringId: input.recurringId,
    success: input.success,
    status: input.status ?? existing.status,
    responseCode: input.responseCode ?? existing.responseCode,
    billingAttempts: input.billingAttempts ?? existing.billingAttempts,
    cardcomChargeDate:
      input.providerChargedAt ?? existing.cardcomChargeDate,
  };
}

function changedChargeData(
  existing: ChargeProjection,
  next: ChargeProjection,
): Prisma.AgreementChargeUpdateInput {
  const data: Prisma.AgreementChargeUpdateInput = {};
  if (existing.cardcomDealId !== next.cardcomDealId) {
    data.cardcomDealId = next.cardcomDealId;
  }
  if (existing.providerChargeKey !== next.providerChargeKey) {
    data.providerChargeKey = next.providerChargeKey;
  }
  if (existing.invoiceNumber !== next.invoiceNumber) {
    data.invoiceNumber = next.invoiceNumber;
  }
  if (existing.cardcomRecurringId !== next.cardcomRecurringId) {
    data.cardcomRecurringId = next.cardcomRecurringId;
  }
  if (existing.success !== next.success) data.success = next.success;
  if (existing.status !== next.status) data.status = next.status;
  if (existing.responseCode !== next.responseCode) {
    data.responseCode = next.responseCode;
  }
  if (existing.billingAttempts !== next.billingAttempts) {
    data.billingAttempts = next.billingAttempts;
  }
  if (!sameDate(existing.cardcomChargeDate, next.cardcomChargeDate)) {
    data.cardcomChargeDate = next.cardcomChargeDate;
  }
  if (!sameDate(existing.revenueAppliedAt, next.revenueAppliedAt)) {
    data.revenueAppliedAt = next.revenueAppliedAt;
  }
  if (
    existing.revenueReviewRequired !== next.revenueReviewRequired
  ) {
    data.revenueReviewRequired = next.revenueReviewRequired;
  }
  return data;
}

function resultFor(input: {
  charge: ChargeProjection;
  agreement: AgreementProjection;
  providerChargeKey: string;
  disposition: VerifiedRecurringChargeResult["disposition"];
  revenueApplied: boolean;
  previousStatus: string | null;
}): VerifiedRecurringChargeResult {
  return {
    chargeId: input.charge.id,
    providerChargeKey: input.providerChargeKey,
    agreementId: input.agreement.id,
    customerName: input.agreement.customerName,
    tier: input.agreement.tier,
    clientId: input.agreement.clientId,
    amount: input.charge.amount,
    success: input.charge.success,
    invoiceNumber: input.charge.invoiceNumber,
    disposition: input.disposition,
    revenueApplied: input.revenueApplied,
    reviewRequired: input.charge.revenueReviewRequired,
    previousStatus: input.previousStatus,
  };
}

function normalizeInput(input: VerifiedRecurringChargeInput) {
  if (!Number.isSafeInteger(input.recurringId) || input.recurringId <= 0) {
    throw new Error("A positive Cardcom recurring ID is required");
  }
  const providerDealId = input.providerDealId.trim();
  cardcomRecurringProviderChargeKey(providerDealId);
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("A positive verified recurring charge amount is required");
  }
  if (
    input.providerChargedAt &&
    Number.isNaN(input.providerChargedAt.getTime())
  ) {
    throw new Error("The Cardcom charge date is invalid");
  }

  return {
    recurringId: input.recurringId,
    providerDealId,
    amount: input.amount,
    success: input.success,
    status: normalizedString(input.status),
    responseCode: normalizedInteger(input.responseCode, "response code"),
    billingAttempts: normalizedInteger(
      input.billingAttempts,
      "billing attempts",
    ),
    invoiceNumber: normalizedString(input.invoiceNumber),
    providerChargedAt: input.providerChargedAt ?? null,
    rawPayload: input.rawPayload,
  };
}

function normalizedString(value: string | null | undefined): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

function normalizedInteger(
  value: number | null | undefined,
  field: string,
): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Cardcom ${field} must be an integer`);
  }
  return value;
}

function moneyEquals(left: number, right: number): boolean {
  return Math.round(left * 100) === Math.round(right * 100);
}

function sameDate(left: Date | null, right: Date | null): boolean {
  return left?.getTime() === right?.getTime();
}

function checkedNow(now: () => Date): Date {
  const value = now();
  if (Number.isNaN(value.getTime())) throw new Error("Current time is invalid");
  return value;
}

function isRetryableTransactionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    RETRYABLE_TRANSACTION_CODES.has(error.code)
  );
}

function isJsonObject(
  value: Prisma.JsonValue | null,
): value is Prisma.JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(
  value: Prisma.JsonObject,
  key: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

const chargeSelect = {
  id: true,
  agreementId: true,
  amount: true,
  cardcomDealId: true,
  providerChargeKey: true,
  invoiceNumber: true,
  cardcomRecurringId: true,
  success: true,
  status: true,
  responseCode: true,
  billingAttempts: true,
  cardcomChargeDate: true,
  chargedAt: true,
  rawPayload: true,
  revenueAppliedAt: true,
  revenueReviewRequired: true,
} as const;
