"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "סקירה", href: "/admin/seo" },
  { label: "מילות חיפוש", href: "/admin/seo/keywords" },
  { label: "דפים", href: "/admin/seo/pages" },
  { label: "קישורים נכנסים", href: "/admin/seo/backlinks" },
  { label: "תנועה חיצונית", href: "/admin/seo/referrals" },
  { label: "UTM", href: "/admin/seo/utm" },
];

export default function SeoSubNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin/seo" ? pathname === "/admin/seo" : pathname.startsWith(href);

  return (
    <nav
      dir="rtl"
      className="bg-gray-800/50 border border-gray-700 rounded-2xl p-1.5 flex gap-1 overflow-x-auto"
    >
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative shrink-0 px-3 sm:px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              active
                ? "bg-gray-900 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800/60"
            }`}
          >
            {item.label}
            {active && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-pink rounded-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
