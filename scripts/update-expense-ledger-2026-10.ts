/**
 * Monthly expense sweep — 2.10.2026. Gmail window 29.8–2.10.2026.
 * Every figure below is invoice-evidenced; the `why` says which invoice.
 *
 * Unchanged policy from the 14.8 audit: the Cardcom ~2% clearing commission is
 * NOT an expense row (the revenue side already nets it out), and personal
 * purchases on the business card are excluded — Apple TV (22.9) and YouTube
 * Premium (5.9), both on Visa 9024, are deliberately ignored.
 *
 * Magnific stays active=false on purpose. It is no longer a failed
 * cancellation: the account was moved to "Magnific Advanced" on 28.9 for
 * ₪322/month, paid with Visa 9024 rather than the business card 2727. Whether
 * that is a shared expense is Elad's call, so this sweep only records it.
 *
 * Two Cloudflare invoices of $8.50 each (IN-78311469, IN-78311507, 7.9) are
 * left out like every one-off before them: the mail carries no line items, so
 * they are either two registrations or a duplicate — the note says to check.
 *
 * Dry run (default):  npx tsx scripts/update-expense-ledger-2026-10.ts
 * Apply:              APPLY=1 npx tsx scripts/update-expense-ledger-2026-10.ts
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
        amount: 120.52,
        isFixed: false,
        notes:
          "usage-based וממשיך לטפס: KITVUJ-00001 $9.20 (1.8) → KITVUJ-00002 $75.92 (1.9) → KITVUJ-00003 $120.52 (1.10), +59% בחודש. התראות spending ב-6.9, 7.9, 14.9, 21.9, 28.9. היעד מהבדיקה של 2.9 היה ~$33/חודש אחרי הקטנת 4 ה-endpoints ל-0.25–1 CU ומחיקת ה-cron triggers של underdogs-api-production — החשבון מראה שזה לא קרה או לא הספיק.",
      },
      why: "$75.92 → $120.52 לפי חשבונית KITVUJ-00003 מ-1.10",
    },
    {
      match: "Claude API credits",
      data: {
        amount: 50,
        notes:
          "טעינה אוטומטית $10 כשהיתרה נגמרת. ספטמבר בפועל: $10.07 (2.9) + $10.07 (8.9) + $10.08 (15.9) + $10.02 (23.9) + $10.02 (27.9) = $50.26 — חמש טעינות מול שלוש באוגוסט ($30.02) וממוצע $11.5 באפר-יולי. טעינה כמעט כל שבוע; זו כבר הוצאה קבועה שגדלה.",
      },
      why: "$30 → $50 לפי 5 קבלות ספטמבר (סה\"כ $50.26)",
    },
    {
      match: "Cloudflare — תוכנית בתשלום",
      data: {
        amount: 5.46,
        notes:
          "חשבונית IN-80527162 $5.46 ב-23.9 (היה $5.06 ב-23.8; נמשך ב-23 לחודש). בנוסף שתי חשבוניות של $8.50 בהפרש דקה ב-7.9 (IN-78311469, IN-78311507) — אין פירוט במייל: או שני רישומי דומיין או חיוב כפול, לבדוק ב-Billing. חד-פעמיות ואינן בשורה הזו.",
      },
      why: "$5.06 → $5.46 לפי החשבונית בפועל",
    },
    {
      match: "Vercel Pro",
      data: {
        notes:
          "מארח את fuzionwebz.com + אתרי floor ישנים. קבלה 2527-5517-5915 $20.00 ב-26.9 (מחזור 25.9–24.10). ⚠️ מייל Vercel מ-29.9: Speed Insights Plus דלוק על פרויקט אחד ולא חויב עד היום — מהמחזור הבא (25.10) +$10/חודש, כלומר $30. אפשר להוריד ל-Speed Insights רגיל לפני סוף המחזור הנוכחי ולהישאר ב-$20.",
      },
      why: "הודעת תיקון חיוב 29.9 — +$10 מ-25.10 אם לא מורידים",
    },
    {
      match: "Magnific",
      data: {
        notes:
          "⚠️ לא מבוטל. אחרי הביטול מ-14.8 נגבו ₪132 ב-18.8 ושוב ₪132 ב-18.9 (Premium+), וב-28.9 נפתח מנוי Magnific Advanced ב-₪322/חודש (חשבונית 3XTPJUBJ-0004, מחזור 28.9–28.10) — על Visa 9024, לא על 2727. החשבון פעיל (tier=advanced, 48,700 קרדיטים נוצלו). השורה נשארת active=false עד שאלעד מחליט אם זו הוצאה משותפת; אם כן — amount=322 ו-active=true.",
      },
      why: "₪132 ב-18.9 + מנוי Advanced ₪322 ב-28.9",
    },
    {
      match: "שרת Hetzner — HIGOLD",
      data: {
        notes:
          "CPX22 $9.49 + IPv4 $0.60. חשבונית ספטמבר 089001144596 $31.86 (1.9) מכסה את כל 4 השרתים: 10.09+5.59+10.09+6.09, ולא הגיעה עליה תזכורת תשלום. חשבונית אוקטובר עדיין לא בתיבה נכון ל-2.10 (בספטמבר הגיעה ב-1 לחודש בבוקר) — לוודא בסריקה הבאה.",
      },
      why: "חשבונית אוקטובר טרם הגיעה נכון ל-2.10",
    },
    {
      match: "Google Workspace",
      data: {
        notes:
          "3 משתמשים × ₪58.80. ⚠️ התשלום עדיין נכשל — ארבעה מיילים מ-Google (1.9, 5.9, 20.9, 28.9), האחרון חוזר על הדדליין: השעיית השירות לכל המשתמשים ב-5.10.2026. לא התקבל שום אישור תשלום. לעדכן אמצעי תשלום ב-admin.google.com → חיוב. החשבוניות בקונסולת האדמין, לא בג'ימייל.",
      },
      why: "עדיין נכשל ב-28.9 — השעיה ב-5.10",
    },
    {
      match: "הנהלת חשבונות",
      data: {
        notes:
          '₪400 שכ"ט + ₪35 Finbot + מע"מ 18% = ₪513.30, נמשך ב-25 לחודש בקארדקום. הכשל מ-25.8 ו-2.9 הוסדר: חשבונית מס קבלה 14491 ב-10.9 (אוגוסט, באיחור) ו-14584 ב-25.9 (ספטמבר, בזמן). הסכום אינו בגוף המייל — רק קישור להורדה.',
      },
      why: "אוגוסט שולם 10.9, ספטמבר שולם 25.9",
    },
    {
      match: "חידושי דומיינים GoDaddy",
      data: {
        notes:
          "14 דומיינים, ₪1,303/שנה. ⚠️ החידוש הראשון נכשל: disaster-design.com (חשבון Web Disaster Official, לקוח 586519922) פג ב-3.9.2026 — PayPal autopay נדחה ב-4.9, הדומיין parked מ-11.9, האתר והמייל שעליו מושבתים, ומוחזק זמנית ע\"י Domain Ownership Protection (מייל 15.9). להחליט: לחדש ידנית או לוותר. השורה עדיין active=false.",
      },
      why: "disaster-design.com פג 3.9, חידוש נכשל",
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

  // No new vendors this sweep. The catch-all over 29.8–2.10 turned up no
  // unrecognised biller: every receipt maps to a row that already exists.
  console.log("\n  (no new vendors found in the window)");

  console.log(apply ? "\ndone." : "\nRe-run with APPLY=1 to write.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error("FAILED:", e.message); await prisma.$disconnect(); process.exit(1); });
