import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ScrollReveal from "@/components/animations/ScrollReveal";
import Card from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import { SITE_NAME, SITE_URL, SERVICES } from "@/lib/constants";
import { BreadcrumbJsonLd, FAQJsonLd } from "@/components/seo/JsonLd";
import { SERVICE_PAGES, getServicePage } from "@/lib/services-content";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return SERVICE_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getServicePage(slug);
  if (!page) return { title: "שירות לא נמצא" };
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `${SITE_URL}/services/${encodeURIComponent(page.slug)}` },
    openGraph: {
      title: `${page.metaTitle} | ${SITE_NAME}`,
      description: page.metaDescription,
    },
  };
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const page = getServicePage(slug);
  if (!page) notFound();

  // Only published related posts — scheduled ones join automatically later.
  const relatedPosts = await prisma.blogPost.findMany({
    where: { slug: { in: page.relatedPostSlugs }, published: true },
    select: { slug: true, title: true, coverImage: true },
    take: 4,
  });
  // Preserve the curated order.
  relatedPosts.sort(
    (a, b) => page.relatedPostSlugs.indexOf(a.slug) - page.relatedPostSlugs.indexOf(b.slug)
  );

  const siblings = SERVICE_PAGES.filter((p) => p.slug !== page.slug);
  const serviceMeta = SERVICES.find((s) => s.id === page.serviceId);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "דף הבית", url: SITE_URL },
          { name: "שירותים", url: `${SITE_URL}/services` },
          { name: page.h1, url: `${SITE_URL}/services/${encodeURIComponent(page.slug)}` },
        ]}
      />
      <FAQJsonLd items={page.faq.map((f) => ({ question: f.q, answer: f.a }))} />

      <div className="min-h-screen bg-white">
        {/* Hero */}
        <section className="pt-24 md:pt-32 pb-10 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <ScrollReveal>
              <p className="text-cyan-dark font-bold text-sm uppercase tracking-wider mb-4">
                <Link href="/services" className="hover:text-pink transition-colors">
                  שירותים
                </Link>{" "}
                / {serviceMeta?.title ?? page.h1}
              </p>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold mb-8 text-black">
                {page.h1}
              </h1>
            </ScrollReveal>
            <ScrollReveal delay={0.15}>
              <div className="space-y-4 text-right">
                {page.intro.map((para, i) => (
                  <p key={i} className="text-gray-700 text-lg leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-12 md:py-16 px-6">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <h2 className="text-3xl md:text-5xl font-extrabold text-center text-black mb-12">
                מה מקבלים
              </h2>
            </ScrollReveal>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {page.benefits.map((b, i) => (
                <ScrollReveal key={b.title} delay={(i % 3) * 0.1}>
                  <Card glowColor={i % 2 === 0 ? "pink" : "cyan"} className="h-full">
                    <h3 className="text-xl font-bold text-black mb-2">{b.title}</h3>
                    <p className="text-gray-700 text-[15px] leading-relaxed">{b.text}</p>
                  </Card>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Process */}
        <section className="py-12 md:py-16 px-6">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <h2 className="text-3xl md:text-5xl font-extrabold text-center text-black mb-12">
                איך זה עובד
              </h2>
            </ScrollReveal>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {page.process.map((step, i) => (
                <ScrollReveal key={step.title} delay={i * 0.1}>
                  <div className="text-center md:text-right">
                    <span className="text-5xl font-extrabold text-pink/30">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-lg font-bold text-black mt-2 mb-1">{step.title}</h3>
                    <p className="text-gray-700 text-sm leading-relaxed">{step.text}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-12 md:py-16 px-6">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <h2 className="text-3xl md:text-5xl font-extrabold text-center text-black mb-12">
                שאלות נפוצות
              </h2>
            </ScrollReveal>
            <div className="space-y-4">
              {page.faq.map((f, i) => (
                <ScrollReveal key={f.q} delay={i * 0.05}>
                  <details className="group bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
                    <summary className="cursor-pointer list-none px-6 py-4 font-bold text-black flex items-center justify-between gap-3">
                      <span>{f.q}</span>
                      <span className="text-pink shrink-0 transition-transform group-open:rotate-45 text-xl leading-none">
                        +
                      </span>
                    </summary>
                    <p className="px-6 pb-5 text-gray-700 leading-relaxed">{f.a}</p>
                  </details>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Related posts */}
        {relatedPosts.length > 0 && (
          <section className="py-12 md:py-16 px-6">
            <div className="max-w-6xl mx-auto">
              <ScrollReveal>
                <h2 className="text-3xl md:text-5xl font-extrabold text-center text-black mb-12">
                  מדריכים מהבלוג
                </h2>
              </ScrollReveal>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {relatedPosts.map((post, i) => (
                  <ScrollReveal key={post.slug} delay={(i % 4) * 0.08}>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="group block h-full rounded-2xl border border-gray-200 bg-gray-50 p-5 transition-all duration-300 hover:border-gray-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.1)]"
                    >
                      <p className="font-bold text-black leading-snug group-hover:text-pink transition-colors">
                        {post.title}
                      </p>
                      <span className="inline-block mt-3 text-sm text-cyan-dark font-bold">
                        לקריאה ←
                      </span>
                    </Link>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="py-16 md:py-20 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <p className="text-gray-700 text-lg leading-relaxed mb-8">{page.ctaLine}</p>
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                <Link
                  href="/contact"
                  className="px-8 py-3.5 bg-pink text-white rounded-full font-bold hover:bg-pink/85 transition-colors"
                >
                  דברו איתנו
                </Link>
                <Link
                  href="/portfolio"
                  className="px-8 py-3.5 border border-gray-300 text-gray-700 rounded-full font-bold hover:border-black hover:text-black transition-colors"
                >
                  לתיק העבודות
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Sibling services */}
        <section className="pb-16 px-6">
          <div className="max-w-5xl mx-auto text-center">
            <p className="text-sm text-gray-500 mb-4">שירותים נוספים</p>
            <div className="flex flex-wrap justify-center gap-3">
              {siblings.map((s) => (
                <Link
                  key={s.slug}
                  href={`/services/${s.slug}`}
                  className="text-sm px-4 py-2 rounded-full border border-gray-200 text-gray-700 hover:border-pink hover:text-pink transition-colors"
                >
                  {s.h1}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
