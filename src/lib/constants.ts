import type {
  NavItem,
  TeamMember,
  Service,
  PricingTier,
  PortfolioProject,
  ProcessStep,
  FAQItem,
} from "@/types";

export const SITE_NAME = "Fuzion Webz";
export const SITE_URL = "https://www.fuzionwebz.com";
export const SITE_DESCRIPTION = "סטודיו לעיצוב ובניית אתרים מתקדמים";
export const WHATSAPP_NUMBER = "972000000000";
export const WHATSAPP_MESSAGE = "היי, אשמח לשמוע עוד על השירותים שלכם!";

export const NAV_ITEMS: NavItem[] = [
  { label: "ראשי", href: "/" },
  { label: "שירותים", href: "/#services" },
  { label: "עבודות", href: "/#portfolio" },
  { label: "מחירים", href: "/#pricing" },
  { label: "אודות", href: "/#about" },
  { label: "צור קשר", href: "/#contact" },
];

export const TEAM_MEMBERS: TeamMember[] = [
  {
    name: "Roei Yehezkel",
    nameHe: "רועי יחזקאל",
    role: "Co-Founder",
    roleHe: "מייסד שותף",
    email: "roei@fuzionwebz.com",
    bio: "עם עשור של ניסיון בעולמות השיווק והדיגיטל, עבודה עם חברות ומותגים מובילים בארץ ובעולם. מתמחה במיתוג עסקי, שיווק דיגיטלי ובניית אתרים חכמים שמייצרים תוצאות אמיתיות. יוזם ומוביל יוזמות נוספות, עם חשיבה עסקית רחבה וחיבור עמוק לעולם החדשנות והטכנולוגיה.",
    image: "/images/team/roei.jpg",
  },
  {
    name: "Elad Nissim",
    nameHe: "אלעד ניסים",
    role: "Co-Founder",
    roleHe: "מייסד שותף",
    email: "elad@fuzionwebz.com",
    bio: "עם עשור של ניסיון בשיווק וניהול חברות, בעלים לשעבר של סטודיו לאנימציה וחברת קולנוע והפקות. מתמחה בעיצוב UX/UI, בניית חוויות משתמש אינטואיטיביות ועיצוב ממשקים שממירים מבקרים ללקוחות. משלב חשיבה עיצובית עם הבנה עסקית עמוקה, ומביא לכל פרויקט את השילוב של אסתטיקה וביצועים.",
    image: "/images/team/elad.jpg",
  },
];

