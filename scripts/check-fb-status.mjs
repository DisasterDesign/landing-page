import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const integ = await prisma.facebookIntegration.findMany({
  select: { pageId: true, pageName: true, subscribedAt: true, createdAt: true },
});
console.log('FacebookIntegration rows:', integ.length);
integ.forEach(i => console.log(`  · ${i.pageName} (${i.pageId}) — subscribed=${i.subscribedAt ? 'yes' : 'no'}`));

const fbLeads = await prisma.contactSubmission.count({
  where: { source: 'facebook_lead_ads' },
});
const totalLeads = await prisma.contactSubmission.count();
console.log(`\nContactSubmission: ${totalLeads} total, ${fbLeads} from Facebook lead ads`);
await prisma.$disconnect();
