"use client";

import { trackContact } from "@/lib/tracking";

/**
 * A plain link that reports a contact attempt before navigating.
 *
 * Exists because /contact is a server component: its contact cards cannot
 * carry an onClick, so the WhatsApp card there was the one contact surface on
 * the site firing no event at all. Wrapping just the anchor keeps the page
 * server-rendered (metadata, JSON-LD) and pulls only this link into the
 * client bundle.
 */
export default function TrackedContactLink({
  href,
  method,
  location,
  external,
  className,
  children,
}: {
  href: string;
  method: string;
  location: string;
  external?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onClick={() => trackContact(method, location)}
      className={className}
    >
      {children}
    </a>
  );
}
