import { Heebo } from "next/font/google";

const heebo = Heebo({ subsets: ["hebrew", "latin"], display: "swap" });

export const metadata = {
  title: {
    default: "מוכרים | Fuzion Webz",
    template: "%s | מוכרים | Fuzion Webz",
  },
};

export default function SellerRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`admin-dark min-h-screen bg-[#0a0a0a] text-gray-100 ${heebo.className}`} dir="rtl">
      {children}
    </div>
  );
}
