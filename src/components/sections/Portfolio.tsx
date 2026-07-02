"use client";

import { useRef } from "react";
import ScrollReveal from "@/components/animations/ScrollReveal";

interface Project {
  id: string;
  name: string;
  description: string;
  gradient: string;
  url: string;
  video?: string;
  poster?: string;
}

const projects: Project[] = [
  { id: "titans", name: "Titans Global", description: "Global investment platform", gradient: "linear-gradient(135deg, #F37021, #ff6b6b)", url: "https://titans.global/", video: "/c-video/compressed/Titans.mp4", poster: "/c-video/posters/Titans.webp" },
  { id: "olamhamamtakim", name: "עולם הממתקים", description: "רשת חנויות ממתקים", gradient: "linear-gradient(135deg, #ff9a9e, #fecfef)", url: "https://olamhamamtakim.co.il/", video: "/c-video/compressed/olamhamamtakim.mp4", poster: "/c-video/posters/olamhamamtakim.webp" },
  { id: "aquatis", name: "Aquatis", description: "Water management platform", gradient: "linear-gradient(135deg, #11998e, #38ef7d)", url: "https://aquatis.ai/", video: "/c-video/compressed/Aquatis.mp4", poster: "/c-video/posters/Aquatis.webp" },
  { id: "fixtickets", name: "פיקס טיקטס", description: "שירותי תיקון ושירות", gradient: "linear-gradient(135deg, #a18cd1, #fbc2eb)", url: "https://fixtickets.co.il/", video: "/c-video/compressed/fixtickets.mp4", poster: "/c-video/posters/fixtickets.webp" },
  { id: "innercosmos", name: "Inner Cosmos", description: "AI-powered meditation", gradient: "linear-gradient(135deg, #667eea, #764ba2)", url: "https://innercosmos.ai/", video: "/c-video/compressed/INNERCOSMOS.mp4", poster: "/c-video/posters/INNERCOSMOS.webp" },
  { id: "roza", name: "רוזה", description: "מסעדה ברחובות", gradient: "linear-gradient(135deg, #2d4a22, #5a7a42)", url: "https://roza-rehovot-website.pages.dev/", video: "/c-video/compressed/roza.mp4", poster: "/c-video/posters/roza.webp" },
  { id: "thirdeye", name: "Third Eye", description: "Analytics dashboard", gradient: "linear-gradient(135deg, #4facfe, #00f2fe)", url: "https://3i.titans.global/", video: "/c-video/compressed/3i.mp4", poster: "/c-video/posters/3i.webp" },
  { id: "baguette", name: "באגט התרנגול", description: "מסעדה", gradient: "linear-gradient(135deg, #3a2a1a, #6b4c30)", url: "https://baguette-hatarnegol.pages.dev/", video: "/c-video/compressed/baguette.mp4", poster: "/c-video/posters/baguette.webp" },
  { id: "dentalcare", name: "Dental Care", description: "Dental clinic website", gradient: "linear-gradient(135deg, #74ebd5, #ACB6E5)", url: "https://dental-care-d5g.pages.dev/", video: "/c-video/compressed/dental-care.mp4", poster: "/c-video/posters/dental-care.webp" },
  { id: "helena", name: "הלן המתקשרת", description: "תיקשור וקלפי טארוט", gradient: "linear-gradient(135deg, #1a1033, #3d2266)", url: "https://maalen-landing.pages.dev/", video: "/c-video/compressed/helena.mp4", poster: "/c-video/posters/helena.webp" },
  { id: "ams-law", name: "AMS Law", description: "משרד עורכי דין", gradient: "linear-gradient(135deg, #1a1a2e, #16213e)", url: "https://ams-law.com/", video: "/c-video/compressed/ams-law.mp4", poster: "/c-video/posters/ams-law.webp" },
  { id: "emek-ayalon", name: "עמק איילון", description: "ניהול תשתיות ופרויקטים", gradient: "linear-gradient(135deg, #c5a55a, #e8d5a0)", url: "https://www.emek-ayalon.com/", video: "/c-video/compressed/emek-ayalon.mp4", poster: "/c-video/posters/emek-ayalon.webp" },
  // Client sites from the internal system (poster = live-site capture)
  { id: "of-jerusalem", name: "עוף ירושלים", description: "מהדרין מאז 2001 — מהלול עד הצלחת", gradient: "linear-gradient(135deg, #7a1f1f, #c0392b)", url: "https://ofjerusalem.com/", poster: "/images/portfolio-tiles/of-jerusalem.jpg" },
  { id: "higold", name: "HIGOLD ישראל", description: "ריהוט חוץ יוקרתי", gradient: "linear-gradient(135deg, #8a6d1e, #d4af37)", url: "https://higold-israel.com/", poster: "/images/portfolio-tiles/higold.jpg" },
  { id: "natansart", name: "Natan's Art", description: "טפטים מעוצבים בהשראת אומנות", gradient: "linear-gradient(135deg, #2c3e50, #8e44ad)", url: "https://natansart.com/", poster: "/images/portfolio-tiles/natansart.jpg" },
  { id: "jumarie", name: "Jumarie", description: "אופנת נשים פרימיום", gradient: "linear-gradient(135deg, #d5a6bd, #f5e0e8)", url: "https://jumarie.co/en", poster: "/images/portfolio-tiles/jumarie.svg" },
  { id: "naotplus", name: "נאות", description: "עכשיו הכל מתחבר", gradient: "linear-gradient(135deg, #1f3a2d, #3f7a55)", url: "https://naotplus.com/", poster: "/images/portfolio-tiles/naotplus.jpg" },
  { id: "light4u", name: "יהלום תאורה", description: "חנות תאורה מעוצבת", gradient: "linear-gradient(135deg, #3d3106, #b39220)", url: "https://www.light4u.co.il/", poster: "/images/portfolio-tiles/light4u.jpg" },
  { id: "shai-haim", name: "שי פרויקטים", description: "עבודות גמר ובנייה", gradient: "linear-gradient(135deg, #37474f, #78909c)", url: "https://shai-projects-web.davidalelad.workers.dev/", poster: "/images/portfolio-tiles/shai-haim.jpg" },
  { id: "asu", name: "ASU Clinics", description: "אסתטיקה רפואית בהתאמה אישית", gradient: "linear-gradient(135deg, #4a6572, #a7c5cf)", url: "https://asu-clinics.pages.dev/", poster: "/images/portfolio-tiles/asu.jpg" },
  { id: "alto-mare", name: "Alto Mare", description: "Luxury sea-view residences", gradient: "linear-gradient(135deg, #0f3057, #4a7fa5)", url: "https://alto-mare.pages.dev/", poster: "/images/portfolio-tiles/alto-mare.jpg" },
  { id: "peony-lion", name: "Peony Lion Group", description: "קבוצת השקעות בינלאומית", gradient: "linear-gradient(135deg, #5c1a33, #a34d6d)", url: "https://peony-lion.pages.dev/", poster: "/images/portfolio-tiles/peony-lion.jpg" },
  { id: "juju", name: "JUJU Asian Kitchen", description: "מטבח אסייתי בממילא ירושלים", gradient: "linear-gradient(135deg, #1b4332, #d90429)", url: "https://juju-asian-kitchen.pages.dev/", poster: "/images/portfolio-tiles/juju.jpg" },
  { id: "yes-we-can", name: "Yes we CAN", description: "אריזה ומכירה בדרך חדשה", gradient: "linear-gradient(135deg, #0077b6, #90e0ef)", url: "https://yes-we-can.pages.dev/", poster: "/images/portfolio-tiles/yes-we-can.jpg" },
  { id: "yoni-shawarma", name: "יוני 71", description: "שווארמה כשרה ברמת השרון", gradient: "linear-gradient(135deg, #6a3805, #c8781a)", url: "https://yoni71.davidalelad.workers.dev/", poster: "/images/portfolio-tiles/yoni-shawarma.jpg" },
  { id: "burger-yoni", name: "בורגר יוני 71", description: "המבורגרים כשרים ברמת השרון", gradient: "linear-gradient(135deg, #4a1a05, #a3541a)", url: "https://burger-yoni-71.pages.dev/" },
];

