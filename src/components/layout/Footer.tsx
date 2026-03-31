import Link from "next/link";
import Image from "next/image";
import { FOOTER_LINKS, SOCIAL_LINKS, SITE_NAME } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="relative border-t border-pink/30">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-12">
          {/* Logo & Description */}
          <div className="lg:col-span-1">
            <Image
              src="/logo-white.svg"
              alt={SITE_NAME}
              width={140}
              height={46}
              className="h-10 w-auto mb-4"
            />
            <p className="text-gray-400 text-sm leading-relaxed">
              סטודיו בוטיק לעיצוב ובניית אתרים מתקדמים. אנחנו יוצרים חוויות דיגיטליות שממירות.
            </p>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-white font-bold mb-4">שירותים</h3>
            <ul className="space-y-3">
              {FOOTER_LINKS.services.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-white font-bold mb-4">משאבים</h3>
            <ul className="space-y-3">
              {FOOTER_LINKS.resources.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-white font-bold mb-4">החברה</h3>
            <ul className="space-y-3">
              {FOOTER_LINKS.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Social & Copyright */}
        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex gap-6">
            {Object.entries(SOCIAL_LINKS).map(([name, url]) => (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-white transition-colors hover:scale-110 transform duration-200 text-sm capitalize"
                aria-label={name}
              >
                {name}
              </a>
            ))}
          </div>
          <p className="text-gray-500 text-xs">
            © {new Date().getFullYear()} {SITE_NAME}. כל הזכויות שמורות.
          </p>
        </div>
      </div>
    </footer>
  );
}
