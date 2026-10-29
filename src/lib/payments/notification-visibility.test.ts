import assert from "node:assert/strict";
import test from "node:test";
import { loadRoute } from "./route-harness";

type Row = Record<string, unknown>;
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "AND") return (Array.isArray(value) ? value : [value]).every((part) => matches(row, part));
    if (key === "OR") return (value as Row[]).some((part) => matches(row, part));
    if (key === "NOT") return !(Array.isArray(value) ? value : [value]).some((part) => matches(row, part));
    const actual = row[key];
    if (value !== null && typeof value === "object") {
      const filter = value as Row;
      if ("not" in filter) return actual !== filter.not;
      if ("notIn" in filter) return !(filter.notIn as unknown[]).includes(actual);
      if ("startsWith" in filter) return typeof actual === "string" && actual.startsWith(filter.startsWith as string);
      if ("none" in filter) return !(actual as Row[]).some((part) => matches(part, filter.none as Row));
      return actual !== null && typeof actual === "object" && matches(actual as Row, filter);
    }
    return actual === value;
  });
}

for (const isOwner of [false, true]) {
  test(`${isOwner ? "owner" : "partner"} notification list and unread count hide exact historical successes and preserve actionable alerts`, async () => {
    const base = { recipientId: "viewer", readAt: null, type: "AGREEMENT_SIGNED", taskId: null, leadId: null, dedupeKey: "finance:SHARED:synthetic" };
    const rows: Row[] = [
      ...["תשלום התקבל — ", "💰 חיוב חודשי התקבל — ", "💰 חיוב חודשי התגלה בסנכרון — ", "העסקה שולמה — "].map((prefix, index) => ({ ...base, id: `success-${index}`, title: `${prefix}Synthetic` })),
      { ...base, id: "lost", type: "PAYMENT_MISMATCH", title: "תשלום התקבל לאחר שהליד סומן כאבוד" },
      { ...base, id: "different-type", type: "PAYMENT_MISMATCH", title: "תשלום התקבל — Synthetic" },
      { ...base, id: "failure", title: "⚠️ חיוב נכשל — Synthetic" },
      { ...base, id: "foreign-check", title: "🌍 הוראת קבע ללקוח חו״ל נוצרה — Synthetic" },
      { ...base, id: "body-match", title: "נדרשת בדיקה", body: "תשלום התקבל — Synthetic" },
      { ...base, id: "near-prefix", title: "בירור תשלום התקבל — Synthetic" },
      { ...base, id: "private", dedupeKey: "finance:PRIVATE:synthetic", title: "⚠️ חיוב נכשל — PRIVATE_SECRET" },
      { ...base, id: "private-task", taskId: "private-task", task: { id: "private-task" }, title: "משימה פרטית" },
      { ...base, id: "mixed-lead", leadId: "mixed-lead", lead: { agreements: [{ financeBook: "SHARED" }, { financeBook: "PRIVATE" }] }, title: "ליד מעורב" },
      { ...base, id: "already-read", readAt: new Date("2026-10-01"), title: "התראה שנקראה" },
      { ...base, id: "other-recipient", recipientId: "other", title: "לא שלי" },
    ];
    const whereQueries: Row[] = [];
    const route = loadRoute<{ GET(): Promise<Response> }>(new URL("../../app/api/notifications/route.ts", import.meta.url), {
      "next/server": { NextResponse: Response },
      "@/lib/auth": { auth: async () => ({ user: { id: "viewer" } }) },
      "@/lib/auth/viewer": { getViewer: async () => ({ isOwner }), viewerErrorResponse: () => null },
      "@/lib/finance/task-access": { financeTaskScope: async () => ({ id: { notIn: ["private-task"] } }) },
      "@/lib/prisma": { prisma: { notification: {
        findMany: async ({ where }: { where: Row }) => { whereQueries.push(where); return rows.filter((row) => matches(row, where)); },
        count: async ({ where }: { where: Row }) => { whereQueries.push(where); return rows.filter((row) => matches(row, where)).length; },
      } } },
    });
    const response = await route.GET();
    assert.equal(response.status, 200);
    const result = await response.json();
    const expected = ["lost", "different-type", "failure", "foreign-check", "body-match", "near-prefix", ...(isOwner ? ["private", "private-task", "mixed-lead"] : []), "already-read"];
    assert.deepEqual(result.notifications.map((row: Row) => row.id), expected);
    assert.equal(result.unreadCount, expected.length - 1);
    assert.equal(whereQueries.length, 2);
    assert.equal(rows.length, 15, "reading leaves notification history intact");
  });
}
