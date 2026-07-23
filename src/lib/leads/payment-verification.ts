interface FirstPaymentEvidenceRow {
  id: string;
  paymentId: string | null;
  paymentStatus: string;
  paidAt: Date | null;
  paidAmount: number | null;
  cardcomDealId: string | null;
  cardcomVerifiedLowProfileId: string | null;
  cardcomVerifiedReturnValue: string | null;
  cardcomVerifiedTransactionId: string | null;
  cardcomVerifiedAmount: number | null;
  cardcomPaymentVerifiedAt: Date | null;
}

export interface VerifiedFirstPaymentEvidence {
  paidAt: Date;
  paidAmount: number;
  lowProfileId: string;
  providerTransactionId: string;
  verifiedAt: Date;
}

function nonEmpty(value: string | null): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

export function verifiedFirstPaymentEvidence(
  agreement: FirstPaymentEvidenceRow,
): VerifiedFirstPaymentEvidence | null {
  const lowProfileId = nonEmpty(agreement.cardcomVerifiedLowProfileId);
  const storedAttemptId = nonEmpty(agreement.paymentId);
  const providerTransactionId = nonEmpty(
    agreement.cardcomVerifiedTransactionId,
  );
  const cardcomDealId = nonEmpty(agreement.cardcomDealId);
  if (
    agreement.paymentStatus !== "COMPLETED" ||
    !agreement.paidAt ||
    !agreement.cardcomPaymentVerifiedAt ||
    !lowProfileId ||
    storedAttemptId !== lowProfileId ||
    !providerTransactionId ||
    cardcomDealId !== providerTransactionId ||
    agreement.cardcomVerifiedReturnValue !== agreement.id ||
    agreement.paidAmount === null ||
    !Number.isFinite(agreement.paidAmount) ||
    agreement.paidAmount <= 0 ||
    agreement.cardcomVerifiedAmount === null ||
    !Number.isFinite(agreement.cardcomVerifiedAmount) ||
    Math.abs(agreement.paidAmount - agreement.cardcomVerifiedAmount) > 0.01
  ) {
    return null;
  }

  return {
    paidAt: agreement.paidAt,
    paidAmount: agreement.paidAmount,
    lowProfileId,
    providerTransactionId,
    verifiedAt: agreement.cardcomPaymentVerifiedAt,
  };
}
