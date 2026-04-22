/**
 * תזמון כל הטיוטות — 2 מאמרים בשבוע: ראשון + רביעי ב-07:00 UTC (10:00 ישראל).
 *
 * הרצה: node scripts/schedule-all-drafts.mjs
 */

import { PrismaClient } from '@prisma/client';
import {
  nextSunday,
  addDays,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  startOfDay,
} from 'date-fns';

const prisma = new PrismaClient();

function nextSundayAt7UTC(from) {
  const base = startOfDay(from);
  const sunday = from.getUTCDay() === 0 ? base : nextSunday(base);
  return setMilliseconds(
    setSeconds(setMinutes(setHours(sunday, 7), 0), 0),
    0
  );
}

const HEBREW_DAY = { 0: 'ראשון', 3: 'רביעי' };

const candidates = await prisma.blogPost.findMany({
  where: {
    status: { in: ['DRAFT', 'READY', 'SCHEDULED'] },
  },
  orderBy: { createdAt: 'asc' },
  select: { id: true, title: true, slug: true, status: true },
});

if (candidates.length === 0) {
  console.log('אין מאמרים לתזמון.');
  await prisma.$disconnect();
  process.exit(0);
}

const firstSunday = nextSundayAt7UTC(new Date());

const plan = [];
let cursor = firstSunday;
for (let i = 0; i < candidates.length; i++) {
  plan.push({ ...candidates[i], scheduledAt: new Date(cursor) });
  // אחרי ראשון → +3 ימים לרביעי. אחרי רביעי → +4 ימים לראשון.
  cursor = addDays(cursor, i % 2 === 0 ? 3 : 4);
}

console.log(`\nמתזמן ${plan.length} מאמרים — ראשון + רביעי, 07:00 UTC (10:00 ישראל):\n`);
console.log('  #   תאריך       יום      כותרת');
console.log('  --  ----------  ------   --------------------');
for (let i = 0; i < plan.length; i++) {
  const row = plan[i];
  const d = row.scheduledAt;
  const dateStr = d.toISOString().slice(0, 10);
  const day = HEBREW_DAY[d.getUTCDay()] ?? String(d.getUTCDay());
  const num = String(i + 1).padStart(2, ' ');
  console.log(`  ${num}  ${dateStr}  ${day.padEnd(6, ' ')}   ${row.title.slice(0, 70)}`);
}

await prisma.$transaction(
  plan.map((row) =>
    prisma.blogPost.update({
      where: { id: row.id },
      data: { status: 'SCHEDULED', scheduledAt: row.scheduledAt },
    })
  )
);

const firstDate = plan[0].scheduledAt.toISOString().slice(0, 10);
const lastDate = plan[plan.length - 1].scheduledAt.toISOString().slice(0, 10);

console.log(`\nבוצע:`);
console.log(`  תוזמנו: ${plan.length}`);
console.log(`  ראשון:  ${firstDate}`);
console.log(`  אחרון:  ${lastDate}`);

await prisma.$disconnect();
