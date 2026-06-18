import { readFileSync } from "fs";
import { join } from "path";
import { withVat } from "@/lib/vat";

export type AgreementTier = "LANDING" | "BASIC" | "ADVANCED" | "PREMIUM";
export type AgreementLocale = "he" | "en";

// v6: added English (LTR) rendering + VAT-exempt (zero-rate) pricing for
// foreign clients.
// v7: term clause — no minimum commitment; website ownership transfers to the
// client (ZIP of raw materials) after 12 consecutive months of active subscription.
export const AGREEMENT_DOCUMENT_VERSION = 7;

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
  additionalServices?: string[];
  signatureData?: string;
  signedAt?: string;
  signedIp?: string;
  signedUserAgent?: string;
  /** "he" (default, RTL) or "en" (LTR) — foreign clients. */
  locale?: AgreementLocale;
  /** Zero-rate VAT (export of services to a foreign resident). */
  vatExempt?: boolean;
}

const TIER_META: Record<AgreementTier, { label: string; labelEn: string; price: number }> = {
  LANDING: { label: "דף נחיתה", labelEn: "Landing Page", price: 59 },
  BASIC: { label: "בסיס", labelEn: "Basic", price: 99 },
  ADVANCED: { label: "מתקדם", labelEn: "Advanced", price: 199 },
  PREMIUM: { label: "פרימיום", labelEn: "Premium", price: 599 },
};

const TIER_INCLUDES: Record<AgreementTier, string[]> = {
  LANDING: [
    "עיצוב מותאם לקמפיין / מסר",
    "מבנה ממוקד עם קריאה ברורה לפעולה",
    "טופס לידים + כפתור וואטסאפ",
    "מותאם למובייל במלואו",
    "מהירות טעינה גבוהה",
    "קישור לרשתות חברתיות",
    "תחזוקה: אחסון, גיבוי, דומיין, עדכונים, ניטור",
    "תמיכה בוואטסאפ",
    "עד 2 שינויים מתחילת עבודה",
  ],
  BASIC: [
    "עיצוב מותאם אישית לעסק",
    "סקשנים מרכזיים — שירותים, אודות, גלריה",
    "טופס צור קשר + כפתור וואטסאפ",
    "מותאם למובייל במלואו",
    "מהירות טעינה גבוהה",
    "קישור לרשתות חברתיות",
    "תחזוקה: אחסון, גיבוי, דומיין, עדכונים, ניטור",
    "תמיכה בוואטסאפ",
    "עד 3 תיקונים / שינויים בחודש",
  ],
  ADVANCED: [
    "עיצוב ייחודי לפי מיתוג העסק",
    "מספר עמודים ומבנה אתר מלא",
    "אנימציות ואלמנטים חזותיים מתקדמים",
    "גלריה / תיק עבודות",
    "עמוד שירותים מפורט",
    "טפסים מתקדמים ופניות לידים",
    "אופטימיזציה בסיסית ל-SEO",
    "מותאם לכל המסכים והמכשירים",
    "תחזוקה מלאה + תמיכה מועדפת בוואטסאפ",
    "עד 3 תיקונים / שינויים בחודש",
  ],
  PREMIUM: [
    "בנייה מותאמת לחלוטין לצרכי העסק",
    "חנות אונליין / מערכת ניהול מוצרים",
    "סליקה מאובטחת ותשלומים אונליין",
    "מערכת יומן תורים / הזמנות",
    "אינטגרציות חיצוניות לפי צורך",
    "צ׳אט-בוט AI בהתאמה אישית (אופציה)",
    "SEO מתקדם ואופטימיזציה מלאה",
    "פיצ׳רים מיוחדים לפי הצורך",
    "תחזוקה מלאה + תמיכה פרימיום מהירה",
    "עד 3 תיקונים / שינויים בחודש",
  ],
};

