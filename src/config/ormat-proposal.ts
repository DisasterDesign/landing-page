/**
 * Single source of truth for the Ormat proposal (ormat.fuzionwebz.com).
 *
 * Deliberately framework-agnostic (no React, no "@/..." aliases) so the
 * standalone create-script (prisma/seed-ormat.ts, run via `npx tsx`) can import
 * it by relative path, while Next.js imports it via "@/config/ormat-proposal".
 *
 * Two representations of the same deal live here:
 *   - `ormatSections` — the rich, on-brand copy rendered by the landing page.
 *   - `ormatLegalBodyHtml` — the formal terms stored as the agreement's
 *     customBodyHtml and rendered into the signed PDF (the binding record).
 * Both must describe identical commercial terms; the price/milestone figures
 * below are the shared numbers.
 */

/** Possession-based token for the single Ormat agreement row. */
export const ORMAT_PROPOSAL_TOKEN = "ormat-fzora001-2f9c4e7b6a1d";

const VAT_RATE = 18;
const withVat = (net: number) => Math.round(net * (1 + VAT_RATE / 100) * 100) / 100;

export interface Milestone {
  n: number;
  pct: number;
  net: number;
  deliverable: string;
  nonRefundable?: boolean;
}

export const ormatPricing = {
  vatRate: VAT_RATE,
  netTotal: 75000,
  grossTotal: withVat(75000), // 88,500
  firstPaymentNet: 22500,
  firstPaymentGross: withVat(22500), // 26,550
  milestones: [
    { n: 1, pct: 30, net: 22500, deliverable: "חתימה + תסריט + Storyboard מאושר", nonRefundable: true },
    { n: 2, pct: 25, net: 18750, deliverable: "אישור previz / בלוקינג 3D + שלד הדף" },
    { n: 3, pct: 25, net: 18750, deliverable: "גרסת draft של הסרטון + דף פונקציונלי" },
    { n: 4, pct: 20, net: 15000, deliverable: "מסירת קבצים סופיים + העברת בעלות" },
  ] as Milestone[],
};

export const ormatMeta = {
  proposalNumber: "FZ-ORA-001",
  clientName: "Ormat",
  clientLegalName: "Ormat Technologies",
  validityDays: 14,
  workWindow: "31.8.2026",
  hours: "א׳–ה׳ · 9:00–17:00",
  videoLengthLabel: "~3 דקות",
};

/** ₪ formatter (he-IL, no fractional agorot). */
export function formatILS(n: number): string {
  return n.toLocaleString("he-IL", { maximumFractionDigits: 0 });
}

export type SectionId =
  | "hero"
  | "about"
  | "scope"
  | "concept"
  | "showcase"
  | "milestones"
  | "terms"
  | "hours"
  | "price"
  | "sign";

export interface ProposalSection {
  id: SectionId;
  /** Machine station this section maps to, surfaced as a tiny label. */
  station: string;
  kicker: string;
  title: string;
  lead?: string;
  points?: string[];
}

/**
 * The narrative stations. Order == scroll order; the 3D droplet's progress is
 * derived from how far the reader has scrolled through this list, so each
 * section "lights up" its station in the closed-loop machine.
 */
