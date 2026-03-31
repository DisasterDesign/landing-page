import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ScrollReveal from "@/components/animations/ScrollReveal";
import Card from "@/components/ui/Card";
import { TEAM_MEMBERS, SITE_URL, SITE_NAME } from "@/lib/constants";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";

function slugify(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function getMemberBySlug(slug: string) {
  return TEAM_MEMBERS.find((m) => slugify(m.name) === slug);
}

export async function generateStaticParams() {
  return TEAM_MEMBERS.map((m) => ({ slug: slugify(m.name) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const member = getMemberBySlug(slug);
  if (!member) return {};

  return {
    title: `${member.nameHe} — ${member.roleHe}`,
    description: member.bio,
    alternates: {
      canonical: `${SITE_URL}/about/${slug}`,
    },
    openGraph: {
      title: `${member.nameHe} | ${SITE_NAME}`,
      description: member.bio,
    },
  };
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const member = getMemberBySlug(slug);
  if (!member) notFound();

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: member.name,
    alternateName: member.nameHe,
    jobTitle: member.role,
    email: member.email,
    worksFor: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    url: `${SITE_URL}/about/${slug}`,
  };

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "דף הבית", url: SITE_URL },
          { name: "אודות", url: `${SITE_URL}/about` },
          { name: member.nameHe, url: `${SITE_URL}/about/${slug}` },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />

      <div className="min-h-screen bg-black">
        <section className="py-24 md:py-32 px-6">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <div className="text-center mb-12">
                <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-pink to-cyan flex items-center justify-center text-5xl font-bold">
                  {member.nameHe.charAt(0)}
                </div>
                <h1 className="text-4xl md:text-6xl font-extrabold mb-2">
                  {member.nameHe}
                </h1>
                <p className="text-pink text-xl font-bold">{member.roleHe}</p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <Card glowColor="cyan" className="text-center">
                <p className="text-gray-300 leading-relaxed text-lg">
                  {member.bio}
                </p>
                <div className="mt-6">
                  <a
                    href={`mailto:${member.email}`}
                    className="text-cyan hover:underline"
                  >
                    {member.email}
                  </a>
                </div>
              </Card>
            </ScrollReveal>
          </div>
        </section>
      </div>
    </>
  );
}
