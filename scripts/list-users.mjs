import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const users = await prisma.user.findMany({
  select: { id: true, email: true, name: true, role: true, createdAt: true },
  orderBy: { createdAt: 'asc' },
});
console.log(JSON.stringify(users, null, 2));
await prisma.$disconnect();
