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
    <div className={`admin-light min-h-screen bg-white text-gray-900 ${heebo.className}`} dir="rtl">
      {children}
    </div>
  );
}
