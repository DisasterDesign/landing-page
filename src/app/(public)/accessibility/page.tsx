import type { Metadata } from "next";
import ScrollReveal from "@/components/animations/ScrollReveal";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "הצהרת נגישות",
  description: `הצהרת הנגישות של ${SITE_NAME} בהתאם לתקן הישראלי IS 5568 ותקן WCAG 2.1 AA — נגישות מלאה לכל המשתמשים.`,
  alternates: {
    canonical: `${SITE_URL}/accessibility`,
  },
  openGraph: {
    title: `הצהרת נגישות | ${SITE_NAME}`,
    description: `הצהרת הנגישות של ${SITE_NAME} בהתאם לתקן IS 5568.`,
  },
};

export default function AccessibilityPage() {
  return (
    <>
    <BreadcrumbJsonLd items={[
      { name: "דף הבית", url: SITE_URL },
      { name: "נגישות", url: `${SITE_URL}/accessibility` },
    ]} />
    <div className="min-h-screen bg-white">
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <h1 className="text-5xl md:text-7xl font-extrabold text-center mb-16">
              הצהרת <span className="text-pink">נגישות</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <div className="prose space-y-8 text-gray-700 leading-relaxed">
              <div>
                <h2 className="text-xl font-bold text-black mb-3">כללי</h2>
                <p>
                  Fuzion Webz מחויבת להנגשת האתר לאנשים עם מוגבלויות, בהתאם
                  לחוק שוויון זכויות לאנשים עם מוגבלות, תשנ&quot;ח-1998
                  ותקנותיו, לרבות תקנות שוויון זכויות לאנשים עם מוגבלות
                  (התאמות נגישות לשירות), תשע&quot;ג-2013, ובהתאם לתקן הישראלי
                  IS 5568 המבוסס על הנחיות WCAG 2.1 ברמה AA.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-black mb-3">
                  התאמות הנגישות שבוצעו באתר
                </h2>
                <ul className="list-disc list-inside space-y-2">
                  <li>ניווט באמצעות מקלדת בלבד (Tab, Enter, Escape)</li>
                  <li>תמיכה בקוראי מסך (NVDA, JAWS, VoiceOver)</li>
                  <li>טקסט חלופי (alt) לכל התמונות המשמעותיות</li>
                  <li>ניגודיות צבעים מספקת בהתאם לתקן WCAG AA</li>
                  <li>אפשרות להגדלת טקסט ללא פגיעה בפונקציונליות</li>
                  <li>כותרות מובנות בהיררכיה נכונה (h1-h6)</li>
                  <li>טפסים נגישים עם תוויות (labels) מתאימות</li>
                  <li>קישורי דילוג לתוכן הראשי (Skip to content)</li>
                  <li>תמיכה בכיוון RTL בעברית</li>
                  <li>
                    תגי ARIA מתאימים לרכיבים אינטראקטיביים (תפריטים, כפתורים,
                    דיאלוגים)
                  </li>
                  <li>ווידג&apos;ט נגישות מובנה לשליטה בגודל טקסט, ניגודיות ואנימציות</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-bold text-black mb-3">
                  דפדפנים וטכנולוגיות מסייעות
                </h2>
                <p>
                  האתר נבדק ונמצא תואם לעבודה עם הדפדפנים הנפוצים: Google
                  Chrome, Mozilla Firefox, Safari ו-Microsoft Edge בגרסאותיהם
                  העדכניות, וכן עם קוראי המסך NVDA ו-VoiceOver.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-black mb-3">
                  פרטי רכז/ת נגישות
                </h2>
                <p>
                  במידה ונתקלתם בבעיית נגישות או שיש לכם הצעה לשיפור הנגישות
                  באתר, אנא פנו אלינו:
                </p>
                <ul className="mt-3 space-y-1">
                  <li>
                    <strong className="text-black">שם:</strong> צוות Fuzion Webz
                  </li>
                  <li>
                    <strong className="text-black">דוא&quot;ל:</strong>{" "}
                    <a
                      href="mailto:info@fuzionwebz.com"
                      className="text-pink hover:text-cyan transition-colors"
                    >
                      info@fuzionwebz.com
                    </a>
                  </li>
                  <li>
                    <strong className="text-black">טלפון:</strong>{" "}
                    <a
                      href="tel:+972547136666"
                      className="text-pink hover:text-cyan transition-colors"
                    >
                      054-713-6666
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-bold text-black mb-3">
                  תאריך עדכון ההצהרה
                </h2>
                <p>הצהרת נגישות זו עודכנה לאחרונה בתאריך: מרץ 2026.</p>
                <p className="mt-2">
                  אנו ממשיכים לפעול באופן שוטף לשיפור הנגישות באתר וננקוט
                  בכל הצעדים הנדרשים כדי להבטיח שהאתר יהיה נגיש לכל המשתמשים.
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
    </>
  );
}
