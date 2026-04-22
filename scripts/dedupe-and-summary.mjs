import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Delete the duplicate נתן ארט (#14, the one that was originally "טיפטים")
await prisma.client.delete({ where: { id: 'seed-client-14' } });
console.log('✗ Deleted duplicate נתן ארט (#14, originally "טיפטים")');

// Show דוריאל and current number-duplicate situation
const dorielk = await prisma.client.findFirst({
  where: { name: { contains: 'דוריאל' } },
  select: { number: true, name: true, websiteUrl: true },
});
console.log(`\nדוריאל: #${dorielk.number} ${dorielk.name} → ${dorielk.websiteUrl}`);

// All clients sorted by name
const all = await prisma.client.findMany({
  where: { archivedAt: null },
  select: { id: true, number: true, name: true, websiteUrl: true, businessName: true, source: true, createdAt: true },
  orderBy: { number: 'asc' },
});
console.log(`\n=== All ${all.length} active clients ===`);
const byNumber = new Map();
for (const c of all) {
  if (!byNumber.has(c.number)) byNumber.set(c.number, []);
  byNumber.get(c.number).push(c);
}
for (const [num, list] of byNumber) {
  if (list.length > 1) {
    console.log(`\n  ⚠ #${num} has ${list.length} clients:`);
    for (const c of list) {
      const url = c.websiteUrl ? '✓' : '✗';
      console.log(`      ${url} ${c.name}${c.businessName ? ' ('+c.businessName+')' : ''}  src=${c.source ?? 'manual'}  ${c.id}`);
    }
  }
}
console.log(`\nTotal: ${all.length} active clients`);
console.log(`Without URL: ${all.filter(c => !c.websiteUrl).length}`);
console.log(`Number collisions: ${[...byNumber.values()].filter(v => v.length > 1).length} numbers shared by ${[...byNumber.values()].filter(v => v.length > 1).reduce((s,v)=>s+v.length,0)} clients`);
await prisma.$disconnect();
