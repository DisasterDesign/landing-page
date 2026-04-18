import { prisma } from "@/lib/prisma";
import { getFreshAccessToken } from "@/lib/google-oauth";
import {
  fetchDailyStats,
  fetchQueryData,
  fetchBacklinks,
} from "@/lib/search-console";
import { fetchGA4DailySessions } from "@/lib/analytics";

const GSC_LAG_DAYS = 3; // Search Console data is delayed ~2-3 days
const WINDOW_DAYS = 28;
const QUERY_LIMIT = 500;

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function ga4DateToDate(yyyymmdd: string): Date {
  // GA4 returns dates as "20260418"
  const y = parseInt(yyyymmdd.slice(0, 4), 10);
  const m = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
  const d = parseInt(yyyymmdd.slice(6, 8), 10);
  return new Date(Date.UTC(y, m, d));
}

export interface SyncResult {
  userId: string;
  ok: boolean;
  daysSynced?: number;
  queriesSynced?: number;
  backlinksSynced?: number;
  error?: string;
}

export async function syncIntegration(userId: string): Promise<SyncResult> {
  try {
    const integration = await prisma.googleIntegration.findUnique({
      where: { userId },
    });
    if (!integration?.gscSiteUrl) {
      return { userId, ok: false, error: "no_site_configured" };
    }

    const accessToken = await getFreshAccessToken(userId);
    if (!accessToken) {
      return { userId, ok: false, error: "no_access_token" };
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setUTCDate(endDate.getUTCDate() - GSC_LAG_DAYS);
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - (WINDOW_DAYS - 1));
    const startStr = ymd(startDate);
    const endStr = ymd(endDate);

    // 1) Daily snapshots (GSC)
    const dailyStats = await fetchDailyStats(
      accessToken,
      integration.gscSiteUrl,
      startStr,
      endStr
    );

    // 2) GA4 daily sessions for the same window (if property configured)
    let ga4Daily: Awaited<ReturnType<typeof fetchGA4DailySessions>> = [];
    if (integration.ga4PropertyId) {
      try {
        ga4Daily = await fetchGA4DailySessions(
          accessToken,
          integration.ga4PropertyId,
          startStr,
          endStr
        );
      } catch (err) {
        console.warn("GA4 daily fetch failed:", err);
      }
    }

    const ga4ByDate = new Map(ga4Daily.map((d) => [ymd(ga4DateToDate(d.date)), d]));

    for (const day of dailyStats) {
      const date = new Date(`${day.date}T00:00:00Z`);
      const ga = ga4ByDate.get(day.date);
      await prisma.seoSnapshot.upsert({
        where: { date },
        update: {
          totalClicks: day.clicks,
          totalImpressions: day.impressions,
          avgCtr: day.ctr,
          avgPosition: day.position,
          organicSessions: ga?.organicSessions ?? 0,
          referralSessions: ga?.referralSessions ?? 0,
        },
        create: {
          date,
          totalClicks: day.clicks,
          totalImpressions: day.impressions,
          avgCtr: day.ctr,
          avgPosition: day.position,
          organicSessions: ga?.organicSessions ?? 0,
          referralSessions: ga?.referralSessions ?? 0,
        },
      });
    }

    // 3) Top queries for the window — replace previous window's rows
    const queries = await fetchQueryData(
      accessToken,
      integration.gscSiteUrl,
      startStr,
      endStr,
      QUERY_LIMIT
    );

    const windowStart = new Date(`${startStr}T00:00:00Z`);
    const windowEnd = new Date(`${endStr}T00:00:00Z`);

    // Drop older windows so we don't accumulate unbounded
    await prisma.seoQuery.deleteMany({
      where: { windowStart: { lt: windowStart } },
    });

    for (const q of queries) {
      await prisma.seoQuery.upsert({
        where: { query_windowStart: { query: q.query, windowStart } },
        update: {
          clicks: q.clicks,
          impressions: q.impressions,
          ctr: q.ctr,
          position: q.position,
          topPage: q.page,
          windowEnd,
        },
        create: {
          query: q.query,
          clicks: q.clicks,
          impressions: q.impressions,
          ctr: q.ctr,
          position: q.position,
          topPage: q.page,
          windowStart,
          windowEnd,
        },
      });
    }

    // 4) Backlinks — best effort
    let backlinksSynced = 0;
    try {
      const backlinks = await fetchBacklinks(accessToken, integration.gscSiteUrl);
      for (const b of backlinks) {
        await prisma.backlink.upsert({
          where: {
            sourceDomain_targetUrl: {
              sourceDomain: b.sourceDomain,
              targetUrl: b.targetUrl,
            },
          },
          update: {}, // lastSeen auto-updates via @updatedAt
          create: {
            sourceDomain: b.sourceDomain,
            targetUrl: b.targetUrl,
            firstSeen: new Date(),
          },
        });
        backlinksSynced++;
      }
    } catch (err) {
      console.warn("Backlinks sync failed:", err);
    }

    return {
      userId,
      ok: true,
      daysSynced: dailyStats.length,
      queriesSynced: queries.length,
      backlinksSynced,
    };
  } catch (err) {
    console.error("syncIntegration error:", err);
    return {
      userId,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
