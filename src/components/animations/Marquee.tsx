"use client";

import { cn } from "@/lib/utils";

interface MarqueeProps {
  text: string;
  className?: string;
  speed?: number;
  reverse?: boolean;
}

export default function Marquee({
  text,
  className,
  speed = 200,
  reverse = false,
}: MarqueeProps) {
  const content = `${text} `.repeat(16);
  const animClass = reverse ? "marquee-reverse" : "marquee-forward";
  const animClass2 = reverse ? "marquee-reverse-2" : "marquee-forward-2";

  return (
    <div
      className={cn("marquee-wrap", className)}
      aria-hidden="true"
      style={{ ["--t" as string]: `${speed}s` } as React.CSSProperties}
    >
      <div className="marquee-scroll">
        <div className={`marquee-inner ${animClass}`}>
          <span className="marquee-text">{content}</span>
        </div>
        <div className={`marquee-inner ${animClass2}`}>
          <span className="marquee-text">{content}</span>
        </div>
      </div>

      <style jsx>{`
        .marquee-wrap {
          overflow: hidden;
          user-select: none;
          padding: 0.6rem 0;
        }
        .marquee-scroll {
          display: flex;
          mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.15) 10%, black 30%, black 70%, rgba(0,0,0,0.15) 90%, transparent 100%);
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.15) 10%, black 30%, black 70%, rgba(0,0,0,0.15) 90%, transparent 100%);
        }
        .marquee-inner {
          white-space: nowrap;
          flex-shrink: 0;
        }
        .marquee-text {
          font-family: "Meruba", "Anomalia", system-ui, sans-serif;
          font-size: clamp(2.5rem, 6vw, 5rem);
          font-weight: 700;
          color: black;
          padding: 0 1rem;
          text-shadow: -2px 1px 0 rgba(229,3,162,0.5), 2px -1px 0 rgba(1,255,255,0.5);
        }
        .marquee-forward {
          animation: m-a var(--t) linear infinite;
        }
        .marquee-forward-2 {
          animation: m-b var(--t) linear infinite;
        }
        .marquee-reverse {
          animation: m-a-rev var(--t) linear infinite;
        }
        .marquee-reverse-2 {
          animation: m-b-rev var(--t) linear infinite;
        }
        @keyframes m-a {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes m-b {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-200%); }
        }
        @keyframes m-a-rev {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes m-b-rev {
          0% { transform: translateX(-200%); }
          100% { transform: translateX(0%); }
        }
      `}</style>
    </div>
  );
}