export const SERVICES: Service[] = [
  {
    id: "website",
    title: "אתר אינטרנט",
    description: "בניית אתרים מתקדמים עם עיצוב ייחודי, חוויית משתמש מעולה וביצועים גבוהים.",
    icon: "globe",
  },
  {
    id: "business",
    title: "אתר לעסק",
    description: "אתרים מותאמים לעסקים עם דגש על המרות, נוכחות דיגיטלית חזקה ותוצאות עסקיות.",
    icon: "briefcase",
  },
  {
    id: "ecommerce",
    title: "אתר מכירות",
    description: "חנויות אונליין מלאות עם ניהול מוצרים, סליקה מאובטחת ואופטימיזציה להמרות.",
    icon: "shopping-cart",
  },
  {
    id: "3d-website",
    title: "אתר תלת מימדי",
    description: "אתרים עם חוויית תלת מימד מרשימה, אנימציות מתקדמות ועיצוב חדשני.",
    icon: "cube",
  },
  {
    id: "landing",
    title: "דף נחיתה",
    description: "דפי נחיתה ממירים עם עיצוב ממוקד, קופי שיווקי חזק וקריאות לפעולה אפקטיביות.",
    icon: "rocket",
  },
  {
    id: "custom",
    title: "פתרון מותאם אישית",
    description: "פתרונות ווב מותאמים אישית לצרכים ייחודיים, כולל מערכות מורכבות ואינטגרציות.",
    icon: "settings",
  },
];

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "basic",
    name: "חבילת בסיס",
    price: 80,
    currency: "₪",
    period: "לחודש",
    cta: "בואו נדבר",
    features: [
      { text: "תחזוקה שוטפת לאתר", included: true },
      { text: "שרתים ואחסון", included: true },
      { text: "גיבוי ואבטחה", included: true },
      { text: "ניהול דומיין וחידוש", included: true },
      { text: "עדכוני מערכת ותוספים", included: true },
      { text: "ניטור תקלות", included: true },
      { text: "תמיכה וסיוע בוואטסאפ", included: true },
      { text: "תיקונים, שינויים או הוספות תוכן", included: false },
    ],
  },
  {
    id: "advanced",
    name: "חבילה מתקדמת",
    price: 150,
    currency: "₪",
    period: "לחודש",
    cta: "בואו נדבר",
    recommended: true,
    features: [
      { text: "תחזוקה שוטפת לאתר", included: true },
      { text: "שרתים ואחסון", included: true },
      { text: "גיבוי ואבטחה", included: true },
      { text: "ניהול דומיין וחידוש", included: true },
      { text: "עדכוני מערכת ותוספים", included: true },
      { text: "ניטור תקלות", included: true },
      { text: "תמיכה וסיוע בוואטסאפ", included: true },
      { text: "עד 3 עריכות תוכן ועיצוב בחודש", included: true },
    ],
  },
  {
    id: "premium",
    name: "חבילת פרימיום",
    price: 300,
    currency: "₪",
    period: "לחודש",
    cta: "בואו נדבר",
    features: [
      { text: "תחזוקה שוטפת לאתר", included: true },
      { text: "שרתים ואחסון", included: true },
      { text: "גיבוי ואבטחה", included: true },
      { text: "ניהול דומיין וחידוש", included: true },
      { text: "עדכוני מערכת ותוספים", included: true },
      { text: "ניטור תקלות", included: true },
      { text: "תמיכה זמינה בוואטסאפ", included: true },
      { text: "עד 10 תיקונים או שינויים בחודש", included: true },
    ],
  },
];

export const PRICING_ADDONS = [
  "מיילים עסקיים",
  "חיבור API",
  "מערכת יומן תורים",
  "מערכת שעות/משמרות",
  "התאמה לאפליקציה",
  "קטלוג מוצרים באתר",
  "פיתוח פיצ׳רים חדשים",
  "טפסים מורכבים ואינטגרציות",
  "התאמות מול מערכות חיצוניות",
  "טיפול חירום מחוץ לשעות פעילות",
  "העלאות תוכן בהיקף גדול",
  "ניווט ולינקים בפוטר",
];

export const PORTFOLIO_PROJECTS: PortfolioProject[] = [
  {
    id: "inner-cosmos",
    slug: "inner-cosmos",
    title: "Inner Cosmos",
    client: "Inner Cosmos",
    description: "עיצוב ופיתוח אתר מותג יוקרתי",
    image: "/images/portfolio/inner-cosmos.jpg",
    category: "אתר מותג",
  },
  {
    id: "aquatis",
    slug: "aquatis",
    title: "Aquatis",
    client: "Aquatis",
    description: "אתר תדמית עם חוויית גלילה ייחודית",
    image: "/images/portfolio/aquatis.jpg",
    category: "אתר תדמית",
  },
  {
    id: "titans",
    slug: "titans",
    title: "Titans",
    client: "Titans",
    description: "אתר עם אנימציות מתקדמות ועיצוב דינמי",
    image: "/images/portfolio/titans.jpg",
    category: "אתר דינמי",
  },
  {
    id: "third-eye",
    slug: "third-eye",
    title: "Third Eye",
    client: "Third Eye",
    description: "דף נחיתה ממיר עם עיצוב חדשני",
    image: "/images/portfolio/third-eye.jpg",
    category: "דף נחיתה",
  },
  {
    id: "dental-care",
    slug: "dental-care",
    title: "Dental Care",
    client: "Dental Care",
    description: "אתר מרפאת שיניים עם מערכת תורים",
    image: "/images/portfolio/dental-care.jpg",
    category: "אתר עסקי",
  },
  {
    id: "ams-law",
    slug: "ams-law",
    title: "AMS Law",
    client: "AMS Law",
    description: "אתר משרד עורכי דין מקצועי",
    image: "/images/portfolio/ams-law.jpg",
    category: "אתר עסקי",
  },
];

