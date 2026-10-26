import assert from "node:assert/strict";
import test from "node:test";
const settled = { status: "PAID", paidAt: new Date("2026-08-10T10:00:00Z"), amount: 200, vatIncluded: true, cardcomFee: false, closedAt: new Date("2026-08-01T10:00:00Z") };
async function api() { return await import("./job-write").catch(() => ({})) as typeof import("./job-write"); }
test("paid job amount, fee, VAT and receipt dates cannot be rewritten", async () => {
 const { jobPaymentUpdate } = await api(); assert.equal(typeof jobPaymentUpdate, "function");
 for (const patch of [{ amount: 999 }, { vatIncluded: false }, { cardcomFee: true }, { paidAt: "2026-10-26T00:00:00Z" }, { paidAt: null }, { closedAt: "2026-10-26T00:00:00Z" }, { status: "PENDING" }]) assert.throws(() => jobPaymentUpdate(settled, patch), /./, JSON.stringify(patch));
});
test("repeating PAID preserves the original receipt date", async () => {
 const { jobPaymentUpdate } = await api(); assert.equal(typeof jobPaymentUpdate, "function");
 assert.deepEqual(jobPaymentUpdate(settled, { status: "PAID" }, new Date("2026-10-26T00:00:00Z")), { status: "PAID" });
 assert.deepEqual(jobPaymentUpdate(settled, { amount: 200, paidAt: settled.paidAt.toISOString() }), { paidAt: settled.paidAt, status: "PAID" });
});
test("the first PAID transition assigns its own receipt date", async () => {
 const { jobPaymentUpdate } = await api(); assert.equal(typeof jobPaymentUpdate, "function");
 const now = new Date("2026-10-26T00:00:00Z");
 assert.deepEqual(jobPaymentUpdate({ ...settled, status: "PENDING", paidAt: null }, { status: "PAID" }, now), { status: "PAID", paidAt: now });
});
