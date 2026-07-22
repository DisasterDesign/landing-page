const SOCIAL_AND_DIRECTORY_HOSTS = new Set([
  "facebook.com",
  "fb.com",
  "instagram.com",
  "tiktok.com",
  "linktr.ee",
  "wa.me",
  "whatsapp.com",
  "waze.com",
]);

const PARKED_PHRASES = [
  "this domain is for sale",
  "buy this domain",
  "domain may be for sale",
  "website is parked",
  "domain is parked",
  "parked free, courtesy of godaddy",
  "sedo domain parking",
  "hugedomains.com",
  "afternic.com",
  "הדומיין למכירה",
  "דומיין זה למכירה",
];

function matchesHost(host: string, expected: string): boolean {
  return host === expected || host.endsWith(`.${expected}`);
}

export function classifyWebsiteUrl(url: string): "SOCIAL_ONLY" | "ACTIVE" | "UNKNOWN" {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "UNKNOWN";

    const host = parsed.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    if (!host || host === "localhost") return "UNKNOWN";

    for (const socialHost of SOCIAL_AND_DIRECTORY_HOSTS) {
      if (matchesHost(host, socialHost)) return "SOCIAL_ONLY";
    }

    return "ACTIVE";
  } catch {
    return "UNKNOWN";
  }
}

export function looksParked(input: { title?: string | null; bodyText?: string | null }): boolean {
  const searchable = `${input.title ?? ""}\n${input.bodyText ?? ""}`.toLocaleLowerCase("en");
  return PARKED_PHRASES.some((phrase) => searchable.includes(phrase));
}
