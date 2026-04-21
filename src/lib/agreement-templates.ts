import { readFileSync } from "fs";
import { join } from "path";

export type AgreementTier = "BASIC" | "ADVANCED" | "PREMIUM";

export const AGREEMENT_DOCUMENT_VERSION = 3;

let cachedLogoDataUrl: string | null = null;
function getLogoDataUrl(): string {
  if (!cachedLogoDataUrl) {
    try {
      const svg = readFileSync(join(process.cwd(), "public", "icon-black.svg"));
      cachedLogoDataUrl = `data:image/svg+xml;base64,${svg.toString("base64")}`;
    } catch {
      cachedLogoDataUrl = "";
    }
  }
  return cachedLogoDataUrl;
}

export interface AgreementData {
  customerName: string;
  businessName?: string;
  idNumber?: string;
  phone: string;
  email: string;
  date: string;
  monthlyPrice: number;
  oneTimeFee?: number | null;
  tier?: AgreementTier | null;
  signatureData?: string;
  signedAt?: string;
  signedIp?: string;
  signedUserAgent?: string;
}

const TIER_META: Record<AgreementTier, { label: string; price: number }> = {
  BASIC: { label: "בסיס", price: 99 },
  ADVANCED: { label: "מתקדם", price: 199 },
  PREMIUM: { label: "פרימיום", price: 299 },
};

const TIER_INCLUDES: Record<AgreementTier, string[]> = {
  BASIC: [
    "עיצוב מותאם אישית לעסק",
    "סקשנים מרכזיים: שירותים, אודות, גלריה",
    "טופס צור קשר + כפתור וואטסאפ",
    "התאמה מלאה למובייל",
    "מהירות טעינה גבוהה",
    "קישור לרשתות חברתיות",
    "תחזוקה: אחסון, גיבוי, דומיין, עדכונים, ניטור",
    "תמיכה בוואטסאפ",
    "עד 3 שינויים / תיקונים בחודש",
  ],
  ADVANCED: [
    "עיצוב ייחודי לפי מיתוג העסק",
    "מספר עמודים ומבנה אתר מלא",
    "אנימציות ואלמנטים חזותיים מתקדמים",
    "גלריה / תיק עבודות",
    "עמוד שירותים מפורט",
    "טפסים מתקדמים ופניות לידים",
    "אופטימיזציה בסיסית ל-SEO",
    "התאמה לכל המסכים והמכשירים",
    "תחזוקה מלאה + תמיכה מועדפת בוואטסאפ",
    "עד 3 שינויים / תיקונים בחודש",
  ],
  PREMIUM: [
    "בנייה מותאמת לחלוטין לצרכי העסק",
    "חנות אונליין / מערכת ניהול מוצרים",
    "סליקה מאובטחת ותשלומים אונליין",
    "מערכת יומן תורים / הזמנות",
    "אינטגרציות חיצוניות לפי צורך",
    "SEO מתקדם ואופטימיזציה מלאה",
    "פיצ׳רים מיוחדים לפי הצורך",
    "תחזוקה מלאה + תמיכה פרימיום מהירה",
    "עד 3 שינויים / תיקונים בחודש",
  ],
};

const CUSTOM_INCLUDES = [
  "פיתוח לפי דרישות שהוסכמו בנפרד עם הלקוח",
  "תחזוקה: אחסון, גיבוי, דומיין, עדכונים, ניטור",
  "תמיכה בוואטסאפ",
];

const escapeHtml = (s: string | undefined | null) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const fmtMoney = (n: number) =>
  n.toLocaleString("he-IL", { maximumFractionDigits: 0 });

export function tierMonthlyPrice(tier: AgreementTier): number {
  return TIER_META[tier].price;
}

