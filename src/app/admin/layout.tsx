import { Heebo } from "next/font/google";

const heebo = Heebo({ subsets: ["hebrew", "latin"], display: "swap" });

export const metadata = {
  title: {
    default: "Admin | Fuzion Webz",
    template: "%s | Admin | Fuzion Webz",
  },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`min-h-screen bg-black text-white ${heebo.className}`} dir="rtl">
      {children}
    </div>
  );
}
