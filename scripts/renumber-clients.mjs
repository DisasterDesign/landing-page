import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 1. Snapshot: financial fields for verification
const before = await prisma.client.findMany({
  where: { archivedAt: null },
  select: {
    id: true, number: true, name: true,
    amount: true, expense: true, cardcomFee: true,
    websiteUrl: true,
  },
  orderBy: { createdAt: 'asc' },
});
console.log(`Snapshot: ${before.length} active clients`);

// 2. Renumber via two-pass to avoid any in-transaction conflicts
//    (number has only @@index — no unique — but two-pass is cheap insurance).
const ops = [];
// Pass A: shift everyone to a safe high range (id-based offset)
before.forEach((c, i) => {
  ops.push(prisma.client.update({
    where: { id: c.id },
    data: { number: 100000 + i },
    select: { id: true },
  }));
});
// Pass B: assign final 1..N
before.forEach((c, i) => {
  ops.push(prisma.client.update({
    where: { id: c.id },
    data: { number: i + 1 },
    select: { id: true },
  }));
});
await prisma.$transaction(ops);
console.log(`Renumbered to 1..${before.length}.`);

// 3. Bump the Postgres sequence so future inserts continue from N+1
//    Prisma model `Client` → table `Client`, autoincrement column `number`
//    → default sequence name `Client_number_seq`.
await prisma.$executeRawUnsafe(`SELECT setval('"Client_number_seq"', ${before.length}, true)`);
console.log(`Sequence Client_number_seq advanced to ${before.length} (next insert = ${before.length + 1}).`);

// 4. Verify: re-read and confirm financial fields untouched
const after = await prisma.client.findMany({
  where: { archivedAt: null },
  select: {
    id: true, number: true, name: true,
    amount: true, expense: true, cardcomFee: true,
    websiteUrl: true,
  },
  orderBy: { number: 'asc' },
});

const beforeById = new Map(before.map(c => [c.id, c]));
let drift = 0;
for (const a of after) {
  const b = beforeById.get(a.id);
  if (b.amount !== a.amount || b.expense !== a.expense || b.cardcomFee !== a.cardcomFee || b.websiteUrl !== a.websiteUrl || b.name !== a.name) {
    console.log(`  ⚠ DRIFT on ${a.name} (${a.id})`);
    drift++;
  }
}
if (drift === 0) console.log(`✓ All financial + url + name fields intact (${after.length} clients verified).`);

console.log('\n=== Final order ===');
for (const a of after) {
  const b = beforeById.get(a.id);
  const url = a.websiteUrl ? '✓' : '✗';
  console.log(`  ${url} #${String(a.number).padStart(2)} (was #${String(b.number).padStart(2)})  ${a.name}`);
}

// Check uniqueness
const nums = after.map(c => c.number);
const dupes = nums.filter((n, i) => nums.indexOf(n) !== i);
console.log(`\nUnique numbers: ${dupes.length === 0 ? '✓ all unique' : '✗ duplicates: ' + dupes.join(',')}`);
console.log(`Range: ${Math.min(...nums)} .. ${Math.max(...nums)}`);

await prisma.$disconnect();
