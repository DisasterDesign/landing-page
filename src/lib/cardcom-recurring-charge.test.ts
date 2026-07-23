import assert from "node:assert/strict";
import test from "node:test";

import {
  cardcomRecurringHistoryProviderDealId,
  cardcomRecurringProviderChargeKey,
  classifyLegacyRecurringRevenue,
  recordVerifiedRecurringCharge,
  type RecurringChargeWriterDependencies,
} from "./cardcom-recurring-charge";

type AgreementRow = {
  id: string;
  cardcomRecurringId: number;
  monthlyPrice: number;
  vatExempt: boolean;
  customerName: string;
  tier: "BASIC" | null;
  clientId: string | null;
};

type ChargeRow = {
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
  rawPayload: unknown;
  revenueAppliedAt: Date | null;
  revenueReviewRequired: boolean;
};

function writerHarness(input?: {
  agreements?: AgreementRow[];
  charges?: ChargeRow[];
  transactionFailures?: string[];
}) {
  const agreements =
    input?.agreements ??
    [
      {
        id: "agreement-1",
        cardcomRecurringId: 771,
        monthlyPrice: 100,
        vatExempt: false,
        customerName: "Acme",
        tier: "BASIC" as const,
        clientId: "client-1",
      },
    ];
  const charges = structuredClone(input?.charges ?? []) as ChargeRow[];
  const clientIncrements: Array<{ id: string; amount: number; paymentDate: Date }> = [];
  const productApplications: Array<{
    clientId: string;
    agreementId: string;
    amount: number;
    paidAt: Date;
  }> = [];
  const transactionIsolationLevels: unknown[] = [];
  let transactionAttempts = 0;
  let nextChargeId = 1;
  const transactionFailures = [...(input?.transactionFailures ?? [])];

  const tx = {
    agreement: {
      findMany: async ({
        where,
      }: {
        where: { cardcomRecurringId: number };
      }) =>
        agreements
          .filter((agreement) => agreement.cardcomRecurringId === where.cardcomRecurringId)
          .slice(0, 2),
    },
    agreementCharge: {
      findMany: async ({
        where,
      }: {
        where:
          | { providerChargeKey: string }
          | { cardcomDealId: string; providerChargeKey: null };
      }) =>
        charges
          .filter((charge) => {
            if ("providerChargeKey" in where && typeof where.providerChargeKey === "string") {
              return charge.providerChargeKey === where.providerChargeKey;
            }
            return (
              charge.cardcomDealId === where.cardcomDealId &&
              charge.providerChargeKey === null
            );
          })
          .slice(0, 2),
      create: async ({ data }: { data: Omit<ChargeRow, "id" | "revenueAppliedAt"> }) => {
        const row: ChargeRow = {
          ...data,
          id: `charge-${nextChargeId++}`,
          revenueAppliedAt: null,
        };
        charges.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<ChargeRow>;
      }) => {
        const row = charges.find((charge) => charge.id === where.id);
        if (!row) throw new Error("missing charge");
        Object.assign(row, data);
        return row;
      },
    },
    client: {
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { amount: { increment: number }; paymentDate: Date };
      }) => {
        clientIncrements.push({
          id: where.id,
          amount: data.amount.increment,
          paymentDate: data.paymentDate,
        });
      },
    },
  };

  const deps: RecurringChargeWriterDependencies = {
    now: () => new Date("2026-07-23T12:00:00.000Z"),
    transaction: async (operation, options) => {
      transactionAttempts++;
      transactionIsolationLevels.push(options.isolationLevel);
      const failureCode = transactionFailures.shift();
      if (failureCode) {
        throw Object.assign(new Error(failureCode), { code: failureCode });
      }
      return operation(tx as never);
    },
    applyPaymentToProduct: async (_tx, clientId, agreementId, amount, paidAt) => {
      productApplications.push({ clientId, agreementId, amount, paidAt });
    },
  };

  return {
    agreements,
    charges,
    clientIncrements,
    productApplications,
    transactionIsolationLevels,
    get transactionAttempts() {
      return transactionAttempts;
    },
    deps,
  };
}

