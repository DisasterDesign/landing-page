import Hero from "@/components/sections/Hero";
import HowItWorks from "@/components/sections/HowItWorks";
import AboutUs from "@/components/sections/AboutUs";
import Services from "@/components/sections/Services";
import Portfolio from "@/components/sections/Portfolio";
import Pricing from "@/components/sections/Pricing";
import Contact from "@/components/sections/Contact";
import ClientLogos from "@/components/sections/ClientLogos";
import GoogleReviews from "@/components/sections/GoogleReviews";
import LatestPosts from "@/components/sections/LatestPosts";
import Marquee from "@/components/animations/Marquee";
import { FAQJsonLd } from "@/components/seo/JsonLd";

// ISR so the latest-posts section + internal links refresh when posts publish.
export const revalidate = 3600;

export default function Home() {
  return (
    <>
      {/* LocalBusinessJsonLd is rendered once by the (public) layout — do not
          duplicate here (the home page emitted two identical blocks). */}
      <FAQJsonLd />
      <Hero />
      <Marquee text="FUZION WEBZ • עיצוב • פיתוח • חדשנות •" />
      <HowItWorks />
      <Marquee text="בניית אתרים • UX/UI • שיווק דיגיטלי •" reverse />
      <AboutUs />
      <Services />
      <Marquee text="DESIGN • DEVELOP • DELIVER • REPEAT •" />
      <ClientLogos />
      <GoogleReviews />
      <Portfolio />
      <Pricing />
      <LatestPosts />
      <Marquee text="בואו נדבר • LET'S CREATE • בואו ניצור •" reverse />
      <Contact />
    </>
  );
}
