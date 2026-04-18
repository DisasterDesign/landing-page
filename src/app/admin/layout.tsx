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
    <div className={`admin-light min-h-screen bg-white text-gray-900 ${heebo.className}`} dir="rtl">
      {children}
    </div>
  );
}