const successfulInput = {
  recurringId: 771,
  providerDealId: "deal-9001",
  amount: 118,
  success: true,
  status: "SUCCESSFUL",
  responseCode: 0,
  billingAttempts: 1,
  invoiceNumber: "invoice-80",
  providerChargedAt: new Date("2026-07-23T10:00:00.000Z"),
  rawPayload: { Status: "SUCCESSFUL", InternalDealNumber: "deal-9001" },
};

test("legacy revenue classifier proves only known writers", () => {
  assert.equal(
    classifyLegacyRecurringRevenue({ DealResponse: 0, ResponseCode: 0 }),
    "ALREADY_APPLIED",
  );
  assert.equal(
    classifyLegacyRecurringRevenue({
      source: "cardcom-reconcile",
      row: { Status: "SUCCESSFUL" },
    }),
    "NOT_APPLIED",
  );
  assert.equal(
    classifyLegacyRecurringRevenue({ Status: "SUCCESSFUL", ResponseCode: 0 }),
    "REVIEW_REQUIRED",
  );
  assert.equal(
    classifyLegacyRecurringRevenue({ DealResponse: 0, source: "unknown" }),
    "REVIEW_REQUIRED",
  );
  assert.equal(classifyLegacyRecurringRevenue({ InternalDealNumber: 7 }), "REVIEW_REQUIRED");
  assert.equal(classifyLegacyRecurringRevenue(null), "REVIEW_REQUIRED");
});

test("provider charge key is stable, trimmed and namespaced", () => {
  assert.equal(
    cardcomRecurringProviderChargeKey("  deal-9001 "),
    "cardcom:recurring:deal-9001",
  );
});

test("reconciliation never invents a successful provider transaction id", () => {
  assert.equal(
    cardcomRecurringHistoryProviderDealId({
      RecurringId: 771,
      Status: "SUCCESSFUL",
      CreateDate: "2026-07-23T10:00:00.000Z",
    }),
    null,
  );
  assert.equal(
    cardcomRecurringHistoryProviderDealId({
      RecurringId: 771,
      Status: "DEBTAUTOBILLING",
      CreateDate: "2026-07-23T10:00:00.000Z",
    }),
    "history-attempt:771:2026-07-23T10:00:00.000Z",
  );
  assert.equal(
    cardcomRecurringHistoryProviderDealId({
      RecurringId: 771,
      Status: "SUCCESSFUL",
      TranzactionId: 9001,
    }),
    "9001",
  );
});

test("a new verified success records the charge and applies revenue atomically once", async () => {
  const harness = writerHarness();

  const result = await recordVerifiedRecurringCharge(successfulInput, harness.deps);

  assert.equal(result.disposition, "created");
  assert.equal(result.revenueApplied, true);
  assert.equal(result.reviewRequired, false);
  assert.equal(result.previousStatus, null);
  assert.equal(result.customerName, "Acme");
  assert.equal(result.tier, "BASIC");
  assert.equal(result.clientId, "client-1");
  assert.equal(result.agreementId, "agreement-1");
  assert.equal(harness.transactionIsolationLevels[0], "Serializable");
  assert.deepEqual(harness.clientIncrements, [
    {
      id: "client-1",
      amount: 118,
      paymentDate: new Date("2026-07-23T12:00:00.000Z"),
    },
  ]);
  assert.deepEqual(harness.productApplications, [
    {
      clientId: "client-1",
      agreementId: "agreement-1",
      amount: 118,
      paidAt: new Date("2026-07-23T12:00:00.000Z"),
    },
  ]);
  assert.equal(harness.charges[0]?.providerChargeKey, "cardcom:recurring:deal-9001");
  assert.deepEqual(
    harness.charges[0]?.revenueAppliedAt,
    new Date("2026-07-23T12:00:00.000Z"),
  );
});

test("a canonical replay is unchanged and never reapplies revenue", async () => {
  const harness = writerHarness();
  await recordVerifiedRecurringCharge(successfulInput, harness.deps);

  const replay = await recordVerifiedRecurringCharge(successfulInput, harness.deps);

  assert.equal(replay.disposition, "unchanged");
  assert.equal(replay.revenueApplied, false);
  assert.equal(replay.reviewRequired, false);
  assert.equal(replay.previousStatus, "SUCCESSFUL");
  assert.equal(harness.clientIncrements.length, 1);
  assert.equal(harness.productApplications.length, 1);
  assert.equal(harness.charges.length, 1);
});

