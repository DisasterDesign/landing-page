"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { label: "דף הבית", href: "/" },
  { label: "חנות פונטים", href: "/fonts" },
  { label: "בלוג", href: "/blog" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav dir="ltr" className="absolute top-6 left-1/2 -translate-x-1/2 z-[20] hidden lg:flex items-center gap-7">
      {LINKS.map((link) => {
        const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`text-[13px] transition-colors duration-200 relative pb-1 ${
              isActive ? "text-white" : "text-gray-400 hover:text-white"
            }`}
            data-cursor="pointer"
          >
            {link.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-[#E503A2] to-[#00D0CE]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
