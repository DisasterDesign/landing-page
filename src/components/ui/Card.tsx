"use client";

import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  glowColor?: "pink" | "cyan";
  hover?: boolean;
}

export default function Card({
  children,
  glowColor = "pink",
  hover = true,
  className,
  ...props
}: CardProps) {
  const glowStyles = {
    pink: "hover:shadow-[0_0_30px_rgba(229,3,162,0.2)] hover:border-pink/50",
    cyan: "hover:shadow-[0_0_30px_rgba(1,255,255,0.2)] hover:border-cyan/50",
  };

  return (
    <div
      className={cn(
        "bg-gray-900 border border-gray-800 rounded-2xl p-6 transition-all duration-300",
        hover && "hover:-translate-y-2",
        hover && glowStyles[glowColor],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
