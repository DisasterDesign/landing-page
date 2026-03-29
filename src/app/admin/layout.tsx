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
    <div className="min-h-screen bg-black text-white font-anomalia" dir="rtl">
      {children}
    </div>
  );
}
