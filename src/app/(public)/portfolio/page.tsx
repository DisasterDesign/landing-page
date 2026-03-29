import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/animations/ScrollReveal";
import Card from "@/components/ui/Card";
import { PORTFOLIO_PROJECTS, SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "תיק עבודות",
  description:
    "צפו בפרויקטים שלנו – אתרי תדמית, חנויות אונליין, דפי נחיתה ועוד. Fuzion Webz מציגה עבודות עיצוב ופיתוח מתקדמות.",
  openGraph: {
    title: `תיק עבודות | ${SITE_NAME}`,
    description: "צפו בפרויקטים הנבחרים שלנו – עיצוב ופיתוח אתרים מתקדמים.",
  },
};

export default function PortfolioPage() {
  return (
    <div className="min-h-screen bg-black">
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-center mb-6">
              תיק <span className="text-pink">עבודות</span>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-gray-400 text-lg md:text-xl text-center max-w-2xl mx-auto mb-16">
              מבחר מהפרויקטים האחרונים שלנו. כל פרויקט מייצג שילוב של עיצוב
              חדשני, טכנולוגיה מתקדמת ותוצאות עסקיות.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {PORTFOLIO_PROJECTS.map((project, i) => (
              <ScrollReveal key={project.id} delay={i * 0.1}>
                <Link href={`/portfolio/${project.slug}`}>
                  <Card
                    glowColor={i % 2 === 0 ? "pink" : "cyan"}
                    className="group cursor-pointer overflow-hidden"
                  >
                    {/* Image placeholder */}
                    <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl mb-4 overflow-hidden relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-bold text-gray-700 group-hover:text-pink transition-colors">
                          {project.title}
                        </span>
                      </div>
                    </div>

                    <span className="text-xs text-cyan font-bold uppercase tracking-wider">
                      {project.category}
                    </span>
                    <h2 className="text-xl font-bold text-white mt-2 group-hover:text-pink transition-colors">
                      {project.title}
                    </h2>
                    <p className="text-gray-400 mt-2 text-sm">
                      {project.description}
                    </p>
                  </Card>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
