"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import NavigationTOC from "./components/NavigationTOC";
import Header from "./components/Header";
import HowItWorks from "./components/HowItWorks";
import FoundersSection from "./components/FoundersSection";
import Services from "./components/Services";
import Portfolio from "./components/Portfolio";
import Contact from "./components/Contact";
import CosmicFixedBackground from "./components/CosmicFixedBackground";

// Dynamic import for CosmicHero (cosmic space environment)
const CosmicHero = dynamic(() => import("./components/CosmicHero"), {
  ssr: false,
  loading: () => (
    <section className="h-screen flex items-center justify-center bg-[#000510]">
      <div className="text-2xl text-white/30">Loading...</div>
    </section>
  ),
});

export default function Home() {
  const [, setScrollProgress] = useState(0);

  return (
    <main className="relative">
      {/* Fixed cosmic background for entire site */}
      <CosmicFixedBackground />

      <Header />
      <NavigationTOC />

      {/* בית - Cosmic Hero environment */}
      <CosmicHero onScrollProgress={setScrollProgress} />

      {/* איך זה עובד? */}
      <HowItWorks />

      {/* מי אנחנו? */}
      <FoundersSection />

      {/* השירותים */}
      <Services />

      {/* העבודות שלנו */}
      <Portfolio />

      {/* צור קשר */}
      <Contact />

      <footer className="py-8 text-center" style={{ backgroundColor: "#080520" }}>
        <p className="text-white/60">© 2024 Webz. All rights reserved.</p>
      </footer>
    </main>
  );
}
