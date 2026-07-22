export interface TechnicalAuditInput {
  url: string;
  html: string;
  brokenLinks?: string[];
  brokenImages?: string[];
  now?: Date;
}

export interface DeterministicAuditEvidence {
  indexable: boolean;
  hasTitle: boolean;
  hasMetaDescription: boolean;
  h1Count: number;
  hasCanonical: boolean;
  hasViewport: boolean;
  structuredDataTypes: string[];
  internalLinkCount: number;
  imageCount: number;
  imagesMissingAlt: number;
  brokenLinkCount: number;
  brokenImageCount: number;
  latestExplicitDate: string | null;
  hasStaleExplicitDate: boolean;
}

const MAX_HTML_CHARS = 100_000;

function tags(html: string, tagName: string): string[] {
  return html.match(new RegExp(`<${tagName}\\b[^>]*>`, "gi")) ?? [];
}

function pairedContents(html: string, tagName: string): string[] {
  const matches = html.matchAll(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi"));
  return Array.from(matches, (match) => match[1]);
}

function attribute(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`\\s${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function metaContent(html: string, name: string): string | null {
  for (const tag of tags(html, "meta")) {
    if (attribute(tag, "name")?.toLowerCase() === name) return attribute(tag, "content");
  }
  return null;
}

function collectJsonLdTypes(value: unknown, result: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLdTypes(item, result);
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    if (key === "@type") {
      if (typeof child === "string") result.add(child);
      if (Array.isArray(child)) {
        for (const type of child) if (typeof type === "string") result.add(type);
      }
    }
    collectJsonLdTypes(child, result);
  }
}

function structuredDataTypes(html: string): string[] {
  const result = new Set<string>();
  const scripts = html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const script of scripts) {
    try {
      collectJsonLdTypes(JSON.parse(script[1]), result);
    } catch {
      // Malformed JSON-LD is evidence of absence, never a crawler failure.
    }
  }
  return Array.from(result).sort();
}

function internalLinkCount(html: string, baseUrl: string): number {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return 0;
  }

  let count = 0;
  for (const tag of tags(html, "a")) {
    const href = attribute(tag, "href");
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) continue;
    try {
      if (new URL(href, base).hostname === base.hostname) count += 1;
    } catch {
      // Ignore malformed href values.
    }
  }
  return count;
}

function explicitDates(html: string): string[] {
  const dates = new Set<string>();
  for (const tag of tags(html, "time")) {
    const datetime = attribute(tag, "datetime");
    const match = datetime?.match(/^(20\d{2}-\d{2}-\d{2})/);
    if (match) dates.add(match[1]);
  }
  for (const match of html.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)) dates.add(match[1]);
  return Array.from(dates).sort();
}

export function auditHtml(input: TechnicalAuditInput): DeterministicAuditEvidence {
  const html = input.html.slice(0, MAX_HTML_CHARS);
  const robots = metaContent(html, "robots")?.toLowerCase() ?? "";
  const linkTags = tags(html, "link");
  const imageTags = tags(html, "img");
  const dates = explicitDates(html);
  const latestExplicitDate = dates.at(-1) ?? null;
  const now = input.now ?? new Date();
  const staleBefore = new Date(now);
  staleBefore.setUTCFullYear(staleBefore.getUTCFullYear() - 3);

  return {
    indexable: !robots.split(",").some((directive) => directive.trim() === "noindex"),
    hasTitle: pairedContents(html, "title").some((title) => title.replace(/<[^>]+>/g, "").trim()),
    hasMetaDescription: Boolean(metaContent(html, "description")?.trim()),
    h1Count: pairedContents(html, "h1").length,
    hasCanonical: linkTags.some(
      (tag) => attribute(tag, "rel")?.toLowerCase().split(/\s+/).includes("canonical") && attribute(tag, "href"),
    ),
    hasViewport: Boolean(metaContent(html, "viewport")?.trim()),
    structuredDataTypes: structuredDataTypes(html),
    internalLinkCount: internalLinkCount(html, input.url),
    imageCount: imageTags.length,
    imagesMissingAlt: imageTags.filter((tag) => !attribute(tag, "alt")?.trim()).length,
    brokenLinkCount: input.brokenLinks?.length ?? 0,
    brokenImageCount: input.brokenImages?.length ?? 0,
    latestExplicitDate,
    hasStaleExplicitDate: latestExplicitDate
      ? new Date(`${latestExplicitDate}T00:00:00Z`) < staleBefore
      : false,
  };
}
