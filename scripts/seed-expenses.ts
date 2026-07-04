/**
 * Seed the Expense table with the documented July-2026 expense catalog
 * (see EXPENSES-RESEARCH-2026-07.md). Idempotent: matches by (name, vendor)
 * and skips rows that already exist, so it's safe to re-run.
 *
 *   npx tsx scripts/seed-expenses.ts
 */
import { PrismaClient, ExpenseCategory, ExpenseFrequency } from "@prisma/client";

const prisma = new PrismaClient();

interface Row {
  name: string;
  vendor: string;
  category: ExpenseCategory;
  isFixed: boolean;
  amount: number;
  currency: "ILS" | "USD" | "EUR";
  frequency: ExpenseFrequency;
  clientName?: string; // resolved to clientId by lookup
  notes?: string;
  active?: boolean;
  startedAt?: string;
}

const ROWS: Row[] = [
  // ===== LLM APIs =====
  {
    name: "Claude Max 20x",
    vendor: "Anthropic",
    category: "LLM_API",
    isFixed: true,
    amount: 200,
    currency: "USD",
    frequency: "MONTHLY",
    startedAt: "2025-11-01",
    notes: "כלי הפיתוח המרכזי (Claude Code). התחיל כ-Max 5x ב-$100, שודרג 29.3.26. חיוב ב-29 לחודש",
  },
  {
    name: "Claude API credits",
    vendor: "Anthropic",
    category: "LLM_API",
    isFixed: false,
    amount: 10,
    currency: "USD",
    frequency: "MONTHLY",
    startedAt: "2026-02-27",
    notes: "auto-recharge $10 כשהקרדיט נגמר; ממוצע בפועל ~$9/חודש ($35 מצטבר עד יוני)",
  },
  {
    name: "OpenAI API credits",
    vendor: "OpenAI",
    category: "LLM_API",
    isFixed: false,
    amount: 2,
    currency: "USD",
    frequency: "MONTHLY",
    startedAt: "2026-05-30",
    notes: "טעינה בודדת של $10 עד כה (30.5.26) — ממוצע משוער $2/חודש",
  },

  // ===== Hosting / servers =====
  {
    name: "Vercel Pro",
    vendor: "Vercel",
    category: "HOSTING",
    isFixed: true,
    amount: 20,
    currency: "USD",
    frequency: "MONTHLY",
    startedAt: "2026-03-25",
    notes: "מארח את fuzionwebz.com + אתרי floor ישנים. באפריל הייתה חריגת build minutes חד-פעמית ~$109",
  },
  {
    name: "שרת Hetzner — HIGOLD prod",
    vendor: "Hetzner",
    category: "SERVERS",
    isFixed: false,
    amount: 21,
    currency: "USD",
    frequency: "MONTHLY",
    clientName: "הייגולד",
    startedAt: "2026-05-30",
    notes: "הוקם 30.5.26 (deploy key higold-prod-hetzner). חלק מחשבונית Hetzner כוללת ~$31.7/חודש. סטייה מהסטאק — לתעד ב-DECISIONS",
  },
  {
    name: "שרת Hetzner — נתן ארט",
    vendor: "Hetzner",
    category: "SERVERS",
    isFixed: false,
    amount: 11,
    currency: "USD",
    frequency: "MONTHLY",
    clientName: "נתן ארט",
    startedAt: "2026-02-25",
    notes: "Postgres/MinIO self-hosted (legacy stack). ~$5-11/חודש",
  },

  // ===== Domains =====
  {
    name: "דומיינים — Cloudflare Registrar",
    vendor: "Cloudflare",
    category: "DOMAINS",
    isFixed: false,
    amount: 45,
    currency: "USD",
    frequency: "MONTHLY",
    startedAt: "2026-03-14",
    notes: "$10.46 לדומיין .com לשנה, נרכש פר לקוח חדש. ממוצע מרץ-יוני $45.7/חודש — גדל עם קצב הלקוחות",
  },
  {
    name: "חידושי דומיינים GoDaddy (צפוי נוב-דצמ 2026)",
    vendor: "GoDaddy",
    category: "DOMAINS",
    isFixed: false,
    amount: 0,
    currency: "ILS",
    frequency: "MONTHLY",
    active: false,
    notes: "⚠️ ~13 דומיינים מ-2025 יגיעו לחידוש במחיר מלא (~₪80/דומיין) — להעביר ל-Cloudflare לפני נובמבר",
  },

  // ===== SaaS =====
  {
    name: "Resend Transactional Pro",
    vendor: "Resend",
    category: "SAAS",
    isFixed: true,
    amount: 20,
    currency: "USD",
    frequency: "MONTHLY",
    startedAt: "2026-05-29",
    notes: "אימיילים טרנזקציוניים לחנויות ולאפליקציה. חיוב בפועל ₪58-62",
  },
  {
    name: "Magnific Premium+",
    vendor: "Magnific (Freepik)",
    category: "SAAS",
    isFixed: true,
    amount: 132,
    currency: "ILS",
    frequency: "MONTHLY",
    startedAt: "2026-06-30",
    notes: "חשבונית ע\"ש FuzionWebz. כלי AI לתמונות/וידאו. החליף את Google AI Pro שבוטל",
  },

  // ===== Payments =====
  {
    name: "חבילת 500 פעולות LowProfile",
    vendor: "Cardcom",
    category: "PAYMENTS",
    isFixed: true,
    amount: 100,
    currency: "ILS",
    frequency: "MONTHLY",
    startedAt: "2026-04-23",
    notes: "מסוף 149683. בנוסף ~2% עמלת סליקה פר עסקה — מחושבת אוטומטית בדוח מול ה-MRR",
  },

  // ===== Professional =====
  {
    name: "הנהלת חשבונות (רו\"ח)",
    vendor: "רובר פתרונות פיננסיים",
    category: "PROFESSIONAL",
    isFixed: true,
    amount: 0,
    currency: "ILS",
    frequency: "MONTHLY",
    startedAt: "2025-10-25",
    notes: "⚠️ סכום לא ידוע — החשבוניות ב-PDF דרך קארדקום (אחרונה: 13872 מ-25.6.26). לעדכן ידנית",
  },

  // ===== Advertising — the known unknown =====
  {
    name: "פרסום Meta (Facebook Lead Ads)",
    vendor: "Meta",
    category: "ADVERTISING",
    isFixed: false,
    amount: 0,
    currency: "ILS",
    frequency: "MONTHLY",
    notes: "⚠️ אפס חיובי Meta בתיבה של אלעד — מחויב כנראה לחשבון של רועי. כנראה ההוצאה הגדולה ביותר שחסרה. להשלים מ-Ads Manager → Billing",
  },
];

