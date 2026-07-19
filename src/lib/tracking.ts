// Client-side conversion tracking — fires Meta Pixel + GA4 events for real
// business actions (a submitted contact form, a WhatsApp click), so ads can
// optimize for LEADS instead of raw traffic. All calls are guarded: if the
// pixel / gtag isn't loaded (env var unset, ad-blocker), they no-op silently.

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * A qualified lead — the contact form was successfully submitted.
 *
 * `service` is the dropdown value the visitor picked, so GA4 can show which
 * offering actually converts rather than just how many forms came in.
 *
 * The GA4 event stays `generate_lead` (a GA4 *recommended* event, which gets
 * first-class treatment in reports and Ads conversion import) rather than a
 * custom `form_submit`. Renaming would lose that and break continuity with
 * whatever has already been collected.
 */
export function trackLead(source = "contact_form", service?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.fbq?.("track", "Lead", { content_name: source, content_category: service || undefined });
    window.gtag?.("event", "generate_lead", { method: source, form_name: source, service: service || undefined });
  } catch {
    /* tracking must never break the UX */
  }
}

/**
 * A contact attempt via a channel (e.g. WhatsApp) — softer than a Lead.
 *
 * `location` distinguishes the floating button from the in-page buttons; both
 * previously reported the same payload, so there was no way to tell which
 * placement was doing the work.
 */
export function trackContact(method: string, location?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.fbq?.("track", "Contact", { content_name: method, content_category: location || undefined });
    window.gtag?.("event", "contact", { method, location: location || undefined });
  } catch {
    /* no-op */
  }
}

export {};