const TIER_INCLUDES_EN: Record<AgreementTier, string[]> = {
  LANDING: [
    "Design tailored to the campaign / message",
    "Focused structure with a clear call to action",
    "Lead form + WhatsApp button",
    "Fully mobile-responsive",
    "High loading speed",
    "Social media links",
    "Maintenance: hosting, backups, domain, updates, monitoring",
    "WhatsApp support",
    "Up to 2 revisions from project start",
  ],
  BASIC: [
    "Custom design for the business",
    "Core sections — services, about, gallery",
    "Contact form + WhatsApp button",
    "Fully mobile-responsive",
    "High loading speed",
    "Social media links",
    "Maintenance: hosting, backups, domain, updates, monitoring",
    "WhatsApp support",
    "Up to 3 fixes / revisions per month",
  ],
  ADVANCED: [
    "Unique design based on the business branding",
    "Multiple pages and a full site structure",
    "Advanced animations and visual elements",
    "Gallery / portfolio",
    "Detailed services page",
    "Advanced forms and lead capture",
    "Basic SEO optimization",
    "Adapted to all screens and devices",
    "Full maintenance + priority WhatsApp support",
    "Up to 3 fixes / revisions per month",
  ],
  PREMIUM: [
    "Fully custom build for the business needs",
    "Online store / product management system",
    "Secure payment processing and online payments",
    "Appointment / booking calendar system",
    "External integrations as needed",
    "Custom AI chatbot (optional)",
    "Advanced SEO and full optimization",
    "Special features as needed",
    "Full maintenance + fast premium support",
    "Up to 3 fixes / revisions per month",
  ],
};

const CUSTOM_INCLUDES = [
  "פיתוח לפי דרישות שהוסכמו בנפרד עם הלקוח",
  "תחזוקה: אחסון, גיבוי, דומיין, עדכונים, ניטור",
  "תמיכה בוואטסאפ",
];

const CUSTOM_INCLUDES_EN = [
  "Development per requirements agreed separately with the Client",
  "Maintenance: hosting, backups, domain, updates, monitoring",
  "WhatsApp support",
];

const escapeHtml = (s: string | undefined | null) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function tierMonthlyPrice(tier: AgreementTier): number {
  return TIER_META[tier].price;
}

/**
 * Strings + layout direction per locale. Hebrew is the existing canonical
 * copy (unchanged so legacy agreements render identically); English is a
 * faithful translation. Legal clauses are bodies (1..14); `{N}` placeholders
 * are filled by the renderer.
 */
interface LocaleStrings {
  dir: "rtl" | "ltr";
  htmlLang: string;
  align: "right" | "left";
  auditBorderSide: "right" | "left";
  docTitle: (label: string) => string;
  h1: string;
  subtitleTier: (label: string, date: string) => string;
  subtitleNoTier: (date: string) => string;
  partiesHeading: string;
  provider: string;
  customerLabel: string;
  businessLabel: string;
  idLabel: string;
  phoneLabel: string;
  emailLabel: string;
  serviceHeading: (label: string | null) => string;
  extrasIntro: string;
  upsellNote: string;
  paymentHeading: string;
  monthlyLine: (net: string, gross: string) => string;
  monthlyLineVatFree: (net: string) => string;
  setupLine: (net: string, gross: string) => string;
  setupLineVatFree: (net: string) => string;
  clauses: { title: string; body: string }[];
  signaturesHeading: string;
  customerSignatureLabel: (name: string) => string;
  providerSignatureLabel: string;
  dateLabel: string;
  auditHeading: string;
  auditSignedAt: (v: string) => string;
  auditIp: (v: string) => string;
  auditUa: (v: string) => string;
  auditVersion: (v: number) => string;
  footerNote: (v: number) => string;
  signatureAlt: string;
  customLabel: string;
}

