"use client";

import { TEAM_MEMBERS } from "@/lib/constants";
import ScrollReveal from "@/components/animations/ScrollReveal";

export default function AboutUs() {
  const values = [
    { number: "01", title: "חדשנות", description: "תמיד בחזית הטכנולוגיה והעיצוב" },
    { number: "02", title: "איכות", description: "ללא פשרות בכל פיקסל ושורת קוד" },
    { number: "03", title: "שקיפות", description: "תקשורת פתוחה ותהליך עבודה ברור" },
    { number: "04", title: "תוצאות", description: "מדידה, אופטימיזציה והשגת יעדים" },
  ];

  return (
    <section id="about" className="relative bg-black py-24 md:py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <h2 className="chromatic-hover text-4xl md:text-5xl lg:text-6xl font-extrabold text-center mb-20" data-text="מי אנחנו?">
            מי אנחנו?
          </h2>
        </ScrollReveal>

        {/* Team Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
          {TEAM_MEMBERS.map((member, i) => (
            <ScrollReveal key={member.email} delay={i * 0.15}>
              <div className="group bg-gray-900 border border-gray-800 rounded-2xl p-8 transition-all duration-500 hover:border-pink/30 hover:shadow-[0_0_40px_rgba(229,3,162,0.1)]">
                {/* Photo placeholder */}
                <div className="w-24 h-24 rounded-full bg-gray-800 mb-6 overflow-hidden grayscale group-hover:grayscale-0 transition-all duration-500">
                  <div className="w-full h-full bg-gradient-to-br from-pink/30 to-cyan/30 flex items-center justify-center text-3xl font-bold">
                    {member.nameHe.charAt(0)}
                  </div>
                </div>

                <h3 className="text-2xl font-bold mb-1">{member.nameHe}</h3>
                <p className="text-gray-400 text-sm font-bold mb-4">{member.roleHe}</p>
                <p className="text-gray-400 leading-relaxed">{member.bio}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Values */}
        <ScrollReveal>
          <h3 className="chromatic-hover text-3xl md:text-4xl font-extrabold text-center mb-12" data-text="הערכים שלנו">
            הערכים שלנו
          </h3>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {values.map((value, i) => (
            <ScrollReveal key={value.number} delay={i * 0.1}>
              <div className="text-center md:text-right">
                <span className="text-5xl font-extrabold text-white/20">{value.number}</span>
                <h4 className="text-xl font-bold mt-2 mb-2">{value.title}</h4>
                <p className="text-gray-400">{value.description}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
