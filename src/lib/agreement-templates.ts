export type AgreementTier = "BASIC" | "ADVANCED" | "PREMIUM";

interface AgreementData {
  customerName: string;
  businessName?: string;
  idNumber?: string;
  phone: string;
  email: string;
  date: string;
  signatureData?: string;
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

const escapeHtml = (s: string | undefined | null) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function renderAgreement(tier: AgreementTier, data: AgreementData): string {
  const meta = TIER_META[tier];
  const includes = TIER_INCLUDES[tier];
  const customer = escapeHtml(data.customerName);
  const business = escapeHtml(data.businessName || "—");
  const idNumber = escapeHtml(data.idNumber || "—");
  const phone = escapeHtml(data.phone);
  const email = escapeHtml(data.email);
  const date = escapeHtml(data.date);
  const signatureImg = data.signatureData
    ? `<img src="${escapeHtml(data.signatureData)}" alt="חתימה" style="max-width:240px;max-height:90px;display:block;" />`
    : `<div style="height:90px;border-bottom:1px solid #999;"></div>`;

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>הסכם שירותי בניית ותחזוקת אתר — מסלול ${escapeHtml(meta.label)}</title>
<style>
  body { font-family: 'Heebo', Arial, sans-serif; color: #111; max-width: 820px; margin: 0 auto; padding: 32px; line-height: 1.7; }
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
  .clause { margin-bottom: 14px; }
  .signature-table { width: 100%; border-collapse: collapse; margin-top: 32px; }
  .signature-table td { border: 1px solid #ccc; padding: 16px; vertical-align: top; width: 50%; font-size: 13px; }
  .signature-label { color: #666; font-size: 12px; margin-bottom: 6px; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>

<h1>הסכם שירותי בניית ותחזוקת אתר</h1>
<p class="subtitle">מסלול ${escapeHtml(meta.label)} · תאריך: ${date}</p>

<h2>1. הצדדים להסכם</h2>
<table class="parties">
  <tr><th>נותן השירות</th><td>Fuzion Webz · ע.מ./ח.פ. — · contact@fuzionwebz.com</td></tr>
  <tr><th>הלקוח / שם מלא</th><td>${customer}</td></tr>
  <tr><th>שם עסק</th><td>${business}</td></tr>
  <tr><th>ח.פ. / ת.ז.</th><td>${idNumber}</td></tr>
  <tr><th>טלפון</th><td>${phone}</td></tr>
  <tr><th>אימייל</th><td>${email}</td></tr>
</table>

<h2>2. מה כלול במסלול ${escapeHtml(meta.label)}</h2>
<ul>
  ${includes.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n  ")}
</ul>
<p style="font-size: 12px; color: #555;">בכל המסלולים ניתן להוסיף בתשלום נוסף: צ׳אט-בוט AI מותאם, פיתוח פיצ׳רים מיוחדים ואינטגרציות מורכבות.</p>

<h2>3. תשלום</h2>
<div class="price-box">
  <strong>מחיר חודשי:</strong> ${meta.price} ₪ + מע״מ.
</div>
<div class="clause">
  <p>התשלום יבוצע בהוראת קבע חודשית באמצעי תשלום מאובטח. עיכוב בתשלום של מעל 14 ימים יוביל להשבתת השירות עד להסדר חוב.</p>
  <p>נותן השירות רשאי לעדכן את המחיר בהודעה מוקדמת של 30 יום לפחות.</p>
</div>

<h2>4. תקופת ההסכם</h2>
<div class="clause">
  <p>ההסכם הוא לתקופה של 24 חודשים מיום החתימה. בתום התקופה ההסכם יתחדש אוטומטית, אלא אם אחד הצדדים יודיע על סיום ההתקשרות בכתב לפחות 30 יום מראש.</p>
</div>

<h2>5. קבצי האתר</h2>
<div class="clause">
  <p>קבצי האתר יועברו לבעלות הלקוח רק לאחר השלמת 24 התשלומים החודשיים. עד אז, הקבצים נמצאים בבעלות נותן השירות.</p>
</div>

<h2>6. בעלות וזכויות</h2>
<div class="clause">
  <p>נותן השירות נשאר בעל האתר עד סיום התקופה ותשלום מלוא התמורה. תכנים שסיפק הלקוח (טקסטים, תמונות, מותג) נשארים בבעלותו המלאה לאורך כל הדרך.</p>
</div>

<h2>7. העברת חומרים והגבלת זמן אישור</h2>
<div class="clause">
  <p>הלקוח מתחייב להעביר את כל החומרים הדרושים בזמן סביר. הגשת חומרים לאישור ללא תגובה תוך 7 ימי עסקים תיחשב כאישור שתיקה ותתקדם הבנייה.</p>
</div>

<h2>8. השבתת שירות בגין אי-תשלום</h2>
<div class="clause">
  <p>איחור של 14 יום בתשלום יוביל להשבתת האתר. שמירת הקבצים תימשך עד 60 יום נוספים לאחר ההשבתה. לאחר מכן, נותן השירות רשאי למחוק את הקבצים ללא חבות.</p>
</div>

<h2>9. הגבלת אחריות</h2>
<div class="clause">
  <p>נותן השירות לא יישא באחריות לנזקים עקיפים, אובדן הכנסה או נזקים תוצאתיים שעלולים להיגרם בעת או בעקבות השימוש באתר. אחריותו המקסימלית מוגבלת לסכום ששולם בפועל ב-12 החודשים האחרונים.</p>
</div>

<h2>10. סודיות</h2>
<div class="clause">
  <p>הצדדים מתחייבים לשמור על סודיות מוחלטת לגבי כל מידע עסקי או מסחרי שיתקבל במהלך ההתקשרות, גם לאחר סיומה.</p>
</div>

<h2>11. כוח עליון</h2>
<div class="clause">
  <p>אף צד לא יחויב באחריות לעיכוב או אי-ביצוע התחייבויותיו אם נגרמו עקב נסיבות של כוח עליון, לרבות מצבי חירום, מלחמה, אסונות טבע או תקלות תשתית רחבות היקף.</p>
</div>

<h2>12. דין שיפוט</h2>
<div class="clause">
  <p>על הסכם זה יחול הדין הישראלי בלבד. כל שינוי ייעשה בכתב ויחייב את שני הצדדים.</p>
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
      <div class="signature-label">חתימת נותן השירות: Fuzion Webz</div>
      <div style="height: 90px; display: flex; align-items: end; font-style: italic; color: #555;">________________________</div>
      <div style="margin-top: 6px; font-size: 12px; color: #666;">תאריך: ${date}</div>
    </td>
  </tr>
</table>

</body>
</html>`;
}

export function tierMonthlyPrice(tier: AgreementTier): number {
  return TIER_META[tier].price;
}