/**
 * Clean, uniform gallery: generous landscape cards in a calm 3-column grid.
 * Poster by default; projects with a showcase video play it on hover
 * (desktop). Every card opens the live site.
 */
export default function Portfolio() {
  return (
    <section id="portfolio" className="relative bg-white py-24 md:py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-14 md:mb-20">
            <h2
              className="chromatic-hover chromatic-always text-[clamp(2rem,6vw,4.5rem)] font-extrabold text-black w-full"
              data-text="העבודות שלנו"
            >
              העבודות שלנו
            </h2>
            <p className="text-gray-600 text-base md:text-lg mt-4 max-w-xl mx-auto">
              אתרים חיים שאנחנו בונים ומלווים — לחצו על כל עבודה לביקור באתר
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {projects.map((p, i) => (
            <ScrollReveal key={p.id} delay={(i % 3) * 0.07}>
              <ProjectCard project={p} />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const play = () => videoRef.current?.play().catch(() => {});
  const pause = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };

  return (
    <a
      href={project.url}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={play}
      onMouseLeave={pause}
      className="group block rounded-3xl overflow-hidden border border-gray-200 bg-gray-50 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_rgba(0,0,0,0.14)] hover:border-gray-300"
      data-cursor="pointer"
    >
      {/* Media */}
      <div className="relative aspect-[16/10] overflow-hidden" style={{ background: project.gradient }}>
        {project.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.poster}
            alt={project.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white/90 text-2xl md:text-3xl font-extrabold tracking-tight px-6 text-center">
              {project.name}
            </span>
          </div>
        )}

        {project.video && (
          <video
            ref={videoRef}
            src={project.video}
            muted
            loop
            playsInline
            preload="none"
            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          />
        )}

        {/* Visit pill */}
        <span
          dir="ltr"
          className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-[11px] font-bold text-black opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300"
        >
          VISIT SITE <span aria-hidden="true">↗</span>
        </span>
      </div>

      {/* Caption */}
      <div className="px-5 py-4 text-right">
        <h3 className="text-base md:text-lg font-extrabold text-black transition-colors group-hover:text-pink">
          {project.name}
        </h3>
        <p className="text-gray-600 text-sm mt-0.5 line-clamp-1">{project.description}</p>
      </div>
    </a>
  );
}