const HE_CLAUSES: { title: string; body: string }[] = [
  {
    title: "4. תקופת ההסכם",
    body: "להתקשרות אין תקופת התחייבות מינימלית. השירות ניתן על בסיס חודשי, והלקוח רשאי להפסיק את ההתקשרות בכל עת; ההפסקה תיכנס לתוקף בתום החודש ששולם. לאחר 12 חודשים רצופים של מנוי פעיל, בעלות האתר עוברת ללקוח כמפורט בסעיף 5.",
  },
  {
    title: "5. בעלות על קבצי האתר",
    body: "עד להשלמת 12 חודשים רצופים של מנוי פעיל, קוד המקור וקבצי הבנייה של האתר נמצאים בבעלות נותן השירות. בתום 12 חודשים רצופים של מנוי פעיל ולאחר תשלום מלא של כל המגיע, האתר עובר לבעלותו המלאה של הלקוח, והלקוח מקבל קובץ ZIP הכולל את חומרי הגלם וקבצי הבנייה של האתר, ללא תשלום נוסף.",
  },
  {
    title: "6. בעלות על תכנים",
    body: "תכנים שסיפק הלקוח (טקסטים, תמונות, סרטונים, מותג, לוגו) הם בבעלותו המלאה של הלקוח לאורך כל הדרך, וזכויות אלה אינן עוברות לנותן השירות. הלקוח מתחייב שכל התכנים שהוא מספק נכונים וחוקיים, ושאין בהם הפרת זכויות יוצרים, סימני מסחר או חוקי פרטיות.",
  },
  {
    title: "7. העברת חומרים והתקדמות הפרויקט",
    body: "הלקוח מתחייב להעביר את כל החומרים הדרושים לפיתוח האתר תוך זמן סביר ולהגיב לבקשות אישור תוכן או עיצוב. אם הלקוח לא יספק התייחסות בכתב תוך 7 ימי עסקים ממועד הבקשה, ייחשב הדבר כאישור מכללא של החומר ונותן השירות יהיה רשאי להתקדם בהתאם, מבלי שייגרע מאחריותו לאיכות הביצוע.",
  },
  {
    title: "8. אי-תשלום והשבתה",
    body: "איחור של 30 יום בתשלום יוביל להשבתת האתר. הקבצים יישמרו במערכת נותן השירות 60 יום נוספים. לאחר 60 יום מההשבתה, נותן השירות רשאי למחוק את הקבצים ללא חבות.",
  },
  {
    title: "9. הגבלת אחריות",
    body: 'השירות ניתן "AS IS" לפי הצהרת הלקוח על דרישותיו. נותן השירות אינו אחראי, בכל צורה שהיא, לכל נזק ישיר, עקיף, נסיבתי, תוצאתי, פיננסי, עסקי או אישי שייגרם ללקוח או לצד שלישי כתוצאה מהשימוש באתר, השבתתו, אבדן נתונים, פגיעת אבטחה או כל פעולה או מחדל הקשורים בו. הלקוח מצהיר כי הוא לוקח על עצמו את מלוא הסיכון בהפעלת האתר ובניהול תכניו, וכי לא תקום לו עילת תביעה כלשהי כלפי נותן השירות.',
  },
  {
    title: "10. סודיות הדדית",
    body: "הצדדים מתחייבים לשמור על סודיות מוחלטת לגבי כל מידע עסקי, מסחרי, טכני או אישי שיתקבל אצלם במהלך ההתקשרות. התחייבות זו תישאר בתוקף גם לאחר סיום ההסכם, ללא הגבלת זמן.",
  },
  {
    title: "11. כוח עליון",
    body: "אף צד לא יחויב באחריות לעיכוב או אי-ביצוע התחייבויותיו אם נגרמו עקב כוח עליון, לרבות מצבי חירום, מלחמה, פעולות איבה, אסונות טבע, מגיפה, או תקלות תשתית רחבות היקף שאינן בשליטת הצד.",
  },
  {
    title: "12. חתימה דיגיטלית והוכחה משפטית",
    body: "חתימה דיגיטלית זו מהווה הסכמה משפטית מלאה לכל הקבוע במסמך, בהתאם ל<strong>חוק חתימה אלקטרונית, התשס״א-2001</strong>. החתימה נשמרת במערכת המוגנת של נותן השירות עם רישום מלא של מועד החתימה (UTC), כתובת ה-IP של החותם וזיהוי הדפדפן ששימש לחתימה. רישום זה מהווה ראיה לתוכן ההסכם ומועד החתימה.",
  },
  {
    title: "13. שמירת המסמך וזכות העתקה",
    body: "נותן השירות ישמור עותק מלא של ההסכם החתום במערכת המוגנת שלו לתקופה של 7 שנים לפחות. הלקוח יכול להוריד עותק PDF של ההסכם החתום בכל עת מהקישור שנשלח לו בעת החתימה.",
  },
  {
    title: "14. שיפוט ודין",
    body: "על הסכם זה יחול הדין הישראלי בלבד. בית המשפט המוסמך לדון בכל סכסוך שיתעורר מהסכם זה הוא בית המשפט במחוז המרכז. כל שינוי בהסכם ייעשה בכתב ויחייב את שני הצדדים.",
  },
];

