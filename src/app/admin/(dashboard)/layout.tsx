import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import NotificationBell from "@/components/admin/NotificationBell";
import { ConfirmSheetHost } from "@/components/ui/ConfirmSheet";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const initials = (session.user.name || "A")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <AdminSidebar userName={session.user.name || "Admin"} />

      {/* Main content area */}
      <div className="md:mr-60 min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-gray-900/80 backdrop-blur-md border-b border-gray-700 safe-pt">
          <div className="h-16 flex items-center justify-between px-6 safe-px">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-white">ניהול</h1>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <span className="text-sm text-gray-400 hidden md:block">
                {session.user.name}
              </span>
              <div className="w-9 h-9 rounded-full bg-pink/20 text-pink flex items-center justify-center text-sm font-bold">
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Page content (extra bottom padding on mobile to clear FAB + home indicator) */}
        <main className="p-4 md:p-6 pb-32 md:pb-6">{children}</main>
      </div>
      <InstallPrompt />
      <ConfirmSheetHost />
    </>
  );
}
