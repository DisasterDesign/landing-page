/**
 * Expense-ledger refresh from the 14.8.2026 Gmail deep audit (13-agent sweep
 * + completeness critic). Every figure below is invoice-evidenced unless the
 * note says otherwise.
 *
 * Deliberately NOT added: Cardcom ~2% clearing commission — the revenue side
 * (partner-report / settlement) already nets it out of every client's payment,
 * so an expense row would double-count it. Personal purchases on the business
 * card (YouTube Premium, HBO, gym…) are excluded — not business expenses.
 *
 * Dry run (default):  npx tsx scripts/update-expense-ledger.ts
 * Apply:              APPLY=1 npx tsx scripts/update-expense-ledger.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.env.APPLY === "1";

async function main() {
  console.log(apply ? "MODE: APPLY\n" : "MODE: DRY RUN\n");
  const elad = await prisma.user.findFirst({ where: { isOwner: true }, select: { id: true } });
  if (!elad) throw new Error("no owner");

  const jumarie = await prisma.client.findFirst({
    where: { name: { contains: "jumarie" } }, select: { id: true },
  });

  // ---- updates to existing rows (matched by unique name substring) ----
  const updates: Array<{ match: string; data: Record<string, unknown>; why: string }> = [
    {
      match: "שרת Hetzner — HIGOLD",
      data: { amount: 10.09, notes: "CPX22 $9.49 + IPv4 $0.60. חשבונית אוגוסט 087001087145 לא שולמה — הכרטיס נדחה 2.8, תזכורת 12.8." },
      why: "אימות מחשבונית: $10.09, לא $21",
    },
    {
      match: "שרת Hetzner — נתן ארט",
      data: { amount: 6.09, name: "שרת Hetzner — wallpaper-store (נתן ארט)", notes: "CAX11 $5.49 + IPv4 $0.60." },
      why: "אימות: $6.09",
    },
    {
      match: "דומיינים — Cloudflare",
      data: { amount: 115, currency: "USD", frequency: "YEARLY", isFixed: true, notes: "11 דומיינים × $10.46 חידוש שנתי. רכישות חדשות הן חד-פעמיות ולרוב ניתנות לחיוב על הלקוח — לא כאן. ה-$45/חודש הקודם מדד קצב רכישה, לא עלות שוטפת." },
      why: "$45/חודש היה קצב רכישות; החידוש האמיתי ~$9.6/חודש",
    },
    {
      match: "חידושי דומיינים GoDaddy",
      data: { amount: 1223, currency: "ILS", frequency: "YEARLY", isFixed: true, notes: "13 דומיינים. חידוש ראשון: disaster-design.com ~3.9.2026, השאר מדצמבר 2026. 11×₪80 + elialoni.shop ₪188.47 + lila-yoga $21.99." },
      why: "היה ₪0; לוח חידושים אמיתי ₪1,223/שנה",
    },
    {
      match: "Claude API credits",
      data: { amount: 11.5, isFixed: false, notes: "טעינה אוטומטית ~$10 כשהיתרה נגמרת (לא לפי לוח): אפר-אוג = 4 טעינות ≈ $11.5/חודש." },
      why: "usage-based, ממוצע $11.5",
    },
    {
      match: "OpenAI API credits",
      data: { amount: 2.5, isFixed: false, notes: "טעינה בודדת $10 ב-120 יום ≈ $2.5/חודש. אין מנוי." },
      why: "אין מנוי חודשי — טעינה חד-פעמית ממוצעת",
    },
    {
      match: "הנהלת חשבונות",
      data: { amount: 513.3, vendor: "רובר פתרונות פיננסיים (רותם ליבנה)", notes: "₪400 שכ\"ט + ₪35 Finbot + מע\"מ 18% = ₪513.30, נמשך ב-25 לחודש בקארדקום. אין חשבונית מרץ (13012→13414) — לבדוק אם דולג." },
      why: "היה ₪0; ההוצאה הקבועה השקלית הגדולה ביותר",
    },
    {
      match: "Magnific",
      data: { notes: "חשבונית אחת בלבד (30.6, ₪132). אין חשבונית חידוש יולי בשום מקום — לוודא מול דף הכרטיס שהמנוי עדיין חי לפני שסומכים על השורה." },
      why: "חידוש לא מאומת",
    },
    {
      match: "חבילת 500 פעולות",
      data: { notes: "מחיר מכרטיס תמיכה 589894, לא מחשבונית. לא ברור אם ₪100 כולל מע\"מ (אם לא — ₪118). עמלת הסליקה ~2% איננה כאן בכוונה: צד ההכנסות כבר מנכה אותה, שורה כאן = ספירה כפולה." },
      why: "תיעוד אי-ודאות מע\"מ + מניעת כפל עמלה",
    },
  ];

  for (const u of updates) {
    const row = await prisma.expense.findFirst({
      where: { name: { contains: u.match } }, select: { id: true, name: true, amount: true },
    });
    if (!row) { console.log(`  !! not found: ${u.match}`); continue; }
    const amt = "amount" in u.data ? ` ${row.amount} → ${u.data.amount}` : "";
    console.log(`  ${apply ? "UPDATE" : "WOULD "} ${row.name.slice(0, 34).padEnd(36)}${amt}   (${u.why})`);
    if (apply) await prisma.expense.update({ where: { id: row.id }, data: u.data });
  }

  // ---- new rows the sweep found missing ----
  const adds: Array<{ name: string; vendor: string; category: string; amount: number; currency: string; frequency: string; isFixed: boolean; clientId?: string | null; notes: string }> = [
    {
      name: "Google Workspace Business Standard", vendor: "Google", category: "SAAS",
      amount: 176.4, currency: "ILS", frequency: "MONTHLY", isFixed: true,
      notes: "3 משתמשים × ₪58.80, תוכנית גמישה, מאוגוסט 2026 (שונמך מ-Business Plus ₪223.20 ב-1.8). החשבוניות בקונסולת האדמין של טננט disaster-design, לא בג'ימייל.",
    },
    {
      name: "Neon — Launch Plan (DB פרודקשן)", vendor: "Neon", category: "SERVERS",
      amount: 9.2, currency: "USD", frequency: "MONTHLY", isFixed: false,
      notes: "usage-based ועולה: חשבונית ראשונה $9.20 ב-1.8, אזהרת מכסת compute ב-24.7, spending-limit ב-12.8. זה ה-DB של האפליקציה ושל החנויות — לעקוב צמוד.",
    },
    {
      name: "Cloudflare — תוכנית בתשלום ($5)", vendor: "Cloudflare", category: "HOSTING",
      amount: 5, currency: "USD", frequency: "MONTHLY", isFixed: true,
      notes: "נוספה 6.7.2026, נמשכת ב-23 לחודש. קלאודפלייר לא מציינת את שם המוצר בחשבונית — כנראה Workers Paid; לאמת בדשבורד.",
    },
    {
      name: "שרת Hetzner — innercosmos", vendor: "Hetzner", category: "SERVERS",
      amount: 5.59, currency: "USD", frequency: "MONTHLY", isFixed: true,
      notes: "CX23 $4.99 + IPv4 $0.60. הסריקה מצאה 4 שרתים, לא 2 כפי שהיה רשום.",
    },
    {
      name: "שרת Hetzner — jumarie", vendor: "Hetzner", category: "SERVERS",
      amount: 10.09, currency: "USD", frequency: "MONTHLY", isFixed: true,
      clientId: jumarie?.id ?? null,
      notes: "CPX22 $9.49 + IPv4 $0.60.",
    },
  ];

  for (const a of adds) {
    const exists = await prisma.expense.findFirst({ where: { name: a.name }, select: { id: true } });
    if (exists) { console.log(`  SKIP   ${a.name} — already present`); continue; }
    console.log(`  ${apply ? "ADD   " : "WOULD "} ${a.name.slice(0, 36).padEnd(38)} ${a.amount} ${a.currency}/${a.frequency}`);
    if (apply) {
      const { clientId, ...rest } = a;
      await prisma.expense.create({
        data: { ...rest, category: a.category as never, frequency: a.frequency as never, clientId: clientId ?? null, paidById: elad.id },
      });
    }
  }

  console.log(apply ? "\ndone." : "\nRe-run with APPLY=1 to write.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error("FAILED:", e.message); await prisma.$disconnect(); process.exit(1); });
