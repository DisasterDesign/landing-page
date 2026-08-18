// Single source of truth for the works gallery — consumed by BOTH the homepage
// Portfolio section (rich hover/video cards) and the /portfolio page (SSR grid).
// Keep them in sync by editing here only.

export interface GalleryProject {
  id: string;
  name: string;
  description: string;
  gradient: string;
  url: string;
  video?: string;
  poster?: string;
  /** object-contain on the gradient (logo/text marks, not photos). */
  contain?: boolean;
}

// Hero pair — the two lead clients, big autoplay cards on the homepage.
export const HERO_PROJECTS: GalleryProject[] = [
  { id: "innercosmos", name: "Inner Cosmos", description: "מדיטציה בהתאמה אישית מבוססת AI", gradient: "linear-gradient(135deg, #667eea, #764ba2)", url: "https://innercosmos.ai/", video: "/c-video/compressed/INNERCOSMOS.mp4", poster: "/c-video/posters/INNERCOSMOS.webp" },
  { id: "tisar", name: "טיסאר", description: "מערכת תחזוקה חזויה למכונות · מקורות", gradient: "linear-gradient(135deg, #241a52, #3b2d7a)", url: "https://www.tisar.com/", poster: "/images/portfolio-tiles/tisar.png" },
];

// Uniform grid — the five remaining priority clients first, then the rest.
export const WORK_PROJECTS: GalleryProject[] = [
  { id: "of-jerusalem", name: "עוף ירושלים", description: "מהדרין מאז 2001 — מהלול עד הצלחת", gradient: "linear-gradient(135deg, #7a1f1f, #c0392b)", url: "https://ofjerusalem.com/", poster: "/images/portfolio-tiles/of-jerusalem.jpg" },
  { id: "olamhamamtakim", name: "עולם הממתקים", description: "רשת חנויות ממתקים", gradient: "linear-gradient(135deg, #ff9a9e, #fecfef)", url: "https://olamhamamtakim.co.il/", video: "/c-video/compressed/olamhamamtakim.mp4", poster: "/c-video/posters/olamhamamtakim.webp" },
  { id: "dentalcare", name: "Dental Care", description: "אתר מרפאת שיניים", gradient: "linear-gradient(135deg, #74ebd5, #ACB6E5)", url: "https://dentalcare-clinic.co.il/", video: "/c-video/compressed/dental-care.mp4", poster: "/c-video/posters/dental-care.webp" },
  { id: "higold", name: "HIGOLD ישראל", description: "ריהוט חוץ יוקרתי", gradient: "linear-gradient(135deg, #8a6d1e, #d4af37)", url: "https://higold-israel.com/", poster: "/images/portfolio-tiles/higold.jpg" },
  { id: "naotplus", name: "נאות", description: "עכשיו הכל מתחבר", gradient: "linear-gradient(135deg, #1f3a2d, #3f7a55)", url: "https://naotplus.com/", poster: "/images/portfolio-tiles/naotplus.jpg" },
  { id: "titans", name: "Titans Global", description: "Global investment platform", gradient: "linear-gradient(135deg, #F37021, #ff6b6b)", url: "https://titans.global/", video: "/c-video/compressed/Titans.mp4", poster: "/c-video/posters/Titans.webp" },
  { id: "aquatis", name: "Aquatis", description: "Water management platform", gradient: "linear-gradient(135deg, #11998e, #38ef7d)", url: "https://aquatis.ai/", video: "/c-video/compressed/Aquatis.mp4", poster: "/c-video/posters/Aquatis.webp" },
  { id: "emek-ayalon", name: "עמק איילון", description: "ניהול תשתיות ופרויקטים", gradient: "linear-gradient(135deg, #c5a55a, #e8d5a0)", url: "https://www.emek-ayalon.com/", video: "/c-video/compressed/emek-ayalon.mp4", poster: "/c-video/posters/emek-ayalon.webp" },
  { id: "ams-law", name: "AMS Law", description: "משרד עורכי דין", gradient: "linear-gradient(135deg, #1a1a2e, #16213e)", url: "https://ams-law.com/", video: "/c-video/compressed/ams-law.mp4", poster: "/c-video/posters/ams-law.webp" },
  { id: "peony-lion", name: "Peony Lion Group", description: "קבוצת השקעות בינלאומית", gradient: "linear-gradient(135deg, #5c1a33, #a34d6d)", url: "https://peonylion.com/", poster: "/images/portfolio-tiles/peony-lion.jpg" },
  { id: "fixtickets", name: "פיקס טיקטס", description: "שירותי תיקון ושירות", gradient: "linear-gradient(135deg, #a18cd1, #fbc2eb)", url: "https://fixtickets.co.il/", video: "/c-video/compressed/fixtickets.mp4", poster: "/c-video/posters/fixtickets.webp" },
  { id: "thirdeye", name: "Third Eye", description: "Analytics dashboard", gradient: "linear-gradient(135deg, #4facfe, #00f2fe)", url: "https://3i.titans.global/", video: "/c-video/compressed/3i.mp4", poster: "/c-video/posters/3i.webp" },
  { id: "natansart", name: "Natan's Art", description: "טפטים מעוצבים בהשראת אומנות", gradient: "linear-gradient(135deg, #2c3e50, #8e44ad)", url: "https://natansart.com/", poster: "/images/portfolio-tiles/natansart.jpg" },
  { id: "alto-mare", name: "Alto Mare", description: "Luxury sea-view residences", gradient: "linear-gradient(135deg, #0f3057, #4a7fa5)", url: "https://alto-mare.pages.dev/", poster: "/images/portfolio-tiles/alto-mare.jpg" },
  { id: "jumarie", name: "Jumarie", description: "אופנת נשים פרימיום", gradient: "linear-gradient(135deg, #d5a6bd, #f5e0e8)", url: "https://jumarie.co/en", poster: "/images/portfolio-tiles/jumarie.svg", contain: true },
  { id: "roza", name: "רוזה", description: "מסעדה ברחובות", gradient: "linear-gradient(135deg, #2d4a22, #5a7a42)", url: "https://rozarehovot.co.il/", video: "/c-video/compressed/roza.mp4", poster: "/c-video/posters/roza.webp" },
  { id: "baguette", name: "באגט התרנגול", description: "מסעדה", gradient: "linear-gradient(135deg, #3a2a1a, #6b4c30)", url: "https://hatarnegol.com/", video: "/c-video/compressed/baguette.mp4", poster: "/c-video/posters/baguette.webp" },
  { id: "helena", name: "הלן המתקשרת", description: "תיקשור וקלפי טארוט", gradient: "linear-gradient(135deg, #1a1033, #3d2266)", url: "https://maalen-landing.pages.dev/", video: "/c-video/compressed/helena.mp4", poster: "/c-video/posters/helena.webp" },
  { id: "juju", name: "JUJU Asian Kitchen", description: "מטבח אסייתי בממילא ירושלים", gradient: "linear-gradient(135deg, #1b4332, #d90429)", url: "https://juju-asian-kitchen.pages.dev/", poster: "/images/portfolio-tiles/juju.jpg" },
  { id: "light4u", name: "יהלום תאורה", description: "חנות תאורה מעוצבת", gradient: "linear-gradient(135deg, #3d3106, #b39220)", url: "https://www.light4u.co.il/", poster: "/images/portfolio-tiles/light4u.jpg" },
  { id: "shai-haim", name: "שי פרויקטים", description: "עבודות גמר ובנייה", gradient: "linear-gradient(135deg, #37474f, #78909c)", url: "https://shai-projects-web.davidalelad.workers.dev/", poster: "/images/portfolio-tiles/shai-haim.jpg" },
  { id: "asu", name: "ASU Clinics", description: "אסתטיקה רפואית בהתאמה אישית", gradient: "linear-gradient(135deg, #4a6572, #a7c5cf)", url: "https://asu-clinics.pages.dev/", poster: "/images/portfolio-tiles/asu.jpg" },
  { id: "yes-we-can", name: "Yes we CAN", description: "אריזה ומכירה בדרך חדשה", gradient: "linear-gradient(135deg, #0077b6, #90e0ef)", url: "https://yeswecanto.com/", poster: "/images/portfolio-tiles/yes-we-can.jpg" },
  { id: "yoni-shawarma", name: "יוני 71", description: "שווארמה כשרה ברמת השרון", gradient: "linear-gradient(135deg, #6a3805, #c8781a)", url: "https://yoni71.davidalelad.workers.dev/", poster: "/images/portfolio-tiles/yoni-shawarma.jpg" },
  { id: "burger-yoni", name: "בורגר יוני 71", description: "המבורגרים כשרים ברמת השרון", gradient: "linear-gradient(135deg, #4a1a05, #a3541a)", url: "https://burger-yoni-71.pages.dev/" },
];

// Full ordered list (heroes first) — used by the /portfolio page.
export const ALL_GALLERY_PROJECTS: GalleryProject[] = [...HERO_PROJECTS, ...WORK_PROJECTS];
