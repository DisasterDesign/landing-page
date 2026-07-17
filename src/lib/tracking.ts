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

/** A qualified lead — the contact form was successfully submitted. */
export function trackLead(source = "contact_form"): void {
  if (typeof window === "undefined") return;
  try {
    window.fbq?.("track", "Lead", { content_name: source });
    window.gtag?.("event", "generate_lead", { method: source });
  } catch {
    /* tracking must never break the UX */
  }
}

/** A contact attempt via a channel (e.g. WhatsApp) — softer than a Lead. */
export function trackContact(method: string): void {
  if (typeof window === "undefined") return;
  try {
    window.fbq?.("track", "Contact", { content_name: method });
    window.gtag?.("event", "contact", { method });
  } catch {
    /* no-op */
  }
}

export {};
