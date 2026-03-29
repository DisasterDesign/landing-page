import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CustomCursor from "@/components/animations/CustomCursor";
import WhatsAppButton from "@/components/shared/WhatsAppButton";
import CookieConsent from "@/components/shared/CookieConsent";
import AccessibilityWidget from "@/components/shared/AccessibilityWidget";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CustomCursor />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:right-4 focus:z-[9999] focus:bg-cyan focus:text-black focus:px-4 focus:py-2 focus:rounded"
      >
        דלג לתוכן הראשי
      </a>
      <Navbar />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
      <WhatsAppButton />
      <CookieConsent />
      <AccessibilityWidget />
    </>
  );
}
