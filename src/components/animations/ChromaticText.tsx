"use client";
import { cn } from "@/lib/utils";

interface ChromaticTextProps {
  text: string;
  as?: "h1" | "h2" | "h3" | "h4" | "span" | "p";
  className?: string;
  alwaysActive?: boolean;
}

export default function ChromaticText({ text, as: Tag = "span", className, alwaysActive }: ChromaticTextProps) {
  return (
    <Tag
      className={cn("chromatic-hover", alwaysActive && "chromatic-always", className)}
      data-text={text}
    >
      {text}
    </Tag>
  );
}
