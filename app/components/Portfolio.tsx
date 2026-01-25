"use client";

export default function Portfolio() {
  return (
    <section
      id="portfolio"
      className="min-h-screen relative overflow-hidden py-20"
      style={{ backgroundColor: "#FDF4EB" }}
    >
      {/* Section Title */}
      <div className="flex justify-center mb-16">
        <h2 className="text-4xl text-[#1E1E1E]">העבודות שלנו</h2>
      </div>

      {/* Content placeholder */}
      <div className="container mx-auto px-8">
        <p className="text-center text-[#1E1E1E]/60">פרויקטים</p>
      </div>
    </section>
  );
}