const EN_CLAUSES: { title: string; body: string }[] = [
  {
    title: "4. Term of the Agreement",
    body: "This engagement has no minimum commitment period. The service is provided on a monthly basis, and the Client may terminate the engagement at any time; termination takes effect at the end of the month already paid for. After 12 consecutive months of active subscription, ownership of the website transfers to the Client as set out in section 5.",
  },
  {
    title: "5. Ownership of the Website Files",
    body: "Until the Client completes 12 consecutive months of active subscription, the source code and build files of the website remain the property of the Service Provider. Upon completion of 12 consecutive months of active subscription, and after full payment of all amounts due, the website becomes the full property of the Client, and the Client receives a ZIP archive containing the raw materials and build files of the website, at no additional charge.",
  },
  {
    title: "6. Ownership of Content",
    body: "Content supplied by the Client (text, images, videos, brand, logo) remains the Client's sole property at all times, and these rights do not pass to the Service Provider. The Client warrants that all content it provides is accurate and lawful and does not infringe any copyright, trademark or privacy rights.",
  },
  {
    title: "7. Delivery of Materials and Project Progress",
    body: "The Client undertakes to deliver all materials required for development within a reasonable time and to respond to requests for content or design approval. If the Client does not provide a written response within 7 business days of a request, this will be deemed implied approval of the material, and the Service Provider may proceed accordingly, without derogating from its responsibility for the quality of the work.",
  },
  {
    title: "8. Non-Payment and Suspension",
    body: "A payment delay of 30 days will result in suspension of the website. The files will be retained on the Service Provider's systems for an additional 60 days. After 60 days from suspension, the Service Provider may delete the files without liability.",
  },
  {
    title: "9. Limitation of Liability",
    body: 'The service is provided "AS IS" based on the Client\'s statement of its requirements. The Service Provider shall not be liable, in any manner whatsoever, for any direct, indirect, incidental, consequential, financial, business or personal damage caused to the Client or to any third party as a result of the use of the website, its suspension, data loss, security breach, or any act or omission related to it. The Client declares that it assumes the full risk of operating the website and managing its content, and that it shall have no cause of action of any kind against the Service Provider.',
  },
  {
    title: "10. Mutual Confidentiality",
    body: "The parties undertake to maintain absolute confidentiality regarding any business, commercial, technical or personal information received by them during the engagement. This undertaking shall remain in force after termination of the Agreement as well, without time limit.",
  },
  {
    title: "11. Force Majeure",
    body: "Neither party shall be liable for delay or non-performance of its obligations if caused by force majeure, including states of emergency, war, hostilities, natural disasters, pandemic, or large-scale infrastructure failures beyond the party's control.",
  },
  {
    title: "12. Digital Signature and Legal Evidence",
    body: "This digital signature constitutes full legal consent to everything set out in this document, in accordance with the <strong>Israeli Electronic Signature Law, 5761-2001</strong>. The signature is stored on the Service Provider's protected systems with a full record of the time of signing (UTC), the signer's IP address, and identification of the browser used to sign. This record constitutes evidence of the content of the Agreement and the time of signing.",
  },
  {
    title: "13. Document Retention and Right to Copy",
    body: "The Service Provider will retain a full copy of the signed Agreement on its protected systems for a period of at least 7 years. The Client may download a PDF copy of the signed Agreement at any time from the link sent at the time of signing.",
  },
  {
    title: "14. Governing Law and Jurisdiction",
    body: "This Agreement shall be governed solely by Israeli law. The competent court to hear any dispute arising from this Agreement is the court in the Central District of Israel. Any amendment to this Agreement shall be made in writing and shall bind both parties.",
  },
];

