"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "relative overflow-hidden font-anomalia font-bold tracking-wide transition-all duration-300",
        "focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-2",
        // Size
        size === "sm" && "px-5 py-2 text-sm",
        size === "md" && "px-8 py-3 text-base",
        size === "lg" && "px-10 py-4 text-lg",
        // Variant
        variant === "primary" &&
          "bg-pink text-white rounded-full hover:bg-pink-light hover:shadow-[0_0_40px_rgba(229,3,162,0.5)] active:scale-95",
        variant === "secondary" &&
          "border-2 border-white text-white rounded-full hover:border-cyan hover:text-cyan hover:shadow-[0_0_30px_rgba(229,3,162,0.3)] active:scale-95",
        variant === "ghost" &&
          "text-white hover:opacity-80 hover:shadow-[0_0_20px_rgba(229,3,162,0.2)] active:scale-95",
        className
      )}
      data-cursor="pointer"
      {...props}
    >
      {children}
    </button>
  );
}
