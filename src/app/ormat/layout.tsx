import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "הצעה לרבינוביץ׳ הפקות · Fuzion Webz",
  description: "סרט טכנולוגי 3D והצגה דיגיטלית — הצעה של Fuzion Webz עבור רבינוביץ׳ הפקות.",
  // Private client pitch — keep it out of search engines.
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: "https://ormat.fuzionwebz.com" },
};

export default function OrmatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f7f8fa" }}>
      {children}
    </div>
  );
}
