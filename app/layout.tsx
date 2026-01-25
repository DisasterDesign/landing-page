import type { Metadata } from "next";
import { Heebo, Qwigley } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
});

const qwigley = Qwigley({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-qwigley",
});

export const metadata: Metadata = {
  title: "Fuzion Webz",
  description: "Landing page skeleton",
  icons: {
    icon: "/fabicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} ${qwigley.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
