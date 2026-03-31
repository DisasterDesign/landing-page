import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/layout/Navbar";
import TopNav from "@/components/layout/TopNav";
import Footer from "@/components/layout/Footer";
import CustomCursor from "@/components/animations/CustomCursor";
import GridBackground from "@/components/animations/GridBackground";
import Loader from "@/components/animations/Loader";
import WhatsAppButton from "@/components/shared/WhatsAppButton";
import CookieConsent from "@/components/shared/CookieConsent";
import AccessibilityWidget from "@/components/shared/AccessibilityWidget";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/seo/JsonLd";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OrganizationJsonLd />
      <WebSiteJsonLd />
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
        <GridBackground />

        {/* Fixed logo — top left, always visible */}
        <Link
          href="/"
          id="navbar-logo"
          className="absolute top-5 left-6 md:left-10 z-[20]"
          data-cursor="pointer"
        >
          <Image
            src="/logo.svg"
            alt="Fuzion Webz"
            width={200}
            height={65}
            priority
            className="h-12 w-auto"
          />
        </Link>

        {/* Top nav — page links, centered, with active underline */}
        <TopNav />

        {/* Fixed CTA — top right, always visible */}
        <Link
          href="/#contact"
          className="absolute top-5 right-6 md:right-10 z-[20] hidden lg:inline-flex items-center gap-2 border border-white/30 text-white text-xs tracking-wide px-5 py-2.5 rounded-full hover:border-white hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all duration-300"
          data-cursor="pointer"
        >
          דברו איתנו
          <span className="text-[10px]">→</span>
        </Link>

        {/* Left sidebar nav — fixed, always visible */}
        <Navbar />

        {/* Scrollable content */}
        <div className="relative z-[1] h-full overflow-y-auto" id="smooth-content">
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
          <CookieConsent />
        </div>

        {/* Fixed bottom buttons — inside frame, outside scroll */}
        <WhatsAppButton />
        <AccessibilityWidget />
      </div>
    </>
  );
}
