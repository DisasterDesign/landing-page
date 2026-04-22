import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const clients = await prisma.client.findMany({
  select: { id: true, number: true, name: true, businessName: true, websiteUrl: true, archivedAt: true },
  orderBy: { number: 'asc' },
});
console.log(JSON.stringify(clients, null, 2));
await prisma.$disconnect();
