"use client";

import dynamic from "next/dynamic";

const HeroGlass = dynamic(() => import("./HeroGlass"), { ssr: false });

export default function HeroGlassWrapper() {
  return <HeroGlass />;
}
