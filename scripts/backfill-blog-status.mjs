import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const publishedResult = await prisma.blogPost.updateMany({
  where: { published: true },
  data: { status: 'PUBLISHED' },
});

const draftResult = await prisma.blogPost.updateMany({
  where: { published: false },
  data: { status: 'DRAFT' },
});

console.log(`Backfill complete:`);
console.log(`  PUBLISHED: ${publishedResult.count} rows`);
console.log(`  DRAFT:     ${draftResult.count} rows`);

await prisma.$disconnect();
