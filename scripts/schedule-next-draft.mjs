/**
 * תזמון המאמר הבא בתור לפרסום.
 *
 * הרצה: node scripts/schedule-next-draft.mjs [days]
 *   days = בעוד כמה ימים לפרסם (ברירת מחדל: 1 = מחר)
 *
 * הסקריפט לוקח את הטיוטה הישנה ביותר שעדיין לא תוזמנה,
 * מעביר אותה ל-SCHEDULED ומגדיר scheduledAt.
 * ה-cron ב-/api/cron/blog-publish יפרסם אותה אוטומטית.
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const daysFromNow = parseInt(process.argv[2] || '1', 10);

async function main() {
  // מצא את הטיוטה הבאה בתור (לפי סדר יצירה)
  const draft = await prisma.blogPost.findFirst({
    where: {
      status: { in: ['DRAFT', 'READY'] },
      published: false,
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, title: true, slug: true, status: true },
  });

  if (!draft) {
    console.log('אין טיוטות לתזמון.');
    await prisma.$disconnect();
    return;
  }

  // חשב את תאריך הפרסום — 7:00 UTC (10:00 ישראל)
  const publishDate = new Date();
  publishDate.setUTCDate(publishDate.getUTCDate() + daysFromNow);
  publishDate.setUTCHours(7, 0, 0, 0);

  await prisma.blogPost.update({
    where: { id: draft.id },
    data: {
      status: 'SCHEDULED',
      scheduledAt: publishDate,
    },
  });

  console.log(`✅ מאמר תוזמן לפרסום:`);
  console.log(`   כותרת: ${draft.title}`);
  console.log(`   slug: ${draft.slug}`);
  console.log(`   יפורסם ב: ${publishDate.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`);

  // הצג כמה טיוטות נשארו
  const remaining = await prisma.blogPost.count({
    where: { status: { in: ['DRAFT', 'READY'] }, published: false },
  });
  console.log(`\n📋 נשארו ${remaining} טיוטות בתור.`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
