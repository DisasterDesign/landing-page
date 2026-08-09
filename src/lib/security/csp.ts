/**
 * The site's Content-Security-Policy, kept here rather than inline in
 * next.config.ts so it can be asserted in tests.
 *
 * Why it lives in its own module: the policy shipped without any Google origin
 * allowed, which meant gtag.js was blocked from executing while its <script>
 * tag still rendered into the HTML. Every verification that grepped the page
 * for the measurement ID passed, and GA4 collected nothing the whole time. A
 * rendered tag is not a loaded tag — csp.test.ts now pins the origins each
 * vendor needs so tightening the policy fails a test instead of the data.
 */

const GA4_SCRIPT = "https://www.googletagmanager.com";
const GA4_BEACON = [
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
  GA4_SCRIPT,
];

// Google Ads conversion tracking. Listed now rather than when the first
// campaign goes live, because the symptom of missing them is silent: the
// conversion simply never arrives and the bidding never learns.
const GOOGLE_ADS = [
  "https://www.googleadservices.com",
  "https://googleads.g.doubleclick.net",
];

export const CSP_DIRECTIVES: string[] = [
  "default-src 'self'",
  [
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "https://va.vercel-scripts.com",
    GA4_SCRIPT,
    ...GOOGLE_ADS,
  ].join(" "),
  "style-src 'self' 'unsafe-inline'",
  // Deliberately broad: client logos, portfolio shots and OG images are served
  // from hosts we do not control.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  [
    "connect-src 'self'",
    "https://vitals.vercel-insights.com",
    "https://va.vercel-scripts.com",
    ...GA4_BEACON,
    ...GOOGLE_ADS,
  ].join(" "),
  // Google Maps embed on /contact needs its frame origin allowed.
  "frame-src 'self' https://www.google.com",
  "media-src 'self' https://auxio.b-cdn.net",
  "object-src 'none'",
  "base-uri 'self'",
];

export function buildCsp(): string {
  return CSP_DIRECTIVES.join("; ");
}
