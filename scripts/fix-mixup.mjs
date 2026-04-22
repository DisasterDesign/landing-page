import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const fixes = await prisma.$transaction([
  prisma.client.update({
    where: { id: 'seed-client-2' },
    data: { websiteUrl: 'https://www.dorielk.com' },
    select: { name: true, websiteUrl: true },
  }),
  prisma.client.update({
    where: { id: 'cmo17z5z10000qgbuuhv41o6a' },
    data: { websiteUrl: 'https://baguette-hatarnegol.pages.dev/' },
    select: { name: true, websiteUrl: true },
  }),
]);
for (const r of fixes) console.log(`  ✓ ${r.name} → ${r.websiteUrl}`);

console.log('\n=== Clients still without URL ===');
const empty = await prisma.client.findMany({
  where: { websiteUrl: null, archivedAt: null },
  select: { number: true, name: true },
  orderBy: { number: 'asc' },
});
for (const c of empty) console.log(`  · #${c.number} ${c.name}`);
console.log(`\nTotal still empty: ${empty.length}`);
await prisma.$disconnect();
