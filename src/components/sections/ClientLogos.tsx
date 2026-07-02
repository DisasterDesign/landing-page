"use client";

/**
 * Trusted-by logo strip — an infinite marquee of client logos, ordered by
 * company size (biggest first). Logos render as uniform dark silhouettes
 * (works for any logo color on the white strip) and reveal their true
 * colors on hover. Clients without a logo file yet fall back to a styled
 * text mark — drop a file in /public/logos/ and add `logo` to upgrade.
 */

interface ClientMark {
  id: string;
  name: string;
  /** Optional secondary line (e.g. parent company). */
  sub?: string;
  /** Logo image under /public/logos/. Falls back to a text mark. */
  logo?: string;
  /** Latin brands render better LTR. */
  ltr?: boolean;
}

// Order set by Elad (biggest/flagship clients first).
const CLIENTS: ClientMark[] = [
  { id: "solel-boneh", name: "סולל בונה", logo: "/logos/solel-boneh.svg" },
  { id: "of-jerusalem", name: "עוף ירושלים", logo: "/logos/of-jerusalem.png" },
  { id: "olamhamamtakim", name: "עולם הממתקים", logo: "/logos/olamhamamtakim.png" },
  { id: "higold", name: "HIGOLD", logo: "/logos/higold.svg", ltr: true },
  { id: "tissar", name: "טיסאר", sub: "מקורות" },
  { id: "aquatis", name: "AQUATIS", logo: "/logos/aquatis.png", ltr: true },
  { id: "inner-cosmos", name: "INNER COSMOS", logo: "/logos/inner-cosmos.png", ltr: true },
  { id: "emek-ayalon", name: "עמק איילון" },
  { id: "naot", name: "נאות", logo: "/logos/naot.svg" },
  { id: "titans", name: "TITANS", logo: "/logos/titans.svg", ltr: true },
  { id: "peony-lion", name: "PEONY LION", logo: "/logos/peony-lion.png", ltr: true },
  { id: "ams-law", name: "AMS LAW", logo: "/logos/ams-law.svg", ltr: true },
  { id: "jumarie", name: "JUMARIE", logo: "/logos/jumarie.svg", ltr: true },
  { id: "juju", name: "JUJU", ltr: true },
];

function Track() {
  return (
    <div className="flex items-center shrink-0" dir="ltr">
      {CLIENTS.map((c) => (
        <span
          key={c.id}
          dir={c.ltr ? "ltr" : "rtl"}
          className="logo-item mx-8 md:mx-11 inline-flex items-center gap-2 whitespace-nowrap select-none"
          title={c.sub ? `${c.name} — ${c.sub}` : c.name}
        >
          {c.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.logo}
              alt={c.name}
              loading="lazy"
              className="logo-img h-9 md:h-11 w-auto max-w-[170px] object-contain"
            />
          ) : (
            <span className="inline-flex items-baseline gap-2">
              <span className="logo-text text-xl md:text-2xl font-extrabold tracking-tight">
                {c.name}
              </span>
              {c.sub && (
                <span className="text-xs md:text-sm font-bold text-gray-400">
                  {c.sub}
                </span>
              )}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

export default function ClientLogos() {
  return (
    <section aria-label="הלקוחות שלנו" className="bg-white py-10 md:py-14 overflow-hidden">
      <p className="text-center text-xs md:text-sm uppercase tracking-[0.3em] text-gray-500 mb-8">
        גאים ללוות את המובילים במשק
      </p>

      <div className="logos-marquee relative flex overflow-hidden" dir="ltr">
        {/* Edge fade */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 md:w-28 z-10 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 md:w-28 z-10 bg-gradient-to-l from-white to-transparent" />

        <div className="logos-scroller flex">
          <Track />
          <div aria-hidden="true" className="flex shrink-0">
            <Track />
          </div>
        </div>
      </div>

      <style jsx global>{`
        .logos-scroller {
          animation: logos-scroll 48s linear infinite;
          width: max-content;
        }
        .logos-marquee:hover .logos-scroller {
          animation-play-state: paused;
        }
        /* Uniform dark silhouettes on white; true colors on hover */
        .logo-item .logo-img {
          filter: brightness(0);
          opacity: 0.55;
          transition: filter 0.3s ease, opacity 0.3s ease;
        }
        .logo-item:hover .logo-img {
          filter: none;
          opacity: 1;
        }
        .logo-item .logo-text {
          color: #9ca3af;
          transition: color 0.3s ease;
        }
        .logo-item:hover .logo-text {
          color: #000000;
        }
        @keyframes logos-scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .logos-scroller {
            animation: none;
            flex-wrap: wrap;
            justify-content: center;
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}