export const PROCESS_STEPS: ProcessStep[] = [
  {
    number: "I",
    title: "פגישת היכרות",
    description: "נכיר אתכם, נבין את הצרכים ונגדיר את היעדים",
  },
  {
    number: "II",
    title: "אפיון ומחקר",
    description: "מחקר מתחרים, הגדרת קהל יעד ואפיון מלא",
  },
  {
    number: "III",
    title: "עיצוב ראשוני",
    description: "יצירת עיצוב ויזואלי ראשוני לאישורכם",
  },
  {
    number: "IV",
    title: "עיצוב מלא",
    description: "עיצוב כל עמודי האתר כולל מובייל ודסקטופ",
  },
  {
    number: "V",
    title: "פיתוח",
    description: "בניית האתר בטכנולוגיות המתקדמות ביותר",
  },
  {
    number: "VI",
    title: "תוכן ו-SEO",
    description: "הזנת תוכן, אופטימיזציה למנועי חיפוש",
  },
  {
    number: "VII",
    title: "השקה",
    description: "בדיקות סופיות, השקה ותמיכה מתמשכת",
  },
];

export const FAQ_ITEMS: FAQItem[] = [
  {
    question: "כמה זמן לוקח לבנות אתר?",
    answer: "תהליך בניית אתר אורך בין 2-8 שבועות, תלוי במורכבות הפרויקט, כמות העמודים והפיצ׳רים הנדרשים.",
  },
  {
    question: "מה כלול בתחזוקה השוטפת?",
    answer: "תחזוקה שוטפת כוללת עדכוני אבטחה, גיבויים, ניטור ביצועים, תמיכה טכנית ושרתי אחסון.",
  },
  {
    question: "האם האתר יהיה מותאם למובייל?",
    answer: "בהחלט! כל האתרים שלנו מעוצבים בגישת Mobile-First ומותאמים באופן מושלם לכל המכשירים.",
  },
  {
    question: "האם ניתן לעדכן תוכן באתר בעצמי?",
    answer: "כן, אנחנו בונים את האתרים עם ממשק ניהול ידידותי שמאפשר לכם לעדכן תוכן בקלות.",
  },
  {
    question: "מה לגבי קידום אורגני (SEO)?",
    answer: "כל אתר מגיע עם בסיס SEO מוצק כולל מטא תגיות, Schema markup, sitemap ואופטימיזציה טכנית.",
  },
  {
    question: "האם האתר יהיה נגיש?",
    answer: "כן, כל האתרים שלנו עומדים בתקן הנגישות הישראלי IS 5568 ותקן WCAG 2.1 AA.",
  },
];

export const SOCIAL_LINKS = {
  instagram: "https://instagram.com/fuzionwebz",
  facebook: "https://facebook.com/fuzionwebz",
  linkedin: "https://linkedin.com/company/fuzionwebz",
  tiktok: "https://tiktok.com/@fuzionwebz",
};

export const FOOTER_LINKS = {
  services: [
    { label: "בניית אתרים", href: "/#services" },
    { label: "תחזוקה שוטפת", href: "/#pricing" },
    { label: "עיצוב UX/UI", href: "/#services" },
  ],
  resources: [
    { label: "בלוג", href: "/blog" },
    { label: "תיק עבודות", href: "/portfolio" },
    { label: "חנות פונטים", href: "/fonts" },
    { label: "שאלות נפוצות", href: "/faq" },
  ],
  company: [
    { label: "אודות", href: "/about" },
    { label: "צור קשר", href: "/contact" },
    { label: "תנאי שימוש", href: "/terms" },
    { label: "מדיניות פרטיות", href: "/privacy" },
    { label: "הצהרת נגישות", href: "/accessibility" },
  ],
};
