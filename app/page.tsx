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
import Footer from "./components/Footer";
import CosmicFixedBackground from "./components/CosmicFixedBackground";
import LoadingScreen from "./components/LoadingScreen";

// Dynamic import for CosmicHero (cosmic space environment)
const CosmicHero = dynamic(() => import("./components/CosmicHero"), {
  ssr: false,
  loading: () => (
    <section className="h-screen flex items-center justify-center">
      <div className="text-2xl text-white/30">Loading...</div>
    </section>
  ),
});

export default function Home() {
  const [, setScrollProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  return (
    <main className="relative">
      {/* Loading Screen with logo path animation */}
      {isLoading && (
        <LoadingScreen onLoadingComplete={() => setIsLoading(false)} />
      )}
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

      {/* צור קשר + Footer with gradient */}
      <div
        style={{
          background: `
            linear-gradient(to bottom, transparent 70%, rgba(0, 0, 0, 0.6) 100%),
            radial-gradient(ellipse at bottom right, rgba(255, 50, 50, 0.4) 0%, transparent 50%),
            radial-gradient(ellipse 40% 25% at bottom left, rgba(243, 112, 33, 0.15) 0%, transparent 100%),
            linear-gradient(to bottom, transparent 0%, rgba(243, 112, 33, 0.15) 30%, rgba(243, 112, 33, 0.35) 100%)
          `,
        }}
      >
        <Contact />
        <Footer />
      </div>
    </main>
  );
}
