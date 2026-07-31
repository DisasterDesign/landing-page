"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const navItems = [
  {
    label: "דשבורד",
    href: "/seller",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
      </svg>
    ),
  },
  {
    label: "לידים",
    href: "/seller/leads",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    label: "הסכם חדש",
    href: "/seller/agreements/new",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m-6-8h.01M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h7l7 7v9a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: "העסקאות שלי",
    href: "/seller/sales",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "הלקוחות שלי",
    href: "/seller/clients",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function SellerSidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobileOpen]);

  const isActive = (href: string) => {
    if (href === "/seller") return pathname === "/seller";
    return pathname.startsWith(href);
  };

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const renderNav = (onClick?: () => void) =>
    navItems.map((item) => {
      const active = isActive(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onClick}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative ${
            active ? "bg-pink/10 text-pink" : "text-gray-400 hover:text-white hover:bg-gray-800"
          }`}
        >
          {active && (
            <span className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-pink rounded-l-full" />
          )}
          <span className="flex-shrink-0">{item.icon}</span>
          <span className="text-sm font-medium">{item.label}</span>
        </Link>
      );
    });

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed top-0 right-0 h-screen w-60 bg-gray-900 border-l border-gray-700 z-40 font-birzia">
        <div className="flex items-center h-16 px-4 border-b border-gray-700">
          <span className="text-lg font-bold text-pink">Fuzion</span>
          <span className="text-xs text-gray-500 mr-2">מוכרים</span>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-2">{renderNav()}</nav>
        <div className="border-t border-gray-700 p-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-pink/20 text-pink flex items-center justify-center text-sm font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{userName}</p>
              <div className="flex items-center gap-2">
                <Link
                  href="/seller/password"
                  className="text-xs text-gray-400 hover:text-pink transition-colors"
                >
                  החלף סיסמה
                </Link>
                <span className="text-gray-700">·</span>
                <button
                  onClick={() => signOut({ callbackUrl: "/admin/login" })}
                  className="text-xs text-gray-400 hover:text-pink transition-colors"
                >
                  התנתק
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile hamburger FAB */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="פתח תפריט"
        className="md:hidden fixed safe-bottom left-1/2 -translate-x-1/2 z-50 w-16 h-16 rounded-full bg-pink hover:bg-pink-light text-white flex items-center justify-center shadow-lg shadow-pink/40 active:scale-95 transition-transform font-birzia"
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-black/70 z-50"
          aria-hidden="true"
        />
      )}

      <aside
        className={`md:hidden fixed top-0 right-0 h-full w-72 max-w-[85vw] bg-gray-900 border-l border-gray-700 z-50 flex flex-col transition-transform duration-300 font-birzia safe-pt safe-pb ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
          <span className="text-lg font-bold text-pink">Fuzion · מוכרים</span>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="סגור תפריט"
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {renderNav(() => setMobileOpen(false))}
        </nav>
        <div className="border-t border-gray-700 p-4">
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="w-full text-center text-sm text-gray-300 hover:text-pink py-2 border border-gray-700 rounded-lg active:bg-gray-800"
          >
            התנתק
          </button>
        </div>
      </aside>
    </>
  );
}
