import assert from "node:assert/strict";
import test from "node:test";
import { shouldCreateRecurringOrder } from "../agreements/one-time";
import { withVat } from "../vat";
import { loadRoute } from "./route-harness";

for (const financeBook of ["SHARED", "PRIVATE"] as const) {
  test(`${financeBook} first payment persists financial updates without admin pushes or email`, async () => {
    const paidAt = new Date("2026-10-01T10:00:00.000Z");
    const notifications: unknown[] = [];
    const emails: unknown[] = [];
    const clientWrites: unknown[] = [];
    const productPayments: unknown[] = [];
    const lifecycleInputs: unknown[] = [];
    const postCommitEffects: unknown[] = [];
    const afterCallbacks: Array<() => Promise<void>> = [];
    const agreement = {
      id: "synthetic-agreement", kind: "SUBSCRIPTION", tier: "BASIC", financeBook,
      paymentId: "synthetic-lp", paymentStatus: "SENT", customerName: "Synthetic customer",
      monthlyPrice: 100, oneTimeFee: null, clientId: "synthetic-client",
      cardcomRecurringId: null, cardcomDealId: null, cardcomToken: null,
      cardcomLowProfileId: null, invoiceNumber: null, email: "synthetic@example.invalid",
      phone: "0", locale: "he", vatExempt: false,
    };
    const tx = {
      agreement: { update: async () => agreement },
      client: { update: async (input: unknown) => { clientWrites.push(input); } },
    };
    const route = loadRoute<{ POST(request: unknown): Promise<Response> }>(
      new URL("../../app/api/payments/webhook/route.ts", import.meta.url), {
        "next/server": { NextResponse: Response, after: (callback: () => Promise<void>) => afterCallbacks.push(callback) },
        "@/lib/prisma": { prisma: { agreement: { findMany: async () => [agreement] }, $transaction: (callback: (db: unknown) => unknown) => callback(tx) } },
        "@/lib/agreements/one-time": { shouldCreateRecurringOrder },
        "@/lib/cardcom": { verifyLowProfilePayment: async () => ({ success: true, lowProfileId: "synthetic-lp", agreementId: agreement.id, transactionId: "synthetic-deal", amount: 118, occurredAt: paidAt, invoiceNumber: "synthetic-invoice", token: null }) },
        "@/lib/crypto": { encrypt: () => { throw new Error("No token to encrypt"); } },
        "@/lib/vat": { withVat },
        "@/lib/client-products": { applyPaymentToProduct: async (...args: unknown[]) => { productPayments.push(args.slice(1)); } },
        "@/lib/notifications": { notifyFinanceAdmins: async (...args: unknown[]) => { notifications.push(args); }, notifyOwner: async (...args: unknown[]) => { notifications.push(args); } },
        "@/lib/payments/recurring-notifications": {},
        "@/lib/email": { sendPaymentReceivedEmail: async (input: unknown) => { emails.push(input); } },
        "@/lib/leads/agreement-lifecycle": { applyPaymentSuccess: async (_db: unknown, input: unknown) => { lifecycleInputs.push(input); return { paymentRecorded: true, effects: [] }; }, runLeadPostCommitEffects: async (effects: unknown) => { postCommitEffects.push(effects); } },
        "@/lib/cardcom-webhook-auth": {},
        "@/lib/cardcom-recurring-charge": {},
      },
    );
    const response = await route.POST(new Request("https://example.invalid/api/payments/webhook", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ LowProfileId: "synthetic-lp" }) }));
    assert.equal(response.status, 200);
    assert.deepEqual(clientWrites, [{ where: { id: "synthetic-client" }, data: { paymentDate: paidAt, amount: { increment: 118 } } }]);
    assert.deepEqual(productPayments, [["synthetic-client", "synthetic-agreement", 118, paidAt]]);
    assert.equal(lifecycleInputs.length, 1);
    assert.deepEqual(postCommitEffects, [[]]);
    assert.equal(afterCallbacks.length, 1, "recurring setup remains scheduled, never executed in this test");
    assert.deepEqual(notifications, []);
    assert.deepEqual(emails, []);
  });
}