test("a canonical failed charge applies revenue only on its first verified success", async () => {
  const harness = writerHarness();
  const failure = {
    ...successfulInput,
    success: false,
    status: "DEBTAUTOBILLING",
    responseCode: 12,
  };
  const failedResult = await recordVerifiedRecurringCharge(failure, harness.deps);
  assert.equal(failedResult.revenueApplied, false);

  const recovered = await recordVerifiedRecurringCharge(successfulInput, harness.deps);
  const replay = await recordVerifiedRecurringCharge(successfulInput, harness.deps);

  assert.equal(recovered.disposition, "updated");
  assert.equal(recovered.previousStatus, "DEBTAUTOBILLING");
  assert.equal(recovered.revenueApplied, true);
  assert.equal(replay.revenueApplied, false);
  assert.equal(harness.clientIncrements.length, 1);
  assert.equal(harness.productApplications.length, 1);
});

test("claiming a legacy main-webhook row records its proven revenue marker without incrementing again", async () => {
  const chargedAt = new Date("2026-06-23T10:00:00.000Z");
  const harness = writerHarness({
    charges: [
      {
        id: "legacy-main",
        agreementId: "agreement-1",
        amount: 118,
        cardcomDealId: "deal-9001",
        providerChargeKey: null,
        invoiceNumber: "invoice-80",
        cardcomRecurringId: 771,
        success: true,
        status: null,
        responseCode: null,
        billingAttempts: null,
        cardcomChargeDate: null,
        chargedAt,
        rawPayload: { DealResponse: 0, ResponseCode: 0 },
        revenueAppliedAt: null,
        revenueReviewRequired: false,
      },
    ],
  });

  const result = await recordVerifiedRecurringCharge(successfulInput, harness.deps);

  assert.equal(result.disposition, "updated");
  assert.equal(result.revenueApplied, false);
  assert.equal(result.reviewRequired, false);
  assert.deepEqual(harness.charges[0]?.revenueAppliedAt, chargedAt);
  assert.equal(harness.charges[0]?.providerChargeKey, "cardcom:recurring:deal-9001");
  assert.equal(harness.clientIncrements.length, 0);
  assert.equal(harness.productApplications.length, 0);
});

test("claiming a legacy cron row applies a successful charge that the old writer never applied", async () => {
  const harness = writerHarness({
    charges: [
      {
        id: "legacy-cron",
        agreementId: "agreement-1",
        amount: 118,
        cardcomDealId: "deal-9001",
        providerChargeKey: null,
        invoiceNumber: null,
        cardcomRecurringId: 771,
        success: true,
        status: "SUCCESSFUL",
        responseCode: null,
        billingAttempts: null,
        cardcomChargeDate: null,
        chargedAt: new Date("2026-06-23T10:00:00.000Z"),
        rawPayload: { source: "cardcom-reconcile", row: { Status: "SUCCESSFUL" } },
        revenueAppliedAt: null,
        revenueReviewRequired: false,
      },
    ],
  });

  const result = await recordVerifiedRecurringCharge(successfulInput, harness.deps);

  assert.equal(result.disposition, "updated");
  assert.equal(result.revenueApplied, true);
  assert.equal(result.reviewRequired, false);
  assert.equal(harness.clientIncrements.length, 1);
  assert.equal(harness.productApplications.length, 1);
});

test("a legacy Status payload is quarantined because it may have overwritten an applied main-webhook row", async () => {
  const harness = writerHarness({
    charges: [
      {
        id: "legacy-dedicated-webhook",
        agreementId: "agreement-1",
        amount: 118,
        cardcomDealId: "deal-9001",
        providerChargeKey: null,
        invoiceNumber: null,
        cardcomRecurringId: 771,
        success: true,
        status: "SUCCESSFUL",
        responseCode: 0,
        billingAttempts: 1,
        cardcomChargeDate: null,
        chargedAt: new Date("2026-06-23T10:00:00.000Z"),
        rawPayload: { Status: "SUCCESSFUL", ResponseCode: 0 },
        revenueAppliedAt: null,
        revenueReviewRequired: false,
      },
    ],
  });

  const result = await recordVerifiedRecurringCharge(successfulInput, harness.deps);

  assert.equal(result.revenueApplied, false);
  assert.equal(result.reviewRequired, true);
  assert.equal(harness.clientIncrements.length, 0);
  assert.equal(harness.productApplications.length, 0);
});

