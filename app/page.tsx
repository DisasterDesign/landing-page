"use client";

import dynamic from "next/dynamic";
import NavigationTOC from "./components/NavigationTOC";
import Header from "./components/Header";
import GridLines from "./components/GridLines";
import HowItWorks from "./components/HowItWorks";
import FoundersSection from "./components/FoundersSection";
import Services from "./components/Services";
import Portfolio from "./components/Portfolio";
import Contact from "./components/Contact";

// Dynamic import to avoid SSR issues with Three.js
const Hero3D = dynamic(() => import("./components/Hero3D"), {
  ssr: false,
  loading: () => (
    <section className="h-screen flex items-center justify-center bg-background">
      <div className="text-2xl text-white/50">Loading...</div>
    </section>
  ),
});

export default function Home() {
  return (
    <main className="relative">
      <GridLines />
      <Header />
      <NavigationTOC />

      {/* בית */}
      <Hero3D />

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

      <footer className="py-8 text-center" style={{ backgroundColor: "#FDF4EB" }}>
        <p className="text-[#1E1E1E]/60">© 2024 Webz. All rights reserved.</p>
      </footer>
    </main>
  );
}
