"use client";

/**
 * Trusted-by logo strip — an infinite marquee of client brand marks.
 * Text-based marks for now; when real logo files land in /public/logos/,
 * add a `logo` path per client and the strip will render images instead.
 */

interface ClientMark {
  id: string;
  name: string;
  /** Optional secondary line (e.g. parent company). */
  sub?: string;
  /** Optional logo image under /public/logos/. Falls back to a text mark. */
  logo?: string;
  /** Latin brands render better LTR. */
  ltr?: boolean;
}

const CLIENTS: ClientMark[] = [
  { id: "solel-boneh", name: "סולל בונה" },
  { id: "tissar", name: "טיסאר", sub: "מקורות" },
  { id: "of-jerusalem", name: "עוף ירושלים" },
  { id: "olamhamamtakim", name: "עולם הממתקים" },
  { id: "higold", name: "HIGOLD", ltr: true },
  { id: "emek-ayalon", name: "עמק איילון" },
  { id: "titans", name: "TITANS", ltr: true },
  { id: "inner-cosmos", name: "INNER COSMOS", ltr: true },
  { id: "aquatis", name: "AQUATIS", ltr: true },
  { id: "ams-law", name: "AMS LAW", ltr: true },
  { id: "naot", name: "נאות" },
  { id: "peony-lion", name: "PEONY LION", ltr: true },
  { id: "jumarie", name: "JUMARIE", ltr: true },
  { id: "juju", name: "JUJU", ltr: true },
];

function Track() {
  return (
    <div className="logos-track flex items-center shrink-0" dir="ltr">
      {CLIENTS.map((c) => (
        <span
          key={c.id}
          dir={c.ltr ? "ltr" : "rtl"}
          className="mx-7 md:mx-10 inline-flex items-baseline gap-2 whitespace-nowrap select-none"
        >
          <span className="text-xl md:text-2xl font-extrabold text-gray-400 hover:text-black transition-colors duration-300 tracking-tight">
            {c.name}
          </span>
          {c.sub && (
            <span className="text-xs md:text-sm font-bold text-gray-300">
              {c.sub}
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
      <p className="text-center text-xs md:text-sm uppercase tracking-[0.3em] text-gray-500 mb-7">
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

      <style jsx>{`
        .logos-scroller {
          animation: logos-scroll 42s linear infinite;
          width: max-content;
        }
        .logos-marquee:hover .logos-scroller {
          animation-play-state: paused;
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
