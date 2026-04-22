import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const ops = [
  { op: 'delete', id: 'cmo8ibi2s000047l7x975ua64', name: 'עמית שוורץ' },
  { op: 'update', id: 'seed-client-2', name: 'בגט התרנגול', data: { websiteUrl: 'https://baguette-hatarnegol.pages.dev/' } },
  { op: 'update', id: 'seed-client-13', name: 'עולם הממתקים', data: { websiteUrl: 'https://olamhamamtakim.co.il/' } },
  { op: 'update', id: 'seed-client-14', name: 'טיפטים → נתן ארט', data: { name: 'נתן ארט', websiteUrl: 'https://natansart.com/' } },
  { op: 'update', id: 'seed-client-15', name: 'טיקטס → פיקס טיקטס', data: { name: 'פיקס טיקטס', websiteUrl: 'https://fixtickets.co.il/' } },
  { op: 'update', id: 'seed-client-19', name: 'jumarie', data: { websiteUrl: 'https://jumarie.co/en' } },
  { op: 'update', id: 'seed-client-21', name: 'יוני המבורגר', data: { websiteUrl: 'https://burger-yoni-71.pages.dev/' } },
  { op: 'update', id: 'seed-client-22', name: 'יוני שווארמה', data: { websiteUrl: 'https://yoni71.davidalelad.workers.dev/' } },
];

const tx = ops.map((o) =>
  o.op === 'delete'
    ? prisma.client.delete({ where: { id: o.id }, select: { name: true } })
    : prisma.client.update({ where: { id: o.id }, data: o.data, select: { name: true, websiteUrl: true, number: true } })
);
const results = await prisma.$transaction(tx);
for (let i = 0; i < ops.length; i++) {
  const o = ops[i], r = results[i];
  if (o.op === 'delete') console.log(`  ✗ DELETED ${o.name}`);
  else console.log(`  ✓ ${o.name}: ${r.name} → ${r.websiteUrl}`);
}

console.log('\n=== Clients still without URL ===');
const empty = await prisma.client.findMany({
  where: { websiteUrl: null, archivedAt: null },
  select: { number: true, name: true },
  orderBy: { number: 'asc' },
});
for (const c of empty) console.log(`  · #${c.number} ${c.name}`);
console.log(`\nTotal still empty: ${empty.length}`);

console.log('\n=== Duplicate "נתן ארט" check ===');
const dups = await prisma.client.findMany({
  where: { name: 'נתן ארט', archivedAt: null },
  select: { id: true, number: true, name: true, websiteUrl: true, createdAt: true, agreements: { select: { id: true } } },
});
for (const d of dups) console.log(`  · #${d.number} ${d.name} (${d.id}) — ${d.websiteUrl} — ${d.agreements.length} agreements — created ${d.createdAt.toISOString()}`);
await prisma.$disconnect();