export function renderAgreement(
  tier: AgreementTier | null | undefined,
  data: AgreementData
): string {
  const meta = tier ? TIER_META[tier] : { label: "מותאם אישית", price: data.monthlyPrice };
  const includes = tier ? TIER_INCLUDES[tier] : CUSTOM_INCLUDES;
  const monthly = data.monthlyPrice;
  const setup = data.oneTimeFee && data.oneTimeFee > 0 ? data.oneTimeFee : null;

  const customer = escapeHtml(data.customerName);
  const business = escapeHtml(data.businessName || "-");
  const idNumber = escapeHtml(data.idNumber || "-");
  const phone = escapeHtml(data.phone);
  const email = escapeHtml(data.email);
  const date = escapeHtml(data.date);
  const signatureImg = data.signatureData
    ? `<img src="${escapeHtml(data.signatureData)}" alt="חתימה" style="max-width:240px;max-height:90px;display:block;" />`
    : `<div style="height:90px;border-bottom:1px solid #999;"></div>`;

  const signedAt = data.signedAt ? escapeHtml(data.signedAt) : null;
  const signedIp = data.signedIp ? escapeHtml(data.signedIp) : null;
  const signedUA = data.signedUserAgent
    ? escapeHtml(data.signedUserAgent.length > 120 ? data.signedUserAgent.slice(0, 117) + "..." : data.signedUserAgent)
    : null;

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>הסכם שירותי בניית ותחזוקת אתר ${escapeHtml(meta.label)}</title>
<style>
  body { font-family: 'Heebo', Arial, sans-serif; color: #111; max-width: 820px; margin: 0 auto; padding: 32px; line-height: 1.7; }
  .brand-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 16px; border-bottom: 2px solid #111; margin-bottom: 24px; }
  .brand-logo img { width: 64px; height: 64px; display: block; }
  .brand-name { font-size: 20px; font-weight: 800; letter-spacing: 0.5px; }
  .brand-meta { font-size: 11px; color: #666; text-align: right; line-height: 1.5; }
  h1 { font-size: 22px; text-align: center; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 28px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #111; }
  .subtitle { text-align: center; color: #555; margin-bottom: 24px; font-size: 14px; }
  table.parties { width: 100%; border-collapse: collapse; margin: 12px 0; }
  table.parties th, table.parties td { border: 1px solid #ccc; padding: 8px 10px; text-align: right; font-size: 13px; }
  table.parties th { background: #f3f4f6; width: 35%; }
  ul { margin: 8px 0 8px 16px; padding-right: 18px; }
  li { margin-bottom: 4px; font-size: 14px; }
  p { margin: 8px 0; font-size: 14px; }
  .price-box { background: #f9fafb; border: 1px solid #ddd; padding: 12px 16px; border-radius: 6px; margin: 8px 0; font-size: 15px; }
  .price-box strong { display: inline-block; min-width: 130px; }
  .clause { margin-bottom: 14px; }
  .signature-table { width: 100%; border-collapse: collapse; margin-top: 32px; }
  .signature-table td { border: 1px solid #ccc; padding: 16px; vertical-align: top; width: 50%; font-size: 13px; }
  .signature-label { color: #666; font-size: 12px; margin-bottom: 6px; }
  .audit-trail { margin-top: 24px; padding: 12px; background: #f9fafb; border-right: 3px solid #111; font-size: 11px; color: #555; line-height: 1.5; }
  .audit-trail strong { color: #111; }
  .footer-note { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 10px; color: #888; text-align: center; }
  @media print {
    body { padding: 12px; max-width: 100%; }
    .audit-trail { page-break-inside: avoid; }
    .signature-table { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<div class="brand-header">
  <div class="brand-meta">
    סטודיו לבניית ותחזוקת אתרים<br/>
    info@fuzionwebz.com<br/>
    www.fuzionwebz.com
  </div>
  <div class="brand-logo">
    ${getLogoDataUrl() ? `<img src="${getLogoDataUrl()}" alt="Fuzion Webz" />` : `<div class="brand-name">Fuzion Webz</div>`}
  </div>
</div>

<h1>הסכם שירותי בניית ותחזוקת אתר</h1>
<p class="subtitle">${tier ? `מסלול ${escapeHtml(meta.label)}, תאריך: ${date}` : `תאריך: ${date}`}</p>

<h2>1. הצדדים להסכם</h2>
<table class="parties">
  <tr><th>נותן השירות</th><td>Fuzion Webz</td></tr>
  <tr><th>הלקוח / שם מלא</th><td>${customer}</td></tr>
  <tr><th>שם עסק</th><td>${business}</td></tr>
  <tr><th>ח.פ. / ע.מ.</th><td>${idNumber}</td></tr>
  <tr><th>טלפון</th><td>${phone}</td></tr>
  <tr><th>אימייל</th><td>${email}</td></tr>
</table>

<h2>2. השירות הניתן${tier ? `: מסלול ${escapeHtml(meta.label)}` : ""}</h2>
<ul>
  ${includes.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n  ")}
</ul>
<p style="font-size: 12px; color: #555;">בנוסף ניתן להוסיף בתשלום נפרד: צ׳אט-בוט AI מותאם, פיתוח פיצ׳רים מיוחדים ואינטגרציות מורכבות.</p>

<h2>3. תמורה ותנאי תשלום</h2>
<div class="price-box">
  <p><strong>תשלום חודשי:</strong> ${fmtMoney(monthly)} ₪ + מע״מ כחוק</p>
  ${setup ? `<p><strong>סכום הקמה חד פעמי:</strong> ${fmtMoney(setup)} ₪ + מע״מ. ישולם עם חתימת ההסכם.</p>` : ""}
</div>
<div class="clause">
  <p>התשלום החודשי ייגבה בהוראת קבע מכרטיס אשראי בלבד, באמצעות סולק מאובטח. עיכוב בתשלום של מעל 30 ימים יוביל להשבתת השירות עד להסדר חוב.</p>
  <p>נותן השירות רשאי לעדכן את התעריף בהודעה מוקדמת בכתב של 30 יום לפחות.</p>
</div>

<h2>4. תקופת ההסכם</h2>
<div class="clause">
  <p>ההסכם הוא לתקופה של 24 חודשים מיום החתימה. בתום התקופה ההסכם יתחדש אוטומטית לתקופות נוספות של 12 חודשים, אלא אם אחד הצדדים יודיע לצד השני בכתב על סיום ההתקשרות לפחות 30 יום לפני תום התקופה.</p>
</div>

<h2>5. בעלות על קבצי האתר</h2>
<div class="clause">
  <p>קוד המקור וקבצי הבנייה של האתר נמצאים בבעלות נותן השירות לאורך כל תקופת ההתקשרות. בתום תקופת 24 החודשים הראשונה ולאחר תשלום מלא של כל המגיע, הקבצים יועברו לבעלות הלקוח לפי דרישתו בכתב.</p>
</div>

<h2>6. בעלות על תכנים</h2>
<div class="clause">
  <p>תכנים שסיפק הלקוח (טקסטים, תמונות, סרטונים, מותג, לוגו) הם בבעלותו המלאה של הלקוח לאורך כל הדרך, וזכויות אלה אינן עוברות לנותן השירות. הלקוח מתחייב שכל התכנים שהוא מספק נכונים וחוקיים, ושאין בהם הפרת זכויות יוצרים, סימני מסחר או חוקי פרטיות.</p>
</div>

<h2>7. העברת חומרים והתקדמות הפרויקט</h2>
<div class="clause">
  <p>הלקוח מתחייב להעביר את כל החומרים הדרושים לפיתוח האתר תוך זמן סביר ולהגיב לבקשות אישור תוכן או עיצוב. אם הלקוח לא יספק התייחסות בכתב תוך 7 ימי עסקים ממועד הבקשה, ייחשב הדבר כאישור מכללא של החומר ונותן השירות יהיה רשאי להתקדם בהתאם, מבלי שייגרע מאחריותו לאיכות הביצוע.</p>
</div>

<h2>8. אי-תשלום והשבתה</h2>
<div class="clause">
  <p>איחור של 30 יום בתשלום יוביל להשבתת האתר. הקבצים יישמרו במערכת נותן השירות 60 יום נוספים. לאחר 60 יום מההשבתה, נותן השירות רשאי למחוק את הקבצים ללא חבות.</p>
</div>

<h2>9. הגבלת אחריות</h2>
<div class="clause">
  <p>השירות ניתן "AS IS" לפי הצהרת הלקוח על דרישותיו. נותן השירות אינו אחראי, בכל צורה שהיא, לכל נזק ישיר, עקיף, נסיבתי, תוצאתי, פיננסי, עסקי או אישי שייגרם ללקוח או לצד שלישי כתוצאה מהשימוש באתר, השבתתו, אבדן נתונים, פגיעת אבטחה או כל פעולה או מחדל הקשורים בו. הלקוח מצהיר כי הוא לוקח על עצמו את מלוא הסיכון בהפעלת האתר ובניהול תכניו, וכי לא תקום לו עילת תביעה כלשהי כלפי נותן השירות.</p>
</div>

<h2>10. סודיות הדדית</h2>
<div class="clause">
  <p>הצדדים מתחייבים לשמור על סודיות מוחלטת לגבי כל מידע עסקי, מסחרי, טכני או אישי שיתקבל אצלם במהלך ההתקשרות. התחייבות זו תישאר בתוקף גם לאחר סיום ההסכם, ללא הגבלת זמן.</p>
</div>

<h2>11. כוח עליון</h2>
<div class="clause">
  <p>אף צד לא יחויב באחריות לעיכוב או אי-ביצוע התחייבויותיו אם נגרמו עקב כוח עליון, לרבות מצבי חירום, מלחמה, פעולות איבה, אסונות טבע, מגיפה, או תקלות תשתית רחבות היקף שאינן בשליטת הצד.</p>
</div>

<h2>12. חתימה דיגיטלית והוכחה משפטית</h2>
<div class="clause">
  <p>חתימה דיגיטלית זו מהווה הסכמה משפטית מלאה לכל הקבוע במסמך, בהתאם ל<strong>חוק חתימה אלקטרונית, התשס״א-2001</strong>. החתימה נשמרת במערכת המוגנת של נותן השירות עם רישום מלא של מועד החתימה (UTC), כתובת ה-IP של החותם וזיהוי הדפדפן ששימש לחתימה. רישום זה מהווה ראיה לתוכן ההסכם ומועד החתימה.</p>
</div>

<h2>13. שמירת המסמך וזכות העתקה</h2>
<div class="clause">
  <p>נותן השירות ישמור עותק מלא של ההסכם החתום במערכת המוגנת שלו לתקופה של 7 שנים לפחות. הלקוח יכול להוריד עותק PDF של ההסכם החתום בכל עת מהקישור שנשלח לו בעת החתימה.</p>
</div>

<h2>14. שיפוט ודין</h2>
<div class="clause">
  <p>על הסכם זה יחול הדין הישראלי בלבד. בית המשפט המוסמך לדון בכל סכסוך שיתעורר מהסכם זה הוא בית המשפט במחוז המרכז. כל שינוי בהסכם ייעשה בכתב ויחייב את שני הצדדים.</p>
</div>

<h2>חתימות</h2>
<table class="signature-table">
  <tr>
    <td>
      <div class="signature-label">חתימת הלקוח: ${customer}</div>
      ${signatureImg}
      <div style="margin-top: 6px; font-size: 12px; color: #666;">תאריך: ${date}</div>
    </td>
    <td>
      <div class="signature-label">חתימת נותן השירות</div>
      ${getLogoDataUrl()
        ? `<img src="${getLogoDataUrl()}" alt="Fuzion Webz" style="max-height:80px; display:block;" />`
        : `<div style="height: 80px; display: flex; align-items: end; font-style: italic; color: #555;">Fuzion Webz</div>`}
      <div style="margin-top: 6px; font-size: 12px; color: #666;">Fuzion Webz, תאריך: ${date}</div>
    </td>
  </tr>
</table>

${signedAt || signedIp || signedUA ? `
<div class="audit-trail">
  <strong>רישום חתימה דיגיטלית (audit trail):</strong><br/>
  ${signedAt ? `מועד חתימה (UTC): ${signedAt}<br/>` : ""}
  ${signedIp ? `כתובת IP של החותם: ${signedIp}<br/>` : ""}
  ${signedUA ? `מזהה דפדפן: ${signedUA}<br/>` : ""}
  גרסת מסמך: v${AGREEMENT_DOCUMENT_VERSION}
</div>` : ""}

<div class="footer-note">
  הסכם זה הופק והוחתם דיגיטלית במערכת Fuzion Webz. גרסת מסמך v${AGREEMENT_DOCUMENT_VERSION}
</div>

</body>
</html>`;
}
