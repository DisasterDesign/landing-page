import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ScrollReveal from "@/components/animations/ScrollReveal";
import Button from "@/components/ui/Button";
import { PORTFOLIO_PROJECTS, SITE_NAME } from "@/lib/constants";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return PORTFOLIO_PROJECTS.map((project) => ({
    slug: project.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = PORTFOLIO_PROJECTS.find((p) => p.slug === slug);

  if (!project) {
    return { title: "פרויקט לא נמצא" };
  }

  return {
    title: project.title,
    description: project.description,
    openGraph: {
      title: `${project.title} | ${SITE_NAME}`,
      description: project.description,
    },
  };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = PORTFOLIO_PROJECTS.find((p) => p.slug === slug);

  if (!project) {
    notFound();
  }

  const currentIndex = PORTFOLIO_PROJECTS.findIndex((p) => p.slug === slug);
  const nextProject =
    PORTFOLIO_PROJECTS[(currentIndex + 1) % PORTFOLIO_PROJECTS.length];

  return (
    <div className="min-h-screen bg-black">
      {/* Hero */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <span className="text-cyan font-bold text-sm uppercase tracking-wider">
              {project.category}
            </span>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold mt-4 mb-6">
              {project.title}
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-gray-400 text-lg md:text-xl max-w-2xl">
              {project.description}
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Project Image Placeholder */}
      <section className="px-6 pb-16">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <div className="aspect-video w-full rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-800 flex items-center justify-center">
              <span className="text-4xl font-bold text-gray-700">
                {project.title}
              </span>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Project Details */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <ScrollReveal className="md:col-span-2">
              <h2 className="text-3xl font-bold text-white mb-6">
                על <span className="text-pink">הפרויקט</span>
              </h2>
              <div className="space-y-4 text-gray-400 leading-relaxed">
                <p>
                  פרויקט {project.title} הוא {project.description}. העבודה כללה
                  תהליך מעמיק של אפיון, עיצוב ופיתוח כדי ליצור חוויית משתמש
                  מושלמת שעונה על הצרכים העסקיים של הלקוח.
                </p>
                <p>
                  האתר תוכנן ועוצב בגישת Mobile-First עם דגש על ביצועים גבוהים,
                  נגישות ואופטימיזציה למנועי חיפוש. הפיתוח נעשה בטכנולוגיות
                  המתקדמות ביותר כדי להבטיח חוויה מהירה וחלקה.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm text-gray-500 font-bold uppercase tracking-wider mb-1">
                    לקוח
                  </h3>
                  <p className="text-white font-bold">{project.client}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-500 font-bold uppercase tracking-wider mb-1">
                    קטגוריה
                  </h3>
                  <p className="text-white font-bold">{project.category}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-500 font-bold uppercase tracking-wider mb-1">
                    שירותים
                  </h3>
                  <p className="text-white font-bold">
                    עיצוב, פיתוח, SEO
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Next Project */}
      <section className="py-20 px-6 border-t border-gray-800">
        <div className="max-w-5xl mx-auto text-center">
          <ScrollReveal>
            <p className="text-gray-500 text-sm uppercase tracking-wider mb-4">
              הפרויקט הבא
            </p>
            <Link href={`/portfolio/${nextProject.slug}`}>
              <h2 className="text-4xl md:text-6xl font-extrabold text-white hover:text-pink transition-colors mb-8">
                {nextProject.title}
              </h2>
            </Link>
            <Link href="/portfolio">
              <Button variant="secondary">כל הפרויקטים</Button>
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
