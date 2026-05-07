import type { Metadata } from "next";
import ScrollReveal from "@/components/animations/ScrollReveal";
import Card from "@/components/ui/Card";
import { TEAM_MEMBERS, SITE_NAME, SITE_URL } from "@/lib/constants";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "אודות — הצוות מאחורי Fuzion Webz",
  description:
    "הכירו את הצוות של Fuzion Webz — סטודיו בוטיק לעיצוב ובניית אתרים מתקדמים עם מעל עשור ניסיון בעולם הדיגיטל.",
  alternates: {
    canonical: `${SITE_URL}/about`,
  },
  openGraph: {
    title: `אודות | ${SITE_NAME}`,
    description:
      "הכירו את Fuzion Webz – סטודיו בוטיק לעיצוב ובניית אתרים מתקדמים.",
  },
};

const VALUES = [
  {
    title: "חדשנות",
    description:
      "אנחנו תמיד בחזית הטכנולוגיה, מביאים את הפתרונות המתקדמים ביותר ללקוחותינו.",
    icon: "💡",
  },
  {
    title: "מצוינות",
    description:
      "לא מתפשרים על איכות. כל פיקסל, כל שורת קוד – חייבים להיות מושלמים.",
    icon: "⭐",
  },
  {
    title: "שקיפות",
    description:
      "תקשורת פתוחה וישירה לאורך כל הדרך. אתם תמיד יודעים מה קורה בפרויקט.",
    icon: "🔍",
  },
  {
    title: "תוצאות",
    description:
      "אנחנו לא בונים אתרים יפים בלבד – אנחנו בונים אתרים שמייצרים תוצאות עסקיות.",
    icon: "🚀",
  },
];

const MILESTONES = [
  { year: "2023", title: "הקמת הסטודיו", description: "Fuzion Webz נולד מתוך תשוקה משותפת לעיצוב ופיתוח." },
  { year: "2024", title: "10 פרויקטים ראשונים", description: "השלמנו את עשרת הפרויקטים הראשונים בהצלחה." },
  { year: "2025", title: "הרחבת שירותים", description: "הוספת שירותי תלת מימד, אנימציות מתקדמות ואתרי מכירות." },
  { year: "2026", title: "צמיחה והתפתחות", description: "המשך צמיחה עם לקוחות מהארץ ומהעולם." },
];

export default function AboutPage() {
  return (
    <>
    <BreadcrumbJsonLd items={[
      { name: "דף הבית", url: SITE_URL },
      { name: "אודות", url: `${SITE_URL}/about` },
    ]} />
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <ScrollReveal>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold mb-6">
              אודות <span className="text-pink">Fuzion Webz</span>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-gray-700 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto">
              Fuzion Webz הוא סטודיו בוטיק לעיצוב ופיתוח אתרים, שנוסד מתוך
              אמונה שכל עסק ראוי לנוכחות דיגיטלית מרשימה ואפקטיבית. אנחנו
              משלבים עיצוב חדשני עם טכנולוגיה מתקדמת כדי ליצור חוויות דיגיטליות
              שלא רק נראות מדהים – אלא גם מייצרות תוצאות עסקיות אמיתיות.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-extrabold text-center mb-16">
              הצוות <span className="text-cyan">שלנו</span>
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {TEAM_MEMBERS.map((member, i) => (
              <ScrollReveal key={member.name} delay={i * 0.15}>
                <Card glowColor={i % 2 === 0 ? "pink" : "cyan"} className="text-center">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-pink to-cyan flex items-center justify-center text-3xl font-bold">
                    {member.nameHe.charAt(0)}
                  </div>
                  <h3 className="text-2xl font-bold text-black mb-1">
                    {member.nameHe}
                  </h3>
                  <p className="text-pink font-bold mb-4">{member.roleHe}</p>
                  <p className="text-gray-700 leading-relaxed text-sm">
                    {member.bio}
                  </p>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-extrabold text-center mb-16">
              הדרך <span className="text-pink">שלנו</span>
            </h2>
          </ScrollReveal>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute right-6 md:right-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-pink via-cyan to-pink" />

            <div className="space-y-12">
              {MILESTONES.map((milestone, i) => (
                <ScrollReveal key={milestone.year} delay={i * 0.1}>
                  <div className="relative flex items-start gap-8 md:gap-12">
                    {/* Dot */}
                    <div className="absolute right-4 md:right-[calc(50%-8px)] w-4 h-4 rounded-full bg-pink border-2 border-black z-10" />

                    <div className={`mr-12 md:mr-0 ${i % 2 === 0 ? "md:ml-auto md:w-[45%]" : "md:mr-auto md:w-[45%] md:text-left"}`}>
                      <span className="text-cyan font-bold text-lg">
                        {milestone.year}
                      </span>
                      <h3 className="text-xl font-bold text-black mt-1">
                        {milestone.title}
                      </h3>
                      <p className="text-gray-700 mt-2">
                        {milestone.description}
                      </p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <h2 className="text-4xl md:text-5xl font-extrabold text-center mb-16">
              הערכים <span className="text-cyan">שלנו</span>
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {VALUES.map((value, i) => (
              <ScrollReveal key={value.title} delay={i * 0.1}>
                <Card glowColor={i % 2 === 0 ? "cyan" : "pink"}>
                  <div className="text-4xl mb-4">{value.icon}</div>
                  <h3 className="text-xl font-bold text-black mb-2">
                    {value.title}
                  </h3>
                  <p className="text-gray-700">{value.description}</p>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
