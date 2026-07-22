import type { BusinessShape } from "./types";

export interface CommerceAuditEvidence {
  hasProductStructuredData: boolean;
  hasProductLink: boolean;
  hasCartLink: boolean;
  hasCheckoutLink: boolean;
  hasShippingOrReturnsEvidence: boolean;
  hasContactPath: boolean;
  businessShape: BusinessShape;
}

function containsJsonLdType(value: unknown, type: string): boolean {
  if (Array.isArray(value)) return value.some((item) => containsJsonLdType(item, type));
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const ownType = record["@type"];
  if (ownType === type || (Array.isArray(ownType) && ownType.includes(type))) return true;
  return Object.values(record).some((child) => containsJsonLdType(child, type));
}

function hasProductStructuredData(html: string): boolean {
  const scripts = html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const script of scripts) {
    try {
      if (containsJsonLdType(JSON.parse(script[1]), "Product")) return true;
    } catch {
      // Malformed structured data does not prove commerce capability.
    }
  }
  return false;
}

function normalizedLinks(html: string): string[] {
  return Array.from(html.matchAll(/<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi), (match) => {
    const href = match[1] ?? match[2] ?? match[3] ?? "";
    const text = match[4].replace(/<[^>]+>/g, " ");
    return `${href} ${text}`.toLocaleLowerCase("en");
  });
}

export function auditCommerce(input: { url: string; html: string }): CommerceAuditEvidence {
  void input.url;
  const html = input.html.slice(0, 100_000);
  const links = normalizedLinks(html);
  const productStructuredData = hasProductStructuredData(html);
  const hasProductLink = links.some((link) => /product|shop|store|מוצר|חנות/.test(link));
  const hasCartLink = links.some((link) => /cart|basket|עגלה/.test(link));
  const hasCheckoutLink = links.some((link) => /checkout|payment|לתשלום|קופה/.test(link));
  const hasShippingOrReturnsEvidence = /shipping|delivery|returns?|משלוח|החזר/.test(
    html.toLocaleLowerCase("en"),
  );
  const hasContactPath = links.some((link) => /contact|tel:|mailto:|צור.{0,3}קשר|התקשר/.test(link));

  let businessShape: BusinessShape = "UNKNOWN";
  if (productStructuredData || hasCartLink || hasCheckoutLink) businessShape = "ECOMMERCE";
  else if (hasProductLink) businessShape = "RETAIL";
  else if (hasContactPath) businessShape = "SERVICE";

  return {
    hasProductStructuredData: productStructuredData,
    hasProductLink,
    hasCartLink,
    hasCheckoutLink,
    hasShippingOrReturnsEvidence,
    hasContactPath,
    businessShape,
  };
}
