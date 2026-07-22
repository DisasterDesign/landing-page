import { z } from "zod";

export interface PageSpeedAudit {
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  largestContentfulPaintMs: number | null;
  cumulativeLayoutShift: number | null;
  totalBlockingTimeMs: number | null;
  seoAudits: {
    documentTitle: boolean;
    metaDescription: boolean;
    crawlable: boolean;
  };
  finalScreenshotDataUrl: string | null;
}

const responseSchema = z
  .object({
    lighthouseResult: z.object({
      categories: z.record(z.string(), z.object({ score: z.number().nullable().optional() })),
      audits: z.record(
        z.string(),
        z
          .object({
            score: z.number().nullable().optional(),
            numericValue: z.number().optional(),
            details: z.object({ data: z.string().optional() }).passthrough().optional(),
          })
          .passthrough(),
      ),
    }),
  })
  .passthrough();

function percentScore(value: number | null | undefined): number {
  return Math.round((value ?? 0) * 100);
}

export function parsePageSpeedResponse(value: unknown): PageSpeedAudit {
  const { categories, audits } = responseSchema.parse(value).lighthouseResult;
  return {
    performanceScore: percentScore(categories.performance?.score),
    seoScore: percentScore(categories.seo?.score),
    accessibilityScore: percentScore(categories.accessibility?.score),
    bestPracticesScore: percentScore(categories["best-practices"]?.score),
    largestContentfulPaintMs: audits["largest-contentful-paint"]?.numericValue ?? null,
    cumulativeLayoutShift: audits["cumulative-layout-shift"]?.numericValue ?? null,
    totalBlockingTimeMs: audits["total-blocking-time"]?.numericValue ?? null,
    seoAudits: {
      documentTitle: audits["document-title"]?.score === 1,
      metaDescription: audits["meta-description"]?.score === 1,
      crawlable: audits["is-crawlable"]?.score === 1,
    },
    finalScreenshotDataUrl: audits["final-screenshot"]?.details?.data ?? null,
  };
}

export async function runPageSpeed(
  url: string,
  options: { apiKey: string; fetchImpl?: typeof fetch },
): Promise<PageSpeedAudit> {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", "mobile");
  endpoint.searchParams.set("category", "performance");
  endpoint.searchParams.append("category", "seo");
  endpoint.searchParams.append("category", "accessibility");
  endpoint.searchParams.append("category", "best-practices");
  endpoint.searchParams.set("key", options.apiKey);

  const response = await (options.fetchImpl ?? fetch)(endpoint);
  if (!response.ok) throw new Error(`PageSpeed failed with HTTP ${response.status}`);
  return parsePageSpeedResponse(await response.json());
}
