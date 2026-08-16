/**
 * What "delete client" is allowed to mean.
 *
 * On 2026-08 four clients with ₪0 monthly and no status looked like empty rows
 * and were hard-deleted from /admin/clients. onDelete: Cascade took three
 * ClientJobs — ₪4,000 of one-off work — with them, and Neon's 6-hour history
 * window had long closed. Nothing could bring them back.
 *
 * The rule: a client with ANY financial trace is archived, never deleted. Only
 * a client that never touched money — no jobs, agreements, charges, products
 * or linked expenses — may actually be removed. The UI keeps one "delete"
 * button; this decides which of the two it does, and says why.
 */

export interface ClientHistory {
  jobs: number;
  agreements: number;
  charges: number;
  products: number;
  expenses: number;
}

export type DeletionDecision =
  | { action: "delete"; reason: "" }
  | { action: "archive"; reason: string };

export function decideClientDeletion(h: ClientHistory): DeletionDecision {
  const found: string[] = [];
  if (h.jobs) found.push(`${h.jobs} עבודות חד-פעמיות`);
  if (h.agreements) found.push(`${h.agreements} הסכמים`);
  if (h.charges) found.push(`${h.charges} חיובים`);
  if (h.products) found.push(`${h.products} מוצרים`);
  if (h.expenses) found.push(`${h.expenses} הוצאות מקושרות`);

  if (found.length === 0) return { action: "delete", reason: "" };
  return {
    action: "archive",
    reason: `ללקוח יש ${found.join(", ")} — הוא הועבר לארכיון במקום להימחק, כדי שההיסטוריה הכספית תישמר.`,
  };
}
