/**
 * Partner-model backfill (stage 2). Idempotent; APPLY=1 to write.
 * - Elad → isOwner
 * - Roy  → revenueSharePct 50
 * - Client.ownerId: first agreement's creditedSellerId → createdBy → Roy for
 *   partnership-era clients (Elad's instruction: "כל ההסכמים הקיימים של
 *   רועי"), Elad for legacy/private (partner != "fuzion").
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const APPLY = process.env.APPLY === "1";

const elad = await p.user.findUnique({ where: { email: "davidalelad@gmail.com" }, select: { id: true } });
const roy = await p.user.findUnique({ where: { email: "roy@fuzionwebz.com" }, select: { id: true } });
if (!elad || !roy) throw new Error("missing users");

// snapshot totals BEFORE (must be identical after — backfill changes no money)
const totals = async () => {
  const clients = await p.client.findMany({ where: { status: "בוצע", partner: "fuzion", archivedAt: null }, select: { monthlyAmount: true } });
  return clients.reduce((s, c) => s + (c.monthlyAmount ?? 0), 0);
};
const before = await totals();
console.log(`MRR לפני: ₪${before.toFixed(2)}`);

const clients = await p.client.findMany({
  select: { id: true, name: true, partner: true, ownerId: true,
    agreements: { orderBy: { createdAt: "asc" }, take: 1, select: { creditedSellerId: true, createdBy: true } } },
});
const plan = [];
for (const c of clients) {
  if (c.ownerId) continue;
  const a = c.agreements[0];
  const owner =
    a?.creditedSellerId ??
    (c.partner === "fuzion" ? roy.id : elad.id);
  plan.push({ id: c.id, name: c.name, owner: owner === roy.id ? "roy" : owner === elad.id ? "elad" : owner });
}
const counts = {};
for (const x of plan) counts[x.owner] = (counts[x.owner] ?? 0) + 1;
console.log(`לקוחות לשיוך: ${plan.length}`, JSON.stringify(counts));

if (!APPLY) { console.log("DRY RUN"); await p.$disconnect(); process.exit(0); }

await p.user.update({ where: { id: elad.id }, data: { isOwner: true } });
await p.user.update({ where: { id: roy.id }, data: { revenueSharePct: 50 } });
for (const x of plan) {
  await p.client.update({ where: { id: x.id }, data: { ownerId: x.owner === "roy" ? roy.id : x.owner === "elad" ? elad.id : x.owner } });
}
const after = await totals();
console.log(`MRR אחרי: ₪${after.toFixed(2)} — ${after === before ? "זהה ✓" : "שונה ✗✗✗"}`);
const orphans = await p.client.count({ where: { ownerId: null } });
console.log(`לקוחות ללא בעלים: ${orphans}`);
const dist = await p.client.groupBy({ by: ["ownerId"], _count: true });
for (const d of dist) console.log(`  ${d.ownerId === roy.id ? "רועי" : d.ownerId === elad.id ? "אלעד" : d.ownerId}: ${d._count}`);
await p.$disconnect();
