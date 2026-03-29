import type { Metadata } from "next";
import ScrollReveal from "@/components/animations/ScrollReveal";
import Card from "@/components/ui/Card";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "בלוג",
  description:
    "הבלוג של Fuzion Webz – טיפים, מדריכים ותובנות בנושאי עיצוב אתרים, פיתוח ושיווק דיגיטלי.",
  openGraph: {
    title: `בלוג | ${SITE_NAME}`,
    description: "טיפים, מדריכים ותובנות בנושאי עיצוב אתרים ושיווק דיגיטלי.",
  },
};

const PLACEHOLDER_POSTS = [
  {
    title: "איך לבחור את האתר הנכון לעסק שלך?",
    excerpt: "מדריך מקיף שיעזור לכם להבין איזה סוג אתר מתאים בדיוק לעסק שלכם.",
    category: "מדריכים",
  },
  {
    title: "5 טרנדים בעיצוב אתרים ל-2026",
    excerpt: "הטרנדים החמים ביותר בעולם עיצוב האתרים שכדאי להכיר.",
    category: "עיצוב",
  },
  {
    title: "למה המהירות של האתר חשובה?",
    excerpt: "איך מהירות הטעינה משפיעה על חוויית המשתמש ועל הדירוג בגוגל.",
    category: "ביצועים",
  },
  {
    title: "SEO למתחילים: מדריך מלא",
    excerpt: "כל מה שצריך לדעת על אופטימיזציה למנועי חיפוש בשפה פשוטה.",
    category: "SEO",
  },
  {
    title: "UX/UI: ההבדל שמשנה את הכל",
    excerpt: "למה חוויית משתמש טובה היא ההשקעה הכי משתלמת שיש.",
    category: "עיצוב",
  },
  {
    title: "בניית אתר מכירות מצליח",
    excerpt: "הטיפים הכי חשובים לבניית חנות אונליין שמוכרת באמת.",
    category: "מסחר אלקטרוני",
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-black">
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-center mb-6">
              ה<span className="text-pink">בלוג</span>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-gray-400 text-lg md:text-xl text-center max-w-2xl mx-auto mb-16">
              תוכן מקצועי בנושאי עיצוב, פיתוח ושיווק דיגיטלי. בקרוב נוסיף
              מאמרים חדשים!
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {PLACEHOLDER_POSTS.map((post, i) => (
              <ScrollReveal key={post.title} delay={i * 0.1}>
                <Card glowColor={i % 2 === 0 ? "pink" : "cyan"} className="relative">
                  {/* Coming soon badge */}
                  <div className="absolute top-4 left-4 bg-pink/20 text-pink text-xs font-bold px-3 py-1 rounded-full">
                    בקרוב
                  </div>

                  <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl mb-4" />

                  <span className="text-cyan text-xs font-bold uppercase tracking-wider">
                    {post.category}
                  </span>
                  <h2 className="text-lg font-bold text-white mt-2 mb-2">
                    {post.title}
                  </h2>
                  <p className="text-gray-400 text-sm">{post.excerpt}</p>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
