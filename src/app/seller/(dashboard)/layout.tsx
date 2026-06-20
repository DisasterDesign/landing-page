import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import SellerSidebar from "@/components/seller/SellerSidebar";
import { ConfirmSheetHost } from "@/components/ui/ConfirmSheet";
import AdminToaster from "@/components/admin/AdminToaster";

export default async function SellerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "SELLER" && role !== "ADMIN") {
    redirect("/");
  }

  const initials = (session.user.name || "S")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <SellerSidebar userName={session.user.name || "מוכר/ת"} />

      <div className="md:mr-60 min-h-screen">
        <header className="sticky top-0 z-30 bg-gray-900/80 backdrop-blur-md border-b border-gray-700 safe-pt">
          <div className="h-16 flex items-center justify-between px-6 safe-px">
            <h1 className="text-lg font-bold text-white">אזור מוכרים</h1>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400 hidden md:block">
                {session.user.name}
              </span>
              <div className="w-9 h-9 rounded-full bg-pink/20 text-pink flex items-center justify-center text-sm font-bold">
                {initials}
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6 pb-32 md:pb-6">{children}</main>
      </div>
      <ConfirmSheetHost />
      <AdminToaster />
    </>
  );
}