test("ambiguous legacy revenue is quarantined for review and never guessed", async () => {
  const harness = writerHarness({
    charges: [
      {
        id: "legacy-ambiguous",
        agreementId: "agreement-1",
        amount: 118,
        cardcomDealId: "deal-9001",
        providerChargeKey: null,
        invoiceNumber: null,
        cardcomRecurringId: 771,
        success: true,
        status: null,
        responseCode: null,
        billingAttempts: null,
        cardcomChargeDate: null,
        chargedAt: new Date("2026-06-23T10:00:00.000Z"),
        rawPayload: { InternalDealNumber: "deal-9001" },
        revenueAppliedAt: null,
        revenueReviewRequired: false,
      },
    ],
  });

  const result = await recordVerifiedRecurringCharge(successfulInput, harness.deps);

  assert.equal(result.disposition, "updated");
  assert.equal(result.revenueApplied, false);
  assert.equal(result.reviewRequired, true);
  assert.equal(harness.charges[0]?.revenueReviewRequired, true);
  assert.equal(harness.charges[0]?.revenueAppliedAt, null);
  assert.equal(harness.clientIncrements.length, 0);
  assert.equal(harness.productApplications.length, 0);
});

test("agreement and amount conflicts fail closed before claiming a legacy row", async () => {
  const wrongAgreement = writerHarness({
    charges: [
      {
        id: "legacy-wrong-agreement",
        agreementId: "agreement-other",
        amount: 118,
        cardcomDealId: "deal-9001",
        providerChargeKey: null,
        invoiceNumber: null,
        cardcomRecurringId: 990,
        success: true,
        status: null,
        responseCode: null,
        billingAttempts: null,
        cardcomChargeDate: null,
        chargedAt: new Date(),
        rawPayload: { DealResponse: 0 },
        revenueAppliedAt: null,
        revenueReviewRequired: false,
      },
    ],
  });
  await assert.rejects(
    recordVerifiedRecurringCharge(successfulInput, wrongAgreement.deps),
    /different agreement/i,
  );
  assert.equal(wrongAgreement.charges[0]?.providerChargeKey, null);

  const wrongAmount = writerHarness({
    charges: [
      {
        ...wrongAgreement.charges[0]!,
        id: "legacy-wrong-amount",
        agreementId: "agreement-1",
        amount: 99,
      },
    ],
  });
  await assert.rejects(
    recordVerifiedRecurringCharge(successfulInput, wrongAmount.deps),
    /amount conflict/i,
  );
  assert.equal(wrongAmount.charges[0]?.providerChargeKey, null);

  const providerAmountMismatch = writerHarness();
  await assert.rejects(
    recordVerifiedRecurringCharge(
      { ...successfulInput, providerDealId: "deal-wrong-sum", amount: 117 },
      providerAmountMismatch.deps,
    ),
    /does not match agreement/i,
  );
  assert.equal(providerAmountMismatch.charges.length, 0);
});

test("ambiguous recurring-order matches fail closed", async () => {
  const harness = writerHarness({
    agreements: [
      {
        id: "agreement-1",
        cardcomRecurringId: 771,
        monthlyPrice: 100,
        vatExempt: false,
        customerName: "Acme",
        tier: "BASIC",
        clientId: "client-1",
      },
      {
        id: "agreement-2",
        cardcomRecurringId: 771,
        monthlyPrice: 100,
        vatExempt: false,
        customerName: "Other",
        tier: "BASIC",
        clientId: "client-2",
      },
    ],
  });

  await assert.rejects(
    recordVerifiedRecurringCharge(successfulInput, harness.deps),
    /expected exactly one agreement/i,
  );
});

test("serialization and provider-key races are retried, unrelated errors are not", async () => {
  const retried = writerHarness({ transactionFailures: ["P2034", "P2002"] });
  const result = await recordVerifiedRecurringCharge(successfulInput, retried.deps);
  assert.equal(result.disposition, "created");
  assert.equal(retried.transactionAttempts, 3);

  const unrelated = writerHarness({ transactionFailures: ["P2025"] });
  await assert.rejects(
    recordVerifiedRecurringCharge(successfulInput, unrelated.deps),
    /P2025/,
  );
  assert.equal(unrelated.transactionAttempts, 1);
});
