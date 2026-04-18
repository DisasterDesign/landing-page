// Google Analytics Admin + Data APIs.

const ADMIN_BASE = "https://analyticsadmin.googleapis.com/v1beta";
const DATA_BASE = "https://analyticsdata.googleapis.com/v1beta";

async function gaFetch<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
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
    throw new Error(`GA ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

export interface GA4Property {
  propertyId: string;
  displayName: string;
}

interface AccountSummariesResponse {
  accountSummaries?: Array<{
    propertySummaries?: Array<{
      property: string;
      displayName: string;
    }>;
  }>;
}

export async function listGA4Properties(accessToken: string): Promise<GA4Property[]> {
  const data = await gaFetch<AccountSummariesResponse>(
    `${ADMIN_BASE}/accountSummaries`,
    accessToken
  );
  const out: GA4Property[] = [];
  for (const account of data.accountSummaries ?? []) {
    for (const property of account.propertySummaries ?? []) {
      out.push({ propertyId: property.property, displayName: property.displayName });
    }
  }
  return out;
}

interface RunReportResponse {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
}

async function runReport(
  accessToken: string,
  propertyId: string,
  body: Record<string, unknown>
): Promise<RunReportResponse> {
  return gaFetch<RunReportResponse>(`${DATA_BASE}/${propertyId}:runReport`, accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchGA4Sessions(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<{ organicSessions: number; referralSessions: number }> {
  const data = await runReport(accessToken, propertyId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }],
  });

  let organicSessions = 0;
  let referralSessions = 0;
  for (const row of data.rows ?? []) {
    const channel = row.dimensionValues?.[0]?.value ?? "";
    const sessions = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
    if (channel === "Organic Search") organicSessions = sessions;
    else if (channel === "Referral") referralSessions = sessions;
  }
  return { organicSessions, referralSessions };
}

export interface DailyChannelStat {
  date: string; // YYYYMMDD from GA4
  organicSessions: number;
  referralSessions: number;
}

export async function fetchGA4DailySessions(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<DailyChannelStat[]> {
  const data = await runReport(accessToken, propertyId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }, { name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }],
  });

  const byDate = new Map<string, DailyChannelStat>();
  for (const row of data.rows ?? []) {
    const date = row.dimensionValues?.[0]?.value ?? "";
    const channel = row.dimensionValues?.[1]?.value ?? "";
    const sessions = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
    if (!date) continue;
    const entry = byDate.get(date) ?? { date, organicSessions: 0, referralSessions: 0 };
    if (channel === "Organic Search") entry.organicSessions += sessions;
    else if (channel === "Referral") entry.referralSessions += sessions;
    byDate.set(date, entry);
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export interface ReferralRow {
  source: string;
  medium: string;
  sessions: number;
  engagedSessions: number;
}

export async function fetchReferralSources(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<ReferralRow[]> {
  const data = await runReport(accessToken, propertyId, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
    metrics: [{ name: "sessions" }, { name: "engagedSessions" }],
    dimensionFilter: {
      filter: {
        fieldName: "sessionDefaultChannelGroup",
        stringFilter: { value: "Referral" },
      },
    },
  });

  return (data.rows ?? []).map((row) => ({
    source: row.dimensionValues?.[0]?.value ?? "",
    medium: row.dimensionValues?.[1]?.value ?? "",
    sessions: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
    engagedSessions: parseInt(row.metricValues?.[1]?.value ?? "0", 10),
  }));
}
