/**
 * Monthly expense sweep — 2.9.2026. Gmail window 29.7–2.9.2026.
 * Every figure below is invoice-evidenced; the `why` says which invoice.
 *
 * Unchanged policy from the 14.8 audit: the Cardcom ~2% clearing commission is
 * NOT an expense row (the revenue side already nets it out), and personal
 * purchases on the business card are excluded — the YouTube Premium price
 * rise (₪31.90 → ₪38.90 from 22.9, Apple mail 26.8) is deliberately ignored.
 *
 * One-time domain buys stay out of the recurring ledger, same as last sweep:
 * Cloudflare IN-74447431 $31.38 (maslulmath.com, 8.8) and GoDaddy order
 * 4174696516 ₪42.58 (shai-projects.com transfer, 30.8) are client-billable
 * one-offs. Their RENEWAL, however, does belong — see the GoDaddy row.
 *
 * Dry run (default):  npx tsx scripts/update-expense-ledger-2026-09.ts
 * Apply:              APPLY=1 npx tsx scripts/update-expense-ledger-2026-09.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.env.APPLY === "1";

async function main() {
  console.log(apply ? "MODE: APPLY\n" : "MODE: DRY RUN\n");

  const updates: Array<{ match: string; data: Record<string, unknown>; why: string }> = [
    {
      match: "Neon — Launch Plan",
      data: {
        amount: 75.92,
        isFixed: false,
        notes:
          'usage-based ומתפוצץ: KITVUJ-00001 $9.20 (1.8) → KITVUJ-00002 $75.92 (1.9), פי 8.25 בחודש אחד. התראות spending ב-10.8, 12.8, 19.8, 26.8. זה ה-DB של האפליקציה ושל החנויות — לבדוק מיד מי צורך compute (branches פתוחים? autoscaling?) לפני שזה חוזר בספטמבר.',
      },
      why: "$9.20 → $75.92 לפי חשבונית KITVUJ-00002 מ-1.9",
    },
    {
      match: "Claude API credits",
      data: {
        amount: 30,
        notes:
          "טעינה אוטומטית $10 כשהיתרה נגמרת. אוגוסט בפועל: $10.01 (3.8) + $10.01 (17.8) + $10.00 (27.8) = $30.02 — שלוש טעינות בחודש מול ממוצע $11.5 שנמדד אפר-יולי. הקצב הכפיל את עצמו; אם ספטמבר דומה זו כבר הוצאה קבועה ולא נגררת.",
      },
      why: "$11.5 → $30 לפי 3 קבלות אוגוסט (סה\"כ $30.02)",
    },
    {
      match: "Cloudflare — תוכנית בתשלום",
      data: {
        amount: 5.06,
        notes:
          "חשבונית IN-76326243 $5.06 ב-23.8 (נמשך ב-23 לחודש). ה-addons של titans.global בוטלו 23.8. רישומי דומיינים חדשים מגיעים באותו חשבון אך הם חד-פעמיים ואינם כאן.",
      },
      why: "$5.00 → $5.06 לפי החשבונית בפועל",
    },
    {
      match: "חידושי דומיינים GoDaddy",
      data: {
        amount: 1303,
        notes:
          "14 דומיינים (נוסף shai-projects.com, הועבר 30.8, מתחדש 30.8.2027 ב-₪80). חידוש ראשון בפועל: disaster-design.com ב-3.9.2026 — כלומר החידושים מתחילים החודש, לא בנוב-דצמ. השורה עדיין active=false: להחליט אם להפעיל (₪108.58/חודש לשותפות).",
      },
      why: "₪1,223 → ₪1,303 (+shai-projects.com)",
    },
    {
      match: "Magnific",
      data: {
        notes:
          "⚠️ בוטל 14.8.2026 — אבל ב-18.8 נגבו ₪132 (חשבונית Stripe, status=paid). או חיוב אחרון לתקופה שכבר התחילה, או שהביטול לא נתפס. לבדוק בדף החיובים; אם יגיע חיוב נוסף בספטמבר — הביטול נכשל ויש להחזיר את השורה ל-active.",
      },
      why: "חיוב ₪132 ב-18.8 אחרי הביטול",
    },
    {
      match: "שרת Hetzner — HIGOLD",
      data: {
        notes:
          "CPX22 $9.49 + IPv4 $0.60. חשבונית אוגוסט 087001087145 נדחתה 2.8 ותזכורת 12.8 — אין דרישות המשך אחרי 13.8, כנראה שולמה ידנית. חשבונית ספטמבר 089001144596 $31.86 (1.9) מכסה את כל 4 השרתים ומסתדרת בדיוק: 10.09+5.59+10.09+6.09.",
      },
      why: "סגירת מעקב על החיוב שנדחה באוגוסט",
    },
    {
      match: "Google Workspace",
      data: {
        notes:
          "3 משתמשים × ₪58.80. ⚠️ התשלום נכשל — מייל Google מ-1.9.2026: אם לא יוסדר, השירות מושעה לכל המשתמשים ב-5.10.2026. החשבוניות בקונסולת האדמין של טננט disaster-design, לא בג'ימייל.",
      },
      why: "תשלום שנכשל 1.9 — דדליין השעיה 5.10",
    },
    {
      match: "הנהלת חשבונות",
      data: {
        notes:
          '₪400 שכ"ט + ₪35 Finbot + מע"מ 18% = ₪513.30, נמשך ב-25 לחודש בקארדקום. ⚠️ החיוב על כרטיס 2727 נכשל ב-25.8 ושוב ב-2.9 (מיילים מ-out.cardcom.co.il), ואין חשבונית מרובר באוגוסט — האחרונה היא 14095 מ-25.7. כלומר חודש אוגוסט לא שולם לרו"ח.',
      },
      why: "חיוב נכשל 25.8 + 2.9, אין חשבונית אוגוסט",
    },
  ];

  for (const u of updates) {
    const row = await prisma.expense.findFirst({
      where: { name: { contains: u.match } },
      select: { id: true, name: true, amount: true, currency: true },
    });
    if (!row) { console.log(`  !! not found: ${u.match}`); continue; }
    const amt = "amount" in u.data ? ` ${row.amount} → ${u.data.amount} ${row.currency}` : " (note only)";
    console.log(`  ${apply ? "UPDATE" : "WOULD "} ${row.name.slice(0, 34).padEnd(36)}${amt.padEnd(26)} (${u.why})`);
    if (apply) await prisma.expense.update({ where: { id: row.id }, data: u.data });
  }

  // No new vendors this sweep. The catch-all over 29.7–2.9 turned up no
  // unrecognised biller: every receipt maps to a row that already exists.
  console.log("\n  (no new vendors found in the window)");

  console.log(apply ? "\ndone." : "\nRe-run with APPLY=1 to write.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error("FAILED:", e.message); await prisma.$disconnect(); process.exit(1); });
