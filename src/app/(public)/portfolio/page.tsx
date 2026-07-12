import type { Metadata } from "next";
import ScrollReveal from "@/components/animations/ScrollReveal";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { ALL_GALLERY_PROJECTS } from "@/lib/portfolio-data";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "תיק עבודות — פרויקטים נבחרים",
  description:
    "צפו בפרויקטים הנבחרים שלנו — אתרים חיים שבנינו: עיצוב, פיתוח ו-UX/UI מתקדם. Fuzion Webz.",
  alternates: {
    canonical: `${SITE_URL}/portfolio`,
  },
  openGraph: {
    title: `תיק עבודות | ${SITE_NAME}`,
    description: "צפו בפרויקטים הנבחרים שלנו – עיצוב ופיתוח אתרים מתקדמים.",
  },
};

export default function PortfolioPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "דף הבית", url: SITE_URL },
          { name: "תיק עבודות", url: `${SITE_URL}/portfolio` },
        ]}
      />
      <div className="min-h-screen bg-white">
        <section className="py-24 md:py-32 px-6">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-center mb-6">
                תיק <span className="text-pink">עבודות</span>
              </h1>
            </ScrollReveal>
            <ScrollReveal delay={0.2}>
              <p className="text-gray-700 text-lg md:text-xl text-center max-w-2xl mx-auto mb-16">
                אתרים חיים שאנחנו בונים ומלווים. לחצו על כל עבודה לביקור באתר.
              </p>
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {ALL_GALLERY_PROJECTS.map((project, i) => (
                <ScrollReveal key={project.id} delay={(i % 3) * 0.08}>
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${project.name} — ${project.description} (נפתח בכרטיסייה חדשה)`}
                    className="group block overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 transition-transform duration-300 hover:-translate-y-1.5 focus-visible:outline-2 focus-visible:outline-pink focus-visible:outline-offset-4"
                  >
                    <div
                      className="relative aspect-[16/10] overflow-hidden"
                      style={{ background: project.gradient }}
                    >
                      {project.poster ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={project.poster}
                          alt={project.name}
                          loading="lazy"
                          decoding="async"
                          className={`absolute inset-0 w-full h-full transition-transform duration-500 group-hover:scale-[1.04] ${
                            project.contain ? "object-contain p-8" : "object-cover"
                          }`}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center p-4">
                          <span className="text-white/90 text-xl font-extrabold text-center">
                            {project.name}
                          </span>
                        </div>
                      )}
                      <span
                        dir="ltr"
                        className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-[11px] font-bold text-black opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300"
                      >
                        VISIT SITE <span aria-hidden="true">↗</span>
                      </span>
                    </div>
                    <div className="px-5 py-4 text-right">
                      <h2 className="text-base md:text-lg font-extrabold text-black transition-colors group-hover:text-pink">
                        {project.name}
                      </h2>
                      <p className="text-gray-600 text-sm mt-0.5 line-clamp-1">
                        {project.description}
                      </p>
                    </div>
                  </a>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
