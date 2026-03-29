import Hero from "@/components/sections/Hero";
import HowItWorks from "@/components/sections/HowItWorks";
import AboutUs from "@/components/sections/AboutUs";
import Services from "@/components/sections/Services";
import Portfolio from "@/components/sections/Portfolio";
import Pricing from "@/components/sections/Pricing";
import Contact from "@/components/sections/Contact";
import Marquee from "@/components/animations/Marquee";

export default function Home() {
  return (
    <>
      <Hero />
      <Marquee text="FUZION WEBZ • עיצוב • פיתוח • חדשנות •" />
      <HowItWorks />
      <Marquee text="בניית אתרים • UX/UI • שיווק דיגיטלי •" reverse />
      <AboutUs />
      <Services />
      <Marquee text="DESIGN • DEVELOP • DELIVER • REPEAT •" />
      <Portfolio />
      <Pricing />
      <Marquee text="בואו נדבר • LET'S CREATE • בואו ניצור •" reverse />
      <Contact />
    </>
  );
}
