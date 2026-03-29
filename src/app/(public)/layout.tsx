import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CustomCursor from "@/components/animations/CustomCursor";
import GridBackground from "@/components/animations/GridBackground";
import Loader from "@/components/animations/Loader";
import HeroGlassWrapper from "@/components/three/HeroGlassWrapper";
import WhatsAppButton from "@/components/shared/WhatsAppButton";
import CookieConsent from "@/components/shared/CookieConsent";
import AccessibilityWidget from "@/components/shared/AccessibilityWidget";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CustomCursor />
      <Loader />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:right-4 focus:z-[9999] focus:bg-cyan focus:text-black focus:px-4 focus:py-2 focus:rounded"
      >
        דלג לתוכן הראשי
      </a>

      {/* Frame background */}
      <div className="fixed inset-0 z-0 bg-white" />

      {/* Content container */}
      <div className="fixed inset-[5px] md:inset-[10px] z-[1] rounded-[12px] md:rounded-[20px] overflow-hidden bg-black">
        {/* 3D Glass — inside frame, behind scrollable content */}
        <HeroGlassWrapper />
        <GridBackground />
        <div className="relative z-[5] h-full overflow-y-auto" id="smooth-content">
          <Navbar />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
          <WhatsAppButton />
          <CookieConsent />
        </div>
      </div>

      <AccessibilityWidget />
    </>
  );
}
