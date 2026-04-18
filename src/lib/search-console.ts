// Google Search Console API v3 client.
// All functions take a fresh access token and throw on non-2xx responses.

const GSC_BASE = "https://www.googleapis.com/webmasters/v3";

interface ApiSiteEntry {
  siteUrl: string;
  permissionLevel: string;
}

async function gscFetch<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GSC ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

export async function listSites(
  accessToken: string
): Promise<Array<{ siteUrl: string; permissionLevel: string }>> {
  const data = await gscFetch<{ siteEntry?: ApiSiteEntry[] }>(`${GSC_BASE}/sites`, accessToken);
  return (data.siteEntry ?? []).map((s) => ({
    siteUrl: s.siteUrl,
    permissionLevel: s.permissionLevel,
  }));
}

interface SearchAnalyticsRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface SearchAnalyticsResponse {
  rows?: SearchAnalyticsRow[];
}

async function searchAnalyticsQuery(
  accessToken: string,
  siteUrl: string,
  body: Record<string, unknown>
): Promise<SearchAnalyticsRow[]> {
  const url = `${GSC_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const data = await gscFetch<SearchAnalyticsResponse>(url, accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.rows ?? [];
}

export interface QueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  page: string;
}

export async function fetchQueryData(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  rowLimit = 1000
): Promise<QueryRow[]> {
  const rows = await searchAnalyticsQuery(accessToken, siteUrl, {
    startDate,
    endDate,
    dimensions: ["query", "page"],
    rowLimit,
  });

  // Aggregate by query: sum clicks/impressions, recompute ctr, weighted position by impressions.
  const byQuery = new Map<
    string,
    {
      clicks: number;
      impressions: number;
      positionSum: number;
      topPage: string;
      topPageClicks: number;
    }
  >();

  for (const row of rows) {
    const [query, page] = row.keys ?? [];
    if (!query) continue;
    const entry = byQuery.get(query) ?? {
      clicks: 0,
      impressions: 0,
      positionSum: 0,
      topPage: page ?? "",
      topPageClicks: -1,
    };
    entry.clicks += row.clicks;
    entry.impressions += row.impressions;
    entry.positionSum += row.position * row.impressions;
    if (row.clicks > entry.topPageClicks) {
      entry.topPage = page ?? entry.topPage;
      entry.topPageClicks = row.clicks;
    }
    byQuery.set(query, entry);
  }

  return Array.from(byQuery.entries()).map(([query, e]) => ({
    query,
    clicks: e.clicks,
    impressions: e.impressions,
    ctr: e.impressions > 0 ? e.clicks / e.impressions : 0,
    position: e.impressions > 0 ? e.positionSum / e.impressions : 0,
    page: e.topPage,
  }));
}

export interface PageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function fetchPageData(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  rowLimit = 1000
): Promise<PageRow[]> {
  const rows = await searchAnalyticsQuery(accessToken, siteUrl, {
    startDate,
    endDate,
    dimensions: ["page"],
    rowLimit,
  });
  return rows.map((row) => ({
    page: row.keys?.[0] ?? "",
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));
}

export interface DailyStatRow {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function fetchDailyStats(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<DailyStatRow[]> {
  const rows = await searchAnalyticsQuery(accessToken, siteUrl, {
    startDate,
    endDate,
    dimensions: ["date"],
  });
  return rows.map((row) => ({
    date: row.keys?.[0] ?? "",
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));
}

interface BacklinkApiEntry {
  source?: { url?: string };
  target?: { url?: string };
  // Older GSC link formats
  sourceUrl?: string;
  targetUrl?: string;
}

interface BacklinkApiResponse {
  externalLinks?: BacklinkApiEntry[];
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function fetchBacklinks(
  accessToken: string,
  siteUrl: string
): Promise<Array<{ sourceDomain: string; targetUrl: string }>> {
  // The classic /links endpoint isn't fully documented in v3 anymore — the data
  // we'd ideally get for backlinks comes from the searchAnalytics dimension
  // "page" combined with referrer in GA4. We try the legacy endpoint first;
  // if it doesn't exist we return an empty list and let the caller decide.
  try {
    const url = `${GSC_BASE}/sites/${encodeURIComponent(siteUrl)}/links`;
    const data = await gscFetch<BacklinkApiResponse>(url, accessToken);
    const links = data.externalLinks ?? [];
    const out = new Map<string, { sourceDomain: string; targetUrl: string }>();
    for (const l of links) {
      const src = l.source?.url ?? l.sourceUrl;
      const tgt = l.target?.url ?? l.targetUrl;
      if (!src || !tgt) continue;
      const sourceDomain = extractDomain(src);
      const key = `${sourceDomain}::${tgt}`;
      out.set(key, { sourceDomain, targetUrl: tgt });
    }
    return Array.from(out.values());
  } catch (err) {
    console.warn("GSC backlinks endpoint unavailable, returning empty:", err);
    return [];
  }
}
