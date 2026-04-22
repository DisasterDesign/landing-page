import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();
const updates = JSON.parse(fs.readFileSync('/tmp/extra-updates.json', 'utf8'));
console.log(`Applying ${updates.length} extra URL updates...\n`);
const results = await prisma.$transaction(
  updates.map((u) =>
    prisma.client.update({
      where: { id: u.id },
      data: { websiteUrl: u.url },
      select: { name: true, websiteUrl: true, number: true },
    })
  )
);
for (const r of results) console.log(`  ✓ ${r.name} (#${r.number}) → ${r.websiteUrl}`);

console.log('\n=== Clients still without a URL ===');
const empty = await prisma.client.findMany({
  where: { websiteUrl: null, archivedAt: null },
  select: { number: true, name: true, businessName: true },
  orderBy: { number: 'asc' },
});
for (const c of empty) {
  console.log(`  · #${c.number} ${c.name}${c.businessName ? ' / ' + c.businessName : ''}`);
}
console.log(`\nTotal still empty: ${empty.length}`);
await prisma.$disconnect();
