import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();
const plan = JSON.parse(fs.readFileSync('/tmp/match-plan.json', 'utf8'));
console.log(`Applying ${plan.matches.length} URL updates...`);
const results = await prisma.$transaction(
  plan.matches.map((m) =>
    prisma.client.update({
      where: { id: m.clientId },
      data: { websiteUrl: m.url },
      select: { id: true, name: true, websiteUrl: true },
    })
  )
);
console.log(`✓ Updated ${results.length} clients:\n`);
for (const r of results) console.log(`  ${r.name} → ${r.websiteUrl}`);
await prisma.$disconnect();