const STRINGS: Record<AgreementLocale, LocaleStrings> = {
  he: {
    dir: "rtl",
    htmlLang: "he",
    align: "right",
    auditBorderSide: "right",
    docTitle: (label) => `הסכם שירותי בניית ותחזוקת אתר ${label}`,
    h1: "הסכם שירותי בניית ותחזוקת אתר",
    subtitleTier: (label, date) => `מסלול ${label}, תאריך: ${date}`,
    subtitleNoTier: (date) => `תאריך: ${date}`,
    partiesHeading: "1. הצדדים להסכם",
    provider: "נותן השירות",
    customerLabel: "הלקוח / שם מלא",
    businessLabel: "שם עסק",
    idLabel: "ח.פ. / ע.מ.",
    phoneLabel: "טלפון",
    emailLabel: "אימייל",
    serviceHeading: (label) => (label ? `2. השירות הניתן: מסלול ${label}` : "2. השירות הניתן"),
    extrasIntro: "סעיפים נוספים שהוסכמו עם הלקוח:",
    upsellNote: "בנוסף ניתן להוסיף בתשלום נפרד: צ׳אט-בוט AI מותאם, פיתוח פיצ׳רים מיוחדים ואינטגרציות מורכבות.",
    paymentHeading: "3. תמורה ותנאי תשלום",
    monthlyLine: (net, gross) => `<strong>תשלום חודשי:</strong> ${net} ₪ + מע״מ כחוק (סה״כ ${gross} ₪ לחיוב)`,
    monthlyLineVatFree: (net) => `<strong>תשלום חודשי:</strong> ${net} ₪ — עסקה בשיעור מע״מ אפס (יצוא שירות לתושב חוץ, סעיף 30(א)(5) לחוק מע״מ)`,
    setupLine: (net, gross) => `<strong>סכום הקמה חד-פעמי:</strong> ${net} ₪ + מע״מ (סה״כ ${gross} ₪ לחיוב). ישולם עם חתימת ההסכם.`,
    setupLineVatFree: (net) => `<strong>סכום הקמה חד-פעמי:</strong> ${net} ₪ — בשיעור מע״מ אפס. ישולם עם חתימת ההסכם.`,
    clauses: HE_CLAUSES,
    signaturesHeading: "חתימות",
    customerSignatureLabel: (name) => `חתימת הלקוח: ${name}`,
    providerSignatureLabel: "חתימת נותן השירות",
    dateLabel: "תאריך",
    auditHeading: "רישום חתימה דיגיטלית (audit trail):",
    auditSignedAt: (v) => `מועד חתימה (UTC): ${v}`,
    auditIp: (v) => `כתובת IP של החותם: ${v}`,
    auditUa: (v) => `מזהה דפדפן: ${v}`,
    auditVersion: (v) => `גרסת מסמך: v${v}`,
    footerNote: (v) => `הסכם זה הופק והוחתם דיגיטלית במערכת Fuzion Webz. גרסת מסמך v${v}`,
    signatureAlt: "חתימה",
    customLabel: "מותאם אישית",
  },
  en: {
    dir: "ltr",
    htmlLang: "en",
    align: "left",
    auditBorderSide: "left",
    docTitle: (label) => `Website Development & Maintenance Services Agreement — ${label}`,
    h1: "Website Development & Maintenance Services Agreement",
    subtitleTier: (label, date) => `${label} plan, date: ${date}`,
    subtitleNoTier: (date) => `Date: ${date}`,
    partiesHeading: "1. The Parties",
    provider: "Service Provider",
    customerLabel: "Client / Full Name",
    businessLabel: "Business Name",
    idLabel: "Company / VAT No.",
    phoneLabel: "Phone",
    emailLabel: "Email",
    serviceHeading: (label) => (label ? `2. The Service Provided: ${label} plan` : "2. The Service Provided"),
    extrasIntro: "Additional items agreed with the Client:",
    upsellNote: "The following can be added for a separate fee: a custom AI chatbot, development of special features, and complex integrations.",
    paymentHeading: "3. Fees and Payment Terms",
    monthlyLine: (net, gross) => `<strong>Monthly payment:</strong> ₪${net} + VAT as required by law (₪${gross} total charged)`,
    monthlyLineVatFree: (net) => `<strong>Monthly payment:</strong> ₪${net} — zero-rated VAT (export of services to a foreign resident, sec. 30(a)(5) of the Israeli VAT Law)`,
    setupLine: (net, gross) => `<strong>One-time setup fee:</strong> ₪${net} + VAT (₪${gross} total charged). Payable upon signing.`,
    setupLineVatFree: (net) => `<strong>One-time setup fee:</strong> ₪${net} — zero-rated VAT. Payable upon signing.`,
    clauses: EN_CLAUSES,
    signaturesHeading: "Signatures",
    customerSignatureLabel: (name) => `Client signature: ${name}`,
    providerSignatureLabel: "Service Provider signature",
    dateLabel: "Date",
    auditHeading: "Digital signature record (audit trail):",
    auditSignedAt: (v) => `Time of signing (UTC): ${v}`,
    auditIp: (v) => `Signer IP address: ${v}`,
    auditUa: (v) => `Browser identifier: ${v}`,
    auditVersion: (v) => `Document version: v${v}`,
    footerNote: (v) => `This Agreement was produced and signed digitally on the Fuzion Webz platform. Document version v${v}`,
    signatureAlt: "Signature",
    customLabel: "Custom",
  },
};