export const ormatSections: ProposalSection[] = [
  {
    id: "hero",
    station: "באר ההפקה",
    kicker: "Fuzion Webz × Ormat",
    title: "מהחום שבאדמה אל הסרט שמסביר את הטכנולוגיה",
    lead: "סרט טכנולוגי תלת ממדי באורך כשלוש דקות שממחיש את ממיר האנרגיה של Ormat: מהמעמקים החמים, דרך הרתחת הנוזל האורגני והטורבינה המסתובבת, ועד החשמל הנקי לרשת, בשפה קולנועית ברמת חברות האנרגיה המובילות בעולם.",
  },
  {
    id: "about",
    station: "עליית התמלחת",
    kicker: "01 · רקע ומטרה",
    title: "הטכנולוגיה שלכם מרשימה. קשה להעביר אותה במילים.",
    lead: "Ormat המציאה את מחזור הראנקין האורגני המסחרי ומייצרת את החומרה בעצמה כבר 60 שנה. המטרה של הפרויקט: להפוך את המורכבות ההנדסית הזו לסיפור ויזואלי אחד, ברור ומדויק, שאפשר להראות למשקיע, ללקוח או בכנס, וכולם מבינים תוך דקה למה זה גאוני.",
  },
  {
    id: "scope",
    station: "המאדה",
    kicker: "02 · מה נפיק",
    title: "תכולת העבודה",
    lead: "בדיוק מה שכלול ומה שלא, כדי שלא יהיו הפתעות לאף צד.",
    points: [
      "סרט טכנולוגי תלת ממד באורך כשלוש דקות, כולל תסריט וסטוריבורד מאושר",
      "מידול ואנימציית תלת ממד של מערך הממיר OEC: באר, מאדה, טורבינה, גנרטור, מעבה אווירי, משאבות וצנרת",
      "חמישה פרקי נרטיב: פתיח, הבעיה, הטכנולוגיה, ההיקף, סגירת מותג",
      "קריינות מקצועית אחת (עברית או אנגלית), מוזיקה ועיצוב סאונד",
      "מסירה באיכות 4K וגרסת רשתות חברתיות (16:9), קובץ סופי אחד מאושר",
      "דף ההצגה הדיגיטלי הזה: קונספט, חתימה ותשלום",
    ],
  },
  {
    id: "concept",
    station: "טורבינה",
    kicker: "03 · התהליך",
    title: "בונים את הסרט יחד, שלב אחרי שלב",
    lead: "כל חוליה ביצירה נעשית במשותף ומקבלת את אישורכם לפני שממשיכים הלאה, כך שאין הפתעות והתוצאה הסופית היא בדיוק מה שדמיינתם.",
    points: [
      "קונספט. מגדירים יחד את הסיפור, המסר והשפה הויזואלית, ונועלים כיוון מאושר.",
      "סטוריבורד. משרטטים את הסרט פריים אחרי פריים, ומאשרים לפני שנכנסים להפקה.",
      "וידאו מסגרת רפרנס. מפיקים גרסת רפרנס שמראה את התנועה, הקצב והתחושה, לאישורכם.",
      "בניית הסצנות. בונים את הסצנות התלת ממדיות עצמן, ומציגים אותן לאישורכם תוך כדי העבודה.",
      "סרט סופי. מרכיבים את הכל יחד עם קריינות, מוזיקה וסאונד, ומוסרים לאחר אישורכם הסופי.",
    ],
  },
  {
    id: "showcase",
    station: "הגנרטור",
    kicker: "04 · עבודות שלנו",
    title: "ככה זה נראה כשאנחנו מספרים סיפור",
    lead: "מבחר מהעבודות שלנו. גללו בקרוסלה כדי להתרשם מהרמה שתקבלו.",
  },
  {
    id: "milestones",
    station: "הלולאה",
    kicker: "05 · אבני דרך ותשלומים",
    title: "ארבעה תשלומים שאתם שולטים בהם",
    lead: "כל תשלום צמוד לאבן דרך. אפשר לעצור אחרי כל שלב, ואז התשלומים הבאים פשוט נעצרים. התשלום הראשון נגבה כעת, מיד אחרי החתימה.",
  },
  {
    id: "terms",
    station: "המעבה",
    kicker: "06 · מסגרת מגינה",
    title: "ברור, הוגן, ושמור משני הצדדים",
    lead: "התנאים שמגדירים בדיוק מה קורה בכל תרחיש, כדי ששנינו נישן טוב.",
    points: [
      "עוצרים אחרי תשלום? מקבלים את תוצר השלב ששולם והושלם, לא את התוצר הסופי",
      "התשלום הראשון הוא מקדמה שאינה מוחזרת",
      "בנק השעות מתאר זמינות לפרויקט המוגדר, לא תכולה בלתי מוגבלת",
      "עד 2 סבבי תיקונים בכל שלב; שינוי מעבר לתכולה יטופל כהזמנת שינוי בתשלום",
      "הבעלות והזכויות בתוצר עוברות אליכם במלואן עם השלמת התשלום",
    ],
  },
  {
    id: "hours",
    station: "משאבת הזנה",
    kicker: "07 · ליווי",
    title: "בנק שעות ותקשורת ישירה עד סוף אוגוסט",
    lead: "לאורך הפרויקט אנחנו זמינים אליכם בלי ספירת שעות: תקשורת ישירה, פגישות Zoom, תיקונים והתייעצות, בימים ראשון עד חמישי בשעות 9:00 עד 17:00, בתיאום מראש.",
  },
  {
    id: "price",
    station: "סגירת הלולאה",
    kicker: "08 · סיכום",
    title: "השקעה בפרויקט",
    lead: "כל המספרים במקום אחד, שקוף לחלוטין.",
  },
  {
    id: "sign",
    station: "באר ההזרקה",
    kicker: "09 · אישור",
    title: "מאשרים, חותמים, מתחילים",
    lead: "חתימה דיגיטלית מאשרת את ההצעה ואת התנאים, ומובילה ישירות לתשלום הראשון דרך סליקה מאובטחת.",
  },
];

