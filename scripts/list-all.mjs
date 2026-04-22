import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const all = await prisma.client.findMany({
  where: { archivedAt: null },
  select: { number: true, name: true, websiteUrl: true, businessName: true, createdAt: true },
  orderBy: { createdAt: 'asc' },
});
console.log(`=== ${all.length} active clients ===\n`);
for (const c of all) {
  const flag = c.websiteUrl ? '✓' : '✗';
  console.log(`  ${flag} #${String(c.number).padStart(2)} ${c.name.padEnd(22)} ${c.websiteUrl ?? '(no url)'}`);
}
console.log(`\n${all.filter(c=>c.websiteUrl).length}/${all.length} have URLs.`);
console.log(`Without URL: ${all.filter(c=>!c.websiteUrl).map(c=>c.name).join(', ')}`);
await prisma.$disconnect();
