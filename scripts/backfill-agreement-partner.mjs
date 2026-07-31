/**
 * Agreement.partnerId backfill — the single attribution source.
 *
 * Why: attribution had TWO disagreeing sources. Client.ownerId said who
 * generated the client; Agreement.creditedSellerId ?? createdBy said who
 * generated the deal. createdBy records who TYPED the agreement in (Elad
 * creates agreements on a partner's behalf), so the two contradicted each
 * other on 8 of 14 signed agreements.
 *
 * Rule (Elad's ruling): every existing agreement belongs to its client's
 * owner. So partnerId := client.ownerId, falling back to creditedSellerId
 * when there is no client (or the client has no owner). Neither → left null
 * (a house deal); createdBy is NEVER consulted.
 *
 * Idempotent: only writes rows whose partnerId differs from the target, so
 * re-running is a no-op. Dry-run by default; APPLY=1 to write.
 *
 *   node scripts/backfill-agreement-partner.mjs          # dry run
 *   APPLY=1 node scripts/backfill-agreement-partner.mjs  # write
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const APPLY = process.env.APPLY === "1";

const users = await p.user.findMany({
  select: { id: true, name: true, email: true, isOwner: true, role: true },
});
const nameOf = (id) => {
  if (!id) return "—";
  const u = users.find((x) => x.id === id);
  return u ? u.name || u.email : id;
};

const agreements = await p.agreement.findMany({
  select: {
    id: true,
    status: true,
    customerName: true,
    partnerId: true,
    creditedSellerId: true,
    createdBy: true,
    clientId: true,
    client: { select: { ownerId: true } },
  },
  orderBy: { createdAt: "asc" },
});

/** The contradiction test that found 8/14: what the client says the deal's
 *  partner is, versus what the agreement said before partnerId existed. */
const legacyAgreementSays = (a) => a.creditedSellerId ?? a.createdBy ?? null;
const contradictions = (agreementSays) =>
  agreements.filter(
    (a) =>
      a.status === "SIGNED" &&
      a.client?.ownerId &&
      agreementSays(a) !== a.client.ownerId,
  );

const signed = agreements.filter((a) => a.status === "SIGNED");
const before = contradictions(legacyAgreementSays);
console.log(`הסכמים סה"כ: ${agreements.length} · חתומים: ${signed.length}`);
console.log(
  `סתירות לפני (client.ownerId מול creditedSellerId ?? createdBy): ` +
    `${before.length}/${signed.length}`,
);
for (const a of before) {
  console.log(
    `  ✗ ${a.customerName} — לקוח: ${nameOf(a.client.ownerId)} · ` +
      `הסכם: ${nameOf(legacyAgreementSays(a))}`,
  );
}

const plan = [];
for (const a of agreements) {
  const target = a.client?.ownerId ?? a.creditedSellerId ?? null;
  if (!target) continue;
  if (a.partnerId === target) continue;
  plan.push({
    id: a.id,
    customerName: a.customerName,
    status: a.status,
    from: a.partnerId,
    to: target,
    source: a.client?.ownerId ? "client.ownerId" : "creditedSellerId",
  });
}

const counts = {};
for (const x of plan) counts[nameOf(x.to)] = (counts[nameOf(x.to)] ?? 0) + 1;
console.log(`\nהסכמים לשיוך: ${plan.length} ${JSON.stringify(counts)}`);
const noTarget = agreements.filter(
  (a) => !(a.client?.ownerId ?? a.creditedSellerId),
);
console.log(`ללא יעד שיוך (יישארו null — עסקת בית): ${noTarget.length}`);

// The count that WILL hold after applying: partnerId is the target for every
// planned row, and the current partnerId for the rest.
const afterPartnerId = (a) => {
  const planned = plan.find((x) => x.id === a.id);
  return planned ? planned.to : a.partnerId;
};
const afterSim = contradictions(afterPartnerId);
console.log(
  `סתירות אחרי (client.ownerId מול partnerId): ${afterSim.length}/${signed.length}`,
);
for (const a of afterSim) {
  console.log(
    `  ✗ ${a.customerName} — לקוח: ${nameOf(a.client.ownerId)} · ` +
      `הסכם: ${nameOf(afterPartnerId(a))}`,
  );
}

if (!APPLY) {
  console.log("\nDRY RUN — לא נכתב דבר. הרץ עם APPLY=1 כדי לכתוב.");
  await p.$disconnect();
  process.exit(0);
}

let written = 0;
for (const x of plan) {
  await p.agreement.update({
    where: { id: x.id },
    data: { partnerId: x.to },
  });
  written += 1;
}
console.log(`\nנכתבו ${written} הסכמים.`);

// Verify against the database, not against the plan.
const verify = await p.agreement.findMany({
  where: { status: "SIGNED" },
  select: {
    customerName: true,
    partnerId: true,
    client: { select: { ownerId: true } },
  },
});
const left = verify.filter(
  (a) => a.client?.ownerId && a.partnerId !== a.client.ownerId,
);
console.log(
  `סתירות אחרי (מדידה חוזרת מה-DB): ${left.length}/${verify.length} ` +
    `${left.length === 0 ? "✓" : "✗✗✗"}`,
);
for (const a of left) {
  console.log(
    `  ✗ ${a.customerName} — לקוח: ${nameOf(a.client.ownerId)} · ` +
      `הסכם: ${nameOf(a.partnerId)}`,
  );
}
const dist = await p.agreement.groupBy({ by: ["partnerId"], _count: true });
console.log("\nפיזור partnerId:");
for (const d of dist) console.log(`  ${nameOf(d.partnerId)}: ${d._count}`);

await p.$disconnect();