async function main() {
  // Resolve client attributions
  const clientIds = new Map<string, string>();
  for (const row of ROWS) {
    if (!row.clientName || clientIds.has(row.clientName)) continue;
    const client = await prisma.client.findFirst({
      where: { name: row.clientName },
      select: { id: true, name: true },
    });
    if (client) {
      clientIds.set(row.clientName, client.id);
    } else {
      console.warn(`⚠️  client "${row.clientName}" not found — seeding as studio-level`);
    }
  }

  let created = 0;
  let skipped = 0;
  for (const row of ROWS) {
    const exists = await prisma.expense.findFirst({
      where: { name: row.name, vendor: row.vendor },
      select: { id: true },
    });
    if (exists) {
      skipped++;
      continue;
    }
    await prisma.expense.create({
      data: {
        name: row.name,
        vendor: row.vendor,
        category: row.category,
        isFixed: row.isFixed,
        amount: row.amount,
        currency: row.currency,
        frequency: row.frequency,
        clientId: row.clientName ? clientIds.get(row.clientName) ?? null : null,
        notes: row.notes ?? null,
        active: row.active ?? true,
        startedAt: row.startedAt ? new Date(row.startedAt) : null,
      },
    });
    created++;
    console.log(`✓ ${row.name} (${row.vendor})`);
  }
  console.log(`\nDone: ${created} created, ${skipped} already existed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