/**
 * The binding legal body, stored as the agreement's customBodyHtml and rendered
 * into the signed PDF. Uses the same class names as the agreement document CSS
 * (h2, p, ul/li, table.milestones, .price-box) so it inherits that styling.
 * Trusted HTML — authored here, never user input.
 */
export const ormatLegalBodyHtml = `
<h2>1. רקע ומטרת הפרויקט</h2>
<div class="clause">
  <p>נותן השירות (Fuzion Webz) יפיק עבור המזמין (Ormat) סרט טכנולוגי באורך כ-3 דקות הממחיש את טכנולוגיית ה-Ormat Energy Converter, וכן דף הצגה דיגיטלי ייעודי המשמש למסירת ההצעה, חתימה ותשלום. מסמך זה מהווה את ההצעה ואת ההסכם המחייב בין הצדדים.</p>
</div>

<h2>2. תכולת העבודה</h2>
<div class="clause">
  <p><strong>כלול:</strong></p>
  <ul>
    <li>סרט טכנולוגי 3D באורך כ-3 דקות (~180 שניות), כולל כתיבת תסריט ו-Storyboard לאישור.</li>
    <li>מידול ואנימציית 3D של מערך ה-OEC: באר הפקה, מחמם, מאדה, טורבינה, גנרטור, מעבה אווירי, משאבות וצנרת, בליווי המחשת זרימת האנרגיה במעגל הסגור.</li>
    <li>חמישה פרקי נרטיב: פתיח, הבעיה, הטכנולוגיה, ההיקף וההשפעה, סגירת מותג.</li>
    <li>קריינות מקצועית אחת (עברית או אנגלית, לבחירת המזמין), מוזיקה ועיצוב סאונד.</li>
    <li>מסירה בפורמט 4K וכן גרסת רשתות חברתיות (16:9), קובץ סופי אחד מאושר.</li>
    <li>דף הצגה דיגיטלי ייעודי (הצגת הקונספט, חתימה דיגיטלית ומעבר לתשלום).</li>
  </ul>
  <p><strong>לא כלול (טעון הצעה נפרדת):</strong> גרסאות שפה נוספות מעבר לאחת; גרסאות אורך נוספות; צילומי וידאו/רחפן בשטח; שחקנים או דמויות; קבצי מקור 3D (project files); רישוי שידור או פרסום בטלוויזיה; אינטגרציות או דפים נוספים מעבר לדף זה.</p>
</div>

<h2>3. אבני דרך, לוח זמנים ותשלומים</h2>
<div class="clause">
  <p>הפרויקט מחולק לארבעה שלבים, וכל תשלום צמוד לאבן דרך. חלון העבודה: עד 31.8.2026.</p>
  <table class="milestones">
    <tr><th>#</th><th>אבן דרך</th><th>חלק</th><th>נטו (₪)</th><th>כולל מע״מ (₪)</th></tr>
    <tr><td>1</td><td>חתימה + תסריט + Storyboard מאושר (מקדמה לא מוחזרת)</td><td>30%</td><td>22,500</td><td>26,550</td></tr>
    <tr><td>2</td><td>אישור previz / בלוקינג 3D + שלד הדף</td><td>25%</td><td>18,750</td><td>22,125</td></tr>
    <tr><td>3</td><td>גרסת draft של הסרטון + דף פונקציונלי</td><td>25%</td><td>18,750</td><td>22,125</td></tr>
    <tr><td>4</td><td>מסירת קבצים סופיים + העברת בעלות</td><td>20%</td><td>15,000</td><td>17,700</td></tr>
    <tr><td colspan="2"><strong>סה״כ</strong></td><td><strong>100%</strong></td><td><strong>75,000</strong></td><td><strong>88,500</strong></td></tr>
  </table>
  <p>התשלום הראשון בסך 26,550 ₪ (כולל מע״מ) נגבה עם החתימה. תשלומים 2–4 ייגבו בכל אבן דרך בנפרד.</p>
</div>

<h2>4. בנק שעות ותקשורת ישירה</h2>
<div class="clause">
  <p>לאורך הפרויקט ועד 31.8.2026 עומדת לרשות המזמין זמינות מלאה של הצוות לפרויקט זה, ללא ספירת שעות: תקשורת ישירה ומיידית, פגישות Zoom, סבבי תיקונים והתייעצות, בימים א׳–ה׳ בשעות 9:00–17:00 (פגישות בתיאום מראש).</p>
  <p>בנק השעות הבלתי מוגבל מתאר את <strong>זמינות הספק</strong> להשלמת הפרויקט המוגדר לעיל, ואינו מהווה התחייבות לתכולה בלתי מוגבלת, לתוצרים נוספים או לפרויקטים נוספים. מענה יינתן בזמן סביר בשעות העבודה; אין התחייבות למענה מחוץ לשעות אלו.</p>
</div>

<h2>5. תנאי תשלום, ביטול ועצירה</h2>
<div class="clause">
  <p>המזמין רשאי להודיע בכתב על הפסקת העבודה לאחר כל תשלום. במקרה כזה:</p>
  <ul>
    <li>התשלומים העתידיים יבוטלו.</li>
    <li>התשלום הראשון אינו מוחזר בשום מקרה.</li>
    <li>המזמין יהיה זכאי לקבל אך ורק את תוצר השלב שבגינו שולם ושהושלם במלואו — ולא את התוצר הסופי או חלקיו.</li>
    <li>כל תוצרי הביניים של שלבים ששולמו אך לא הושלמו, וכן התוצר הסופי, יישארו בבעלות הספק, אינם נמסרים ואינם מורשים לשימוש.</li>
    <li>הספק יהיה זכאי לתשלום מלא עבור עבודה שבוצעה בפועל עד מועד ההודעה, כנגד דיווח שעות.</li>
  </ul>
</div>

<h2>6. תיקונים, שינויים ואישור שלב</h2>
<div class="clause">
  <p><strong>תיקון</strong> הוא התאמת תוצר לתכולה שאושרה; כלולים עד שני (2) סבבי תיקונים בכל שלב (תסריט, Storyboard, גרסת 3D, גרסת הסרט). <strong>שינוי</strong> הוא כל בקשה החורגת מהתכולה המאושרת (סצנות, מודלים או שפות נוספים, שינוי קונספט לאחר אישור, שינוי דרישות הדף), ויטופל בהזמנת שינוי נפרדת בתמחור נוסף, באישור מראש ובכתב. עם אישור בכתב של תוצר שלב, התוכן ננעל; פתיחה מחדש של תוכן מאושר תיחשב שינוי ותתומחר בנפרד.</p>
</div>

<h2>7. בעלות וזכויות יוצרים</h2>
<div class="clause">
  <p>כל זכויות היוצרים והקניין הרוחני בתוצרים נשארים בבעלות Fuzion Webz עד קבלת מלוא התמורה בפועל. עם השלמת התשלום המלא יועברו למזמין זכויות השימוש בתוצר הסופי לצרכיו העסקיים. קבצי המקור (קבצי 3D, שכבות, פרויקט עריכה) אינם כלולים בהעברה ויימסרו רק בהסכמה נפרדת ותמורה נוספת.</p>
</div>

<h2>8. נכסים, רישוי ותנאים כלליים</h2>
<div class="clause">
  <p><strong>רישוי נכסים:</strong> מוזיקה, צלילים, פונטים וחומרי stock מסופקים תחת רישיון שימוש לתוצר זה בלבד; שימוש באמצעי שלא הוגדר מראש (שידור / פרסומת טלוויזיה) עשוי לחייב רישוי נוסף באחריות המזמין.</p>
  <p><strong>איחור בתשלום</strong> יישא ריבית פיגורים והצמדה כדין; הספק רשאי להשהות עבודה ולעכב מסירה עד להסדרה.</p>
  <p><strong>כוח עליון:</strong> אף צד לא יישא באחריות לעיכוב הנובע מנסיבות שמחוץ לשליטתו הסבירה; לוחות הזמנים יידחו בהתאם.</p>
  <p><strong>מע״מ:</strong> כל המחירים אינם כוללים מע״מ; יתווסף מע״מ כחוק (18% נכון ליוני 2026).</p>
  <p><strong>תוקף ההצעה:</strong> 14 יום ממועד ההוצאה.</p>
</div>
`;
