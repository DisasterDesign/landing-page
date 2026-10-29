import assert from "node:assert/strict";
import test from "node:test";
import type { Viewer } from "../auth/viewer";
const owner: Viewer = { userId: "elad", isOwner: true, role: "ADMIN", revenueSharePct: null };
const roy: Viewer = { ...owner, userId: "roy", isOwner: false };
const seller: Viewer = { ...roy, userId: "seller", role: "SELLER" };
async function access() { return await import("./access").catch(() => ({})) as typeof import("./access"); }
test("persisted owner can read every book; Roy reads only explicit SHARED", async () => {
 const a = await access(); assert.equal(typeof a.canReadFinanceBook, "function");
 for (const book of ["PRIVATE", "SHARED", "UNASSIGNED"] as const) assert.equal(a.canReadFinanceBook(owner, book), true);
 assert.equal(a.canReadFinanceBook(roy, "SHARED"), true);
 for (const book of ["PRIVATE", "UNASSIGNED", undefined, null, "personal"]) assert.equal(a.canReadFinanceBook(roy, book), false);
});
test("seller scope requires own relationship AND shared book", async () => {
 const a = await access(); assert.equal(typeof a.financeAgreementScope, "function");
 const scope = a.financeAgreementScope(seller);
 assert.equal(JSON.stringify(scope).includes('"financeBook":"SHARED"'), true);
 assert.equal(JSON.stringify(scope).includes('"seller"'), true);
 assert.deepEqual(a.financeAgreementScope(roy), { financeBook: "SHARED" });
 assert.deepEqual(a.financeAgreementScope(owner), {});
});
test("only owner selects book and omission preserves stored attribution", async () => {
 const a = await access(); assert.equal(typeof a.requireBookSelection, "function");
 assert.equal(a.requireBookSelection(owner, undefined, "PRIVATE"), "PRIVATE");
 assert.equal(a.requireBookSelection(owner, "SHARED", "PRIVATE"), "SHARED");
 assert.equal(a.requireBookSelection(roy, undefined, "SHARED"), "SHARED");
 assert.throws(() => a.requireBookSelection(roy, "SHARED", "SHARED"));
 assert.throws(() => a.requireBookSelection(owner, "personal", "PRIVATE"));
 assert.throws(() => a.requireBookSelection(roy, undefined, "PRIVATE"));
});
test("mixed client projection excludes private children and recomputes money", async () => {
 const a = await access(); assert.equal(typeof a.redactFinanceClient, "function");
 const client = { id: "mixed", partner: "personal", amount: 9999, expense: 111, cardcomFee: 22, monthlyAmount: 1200, products: [{ id: "s", financeBook: "SHARED", status: "בוצע", monthlyAmount: 200 }, { id: "p", financeBook: "PRIVATE", monthlyAmount: 1000 }], agreements: [{ id: "secret", financeBook: "PRIVATE", signToken: "token" }, { id: "shared", financeBook: "SHARED" }] };
 const result = a.redactFinanceClient(roy, client);
 assert.equal(result.monthlyAmount, 200);
 assert.deepEqual(result.products.map(p => p.id), ["s"]);
 assert.deepEqual(result.agreements.map(p => p.id), ["shared"]);
 assert.equal("amount" in result, false); assert.equal("expense" in result, false); assert.equal("partner" in result, false);
 assert.equal(JSON.stringify(result).includes("token"), false);
});
test("financial history prevents book reclassification", async () => {
 const a = await access(); assert.equal(typeof a.requireUnpaidBookChange, "function");
 assert.throws(() => a.requireUnpaidBookChange("PRIVATE", "SHARED", true));
 assert.doesNotThrow(() => a.requireUnpaidBookChange("PRIVATE", "PRIVATE", true));
 assert.doesNotThrow(() => a.requireUnpaidBookChange("PRIVATE", "SHARED", false));
});
test("shared agreement projections redact stored payment credentials and mixed client totals", async () => {
 const a = await access(); assert.equal(typeof a.redactFinanceAgreement, "function");
 const result = a.redactFinanceAgreement(roy, { id: "s", signToken: "shared-link", cardcomToken: "card-secret", cardcomLowProfileId: "low-profile", signatureData: "signature", client: { id: "c", name: "name", amount: 1200, notes: "private" } });
 assert.equal("cardcomToken" in result, false);
 assert.equal("cardcomLowProfileId" in result, false);
 assert.equal("signatureData" in result, false);
 assert.deepEqual(result.client, { id: "c", name: "name" });
 assert.equal(result.signToken, "shared-link");
});

test("shared unknown valuations stay unknown without leaking private product gaps", async () => {
 const a = await access();
 const unvalued = { financeBook: "SHARED", status: "בוצע", monthlyAmount: null };
 const valued = { financeBook: "SHARED", status: "בוצע", monthlyAmount: 50 };
 assert.equal(a.redactFinanceClient(roy, { monthlyAmount: 999, products: [unvalued, valued] }).monthlyAmount, null);
 assert.equal(a.redactFinanceClient(roy, { monthlyAmount: null, products: [{ ...unvalued, financeBook: "PRIVATE" }, valued] }).monthlyAmount, 50);
});
