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
  speed = 30,
  reverse = false,
}: MarqueeProps) {
  const items = Array(4).fill(text);

  return (
    <div className={cn("overflow-hidden whitespace-nowrap py-8", className)} aria-hidden="true">
      <div
        className={cn(
          "inline-flex animate-marquee",
          reverse && "animate-marquee-reverse"
        )}
        style={{
          animationDuration: `${speed}s`,
        }}
      >
        {items.map((item, i) => (
          <span
            key={i}
            className="mx-8 text-5xl md:text-7xl lg:text-8xl font-bold text-white/10 font-anomalia select-none"
          >
            {item}
          </span>
        ))}
        {items.map((item, i) => (
          <span
            key={`dup-${i}`}
            className="mx-8 text-5xl md:text-7xl lg:text-8xl font-bold text-white/10 font-anomalia select-none"
          >
            {item}
          </span>
        ))}
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-reverse {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .animate-marquee {
          animation: marquee linear infinite;
        }
        .animate-marquee-reverse {
          animation: marquee-reverse linear infinite;
        }
      `}</style>
    </div>
  );
}