function moneyFormatter(locale: AgreementLocale): (n: number) => string {
  const tag = locale === "he" ? "he-IL" : "en-US";
  return (n: number) => n.toLocaleString(tag, { maximumFractionDigits: 0 });
}

export function renderAgreement(
  tier: AgreementTier | null | undefined,
  data: AgreementData
): string {
  const locale: AgreementLocale = data.locale === "en" ? "en" : "he";
  const vatExempt = !!data.vatExempt;
  const t = STRINGS[locale];
  const fmtMoney = moneyFormatter(locale);

  const meta = tier
    ? { label: locale === "en" ? TIER_META[tier].labelEn : TIER_META[tier].label, price: TIER_META[tier].price }
    : { label: t.customLabel, price: data.monthlyPrice };
  const baseIncludes = tier
    ? locale === "en"
      ? TIER_INCLUDES_EN[tier]
      : TIER_INCLUDES[tier]
    : locale === "en"
      ? CUSTOM_INCLUDES_EN
      : CUSTOM_INCLUDES;

  const extras = (data.additionalServices ?? []).map((s) => s.trim()).filter(Boolean);
  const monthly = data.monthlyPrice;
  const setup = data.oneTimeFee && data.oneTimeFee > 0 ? data.oneTimeFee : null;

  const customer = escapeHtml(data.customerName);
  const business = escapeHtml(data.businessName || "-");
  const idNumber = escapeHtml(data.idNumber || "-");
  const phone = escapeHtml(data.phone);
  const email = escapeHtml(data.email);
  const date = escapeHtml(data.date);
  const signatureImg = data.signatureData
    ? `<img src="${escapeHtml(data.signatureData)}" alt="${t.signatureAlt}" style="max-width:240px;max-height:90px;display:block;" />`
    : `<div style="height:90px;border-bottom:1px solid #999;"></div>`;

  const signedAt = data.signedAt ? escapeHtml(data.signedAt) : null;
  const signedIp = data.signedIp ? escapeHtml(data.signedIp) : null;
  const signedUA = data.signedUserAgent
    ? escapeHtml(data.signedUserAgent.length > 120 ? data.signedUserAgent.slice(0, 117) + "..." : data.signedUserAgent)
    : null;

  const monthlyHtml = vatExempt
    ? t.monthlyLineVatFree(fmtMoney(monthly))
    : t.monthlyLine(fmtMoney(monthly), fmtMoney(withVat(monthly)));
  const setupHtml = setup
    ? vatExempt
      ? t.setupLineVatFree(fmtMoney(setup))
      : t.setupLine(fmtMoney(setup), fmtMoney(withVat(setup)))
    : "";

  const listMargin = locale === "he" ? "margin: 8px 0 8px 16px; padding-right: 18px;" : "margin: 8px 0 8px 16px; padding-left: 18px;";
  const auditBorder = `border-${t.auditBorderSide}: 3px solid #111;`;
  const brandMetaAlign = t.align;

  // Static Hebrew payment clauses (sections inside "3") — translated per locale.
  const payClause1 =
    locale === "he"
      ? "התשלום החודשי ייגבה בהוראת קבע מכרטיס אשראי בלבד, באמצעות סולק מאובטח. עיכוב בתשלום של מעל 30 ימים יוביל להשבתת השירות עד להסדר חוב."
      : "The monthly payment will be collected by standing order from a credit card only, via a secure payment processor. A payment delay of more than 30 days will result in suspension of the service until the debt is settled.";
  const payClause2 =
    locale === "he"
      ? "נותן השירות רשאי לעדכן את התעריף בהודעה מוקדמת בכתב של 30 יום לפחות."
      : "The Service Provider may update the rate upon at least 30 days' prior written notice.";

  return `<!doctype html>
<html lang="${t.htmlLang}" dir="${t.dir}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(t.docTitle(meta.label))}</title>
<style>
  body { font-family: 'Heebo', Arial, sans-serif; color: #111; max-width: 820px; margin: 0 auto; padding: 32px; line-height: 1.7; }
  .brand-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 16px; border-bottom: 2px solid #111; margin-bottom: 24px; }
  .brand-logo img { width: 64px; height: 64px; display: block; }
  .brand-name { font-size: 20px; font-weight: 800; letter-spacing: 0.5px; }
  .brand-meta { font-size: 11px; color: #666; text-align: ${brandMetaAlign}; line-height: 1.5; }
  h1 { font-size: 22px; text-align: center; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 28px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #111; }
  .subtitle { text-align: center; color: #555; margin-bottom: 24px; font-size: 14px; }
  table.parties { width: 100%; border-collapse: collapse; margin: 12px 0; }
  table.parties th, table.parties td { border: 1px solid #ccc; padding: 8px 10px; text-align: ${t.align}; font-size: 13px; }
  table.parties th { background: #f3f4f6; width: 35%; }
  ul { ${listMargin} }
  li { margin-bottom: 4px; font-size: 14px; }
  p { margin: 8px 0; font-size: 14px; }
  .price-box { background: #f9fafb; border: 1px solid #ddd; padding: 12px 16px; border-radius: 6px; margin: 8px 0; font-size: 15px; }
  .price-box strong { display: inline-block; min-width: 130px; }
  .clause { margin-bottom: 14px; }
  .signature-table { width: 100%; border-collapse: collapse; margin-top: 32px; }
  .signature-table td { border: 1px solid #ccc; padding: 16px; vertical-align: top; width: 50%; font-size: 13px; }
  .signature-label { color: #666; font-size: 12px; margin-bottom: 6px; }
  .audit-trail { margin-top: 24px; padding: 12px; background: #f9fafb; ${auditBorder} font-size: 11px; color: #555; line-height: 1.5; }
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
    ${locale === "he" ? "סטודיו לבניית ותחזוקת אתרים" : "Website development & maintenance studio"}<br/>
    info@fuzionwebz.com<br/>
    www.fuzionwebz.com
  </div>
  <div class="brand-logo">
    ${getLogoDataUrl() ? `<img src="${getLogoDataUrl()}" alt="Fuzion Webz" />` : `<div class="brand-name">Fuzion Webz</div>`}
  </div>
</div>

<h1>${escapeHtml(t.h1)}</h1>
<p class="subtitle">${tier ? escapeHtml(t.subtitleTier(meta.label, date)) : escapeHtml(t.subtitleNoTier(date))}</p>

<h2>${escapeHtml(t.partiesHeading)}</h2>
<table class="parties">
  <tr><th>${escapeHtml(t.provider)}</th><td>Fuzion Webz</td></tr>
  <tr><th>${escapeHtml(t.customerLabel)}</th><td>${customer}</td></tr>
  <tr><th>${escapeHtml(t.businessLabel)}</th><td>${business}</td></tr>
  <tr><th>${escapeHtml(t.idLabel)}</th><td>${idNumber}</td></tr>
  <tr><th>${escapeHtml(t.phoneLabel)}</th><td>${phone}</td></tr>
  <tr><th>${escapeHtml(t.emailLabel)}</th><td>${email}</td></tr>
</table>

<h2>${escapeHtml(t.serviceHeading(tier ? meta.label : null))}</h2>
<ul>
  ${baseIncludes.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n  ")}
</ul>
${extras.length > 0 ? `
<p style="font-weight: 700; margin: 14px 0 6px; font-size: 14px;">${escapeHtml(t.extrasIntro)}</p>
<ul>
  ${extras.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n  ")}
</ul>` : ""}
<p style="font-size: 12px; color: #555;">${escapeHtml(t.upsellNote)}</p>

<h2>${escapeHtml(t.paymentHeading)}</h2>
<div class="price-box">
  <p>${monthlyHtml}</p>
  ${setupHtml ? `<p>${setupHtml}</p>` : ""}
</div>
<div class="clause">
  <p>${escapeHtml(payClause1)}</p>
  <p>${escapeHtml(payClause2)}</p>
</div>

${t.clauses
  .map(
    (c) => `<h2>${escapeHtml(c.title)}</h2>
<div class="clause">
  <p>${c.body}</p>
</div>`
  )
  .join("\n\n")}

<h2>${escapeHtml(t.signaturesHeading)}</h2>
<table class="signature-table">
  <tr>
    <td>
      <div class="signature-label">${escapeHtml(t.customerSignatureLabel(data.customerName))}</div>
      ${signatureImg}
      <div style="margin-top: 6px; font-size: 12px; color: #666;">${escapeHtml(t.dateLabel)}: ${date}</div>
    </td>
    <td>
      <div class="signature-label">${escapeHtml(t.providerSignatureLabel)}</div>
      ${getLogoDataUrl()
        ? `<img src="${getLogoDataUrl()}" alt="Fuzion Webz" style="max-height:80px; display:block;" />`
        : `<div style="height: 80px; display: flex; align-items: end; font-style: italic; color: #555;">Fuzion Webz</div>`}
      <div style="margin-top: 6px; font-size: 12px; color: #666;">Fuzion Webz, ${escapeHtml(t.dateLabel)}: ${date}</div>
    </td>
  </tr>
</table>

${signedAt || signedIp || signedUA ? `
<div class="audit-trail">
  <strong>${escapeHtml(t.auditHeading)}</strong><br/>
  ${signedAt ? `${escapeHtml(t.auditSignedAt(signedAt))}<br/>` : ""}
  ${signedIp ? `${escapeHtml(t.auditIp(signedIp))}<br/>` : ""}
  ${signedUA ? `${escapeHtml(t.auditUa(signedUA))}<br/>` : ""}
  ${escapeHtml(t.auditVersion(AGREEMENT_DOCUMENT_VERSION))}
</div>` : ""}

<div class="footer-note">
  ${escapeHtml(t.footerNote(AGREEMENT_DOCUMENT_VERSION))}
</div>

</body>
</html>`;
}
