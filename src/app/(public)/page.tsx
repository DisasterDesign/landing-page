import Hero from "@/components/sections/Hero";
import HowItWorks from "@/components/sections/HowItWorks";
import AboutUs from "@/components/sections/AboutUs";
import Services from "@/components/sections/Services";
import Portfolio from "@/components/sections/Portfolio";
import Pricing from "@/components/sections/Pricing";
import Contact from "@/components/sections/Contact";
import ClientLogos from "@/components/sections/ClientLogos";
import LatestPosts from "@/components/sections/LatestPosts";
import Marquee from "@/components/animations/Marquee";
import { LocalBusinessJsonLd, FAQJsonLd } from "@/components/seo/JsonLd";

// ISR so the latest-posts section + internal links refresh when posts publish.
export const revalidate = 3600;

export default function Home() {
  return (
    <>
      <LocalBusinessJsonLd />
      <FAQJsonLd />
      <Hero />
      <Marquee text="FUZION WEBZ • עיצוב • פיתוח • חדשנות •" />
      <HowItWorks />
      <Marquee text="בניית אתרים • UX/UI • שיווק דיגיטלי •" reverse />
      <AboutUs />
      <Services />
      <Marquee text="DESIGN • DEVELOP • DELIVER • REPEAT •" />
      <ClientLogos />
      <Portfolio />
      <Pricing />
      <LatestPosts />
      <Marquee text="בואו נדבר • LET'S CREATE • בואו ניצור •" reverse />
      <Contact />
    </>
  );
}
