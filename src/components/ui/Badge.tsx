import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "pink" | "cyan" | "gray" | "green" | "red" | "yellow";
  className?: string;
}

export default function Badge({ children, variant = "pink", className }: BadgeProps) {
  const variants = {
    pink: "bg-pink/20 text-pink border-pink/30",
    cyan: "bg-cyan/20 text-cyan border-cyan/30",
    gray: "bg-gray-700/50 text-gray-300 border-gray-600",
    green: "bg-green-500/20 text-green-400 border-green-500/30",
    red: "bg-red-500/20 text-red-400 border-red-500/30",
    yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
