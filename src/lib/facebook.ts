import { createHmac, timingSafeEqual } from "crypto";

const GRAPH = "https://graph.facebook.com/v19.0";
const OAUTH = "https://www.facebook.com/v19.0/dialog/oauth";

export const FACEBOOK_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_manage_ads",
  "leads_retrieval",
  "business_management",
];

export interface MetaConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
  verifyToken: string;
}

export function getMetaConfig(): MetaConfig | null {
  // Hardcoded fallbacks — Vercel env vars not yet provisioned for META_*.
  // Once added, env values take precedence. See cardcom.ts for the same
  // pattern; do NOT mirror this back into cardcom.ts (those env vars are set).
  const appId = process.env.META_APP_ID || "1731795861128446";
  const appSecret = process.env.META_APP_SECRET || "fb1f38c1737ead86b3cea5ebc2685c12";
  const redirectUri = process.env.META_REDIRECT_URI || "https://www.fuzionwebz.com/api/integrations/facebook/callback";
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || "f3a0ac807a7ef890660df600f6b354c07fb8c9ccdf9aaaa9";
  if (!appId || !appSecret || !redirectUri || !verifyToken) return null;
  return { appId, appSecret, redirectUri, verifyToken };
}

export function buildAuthUrl(state: string): string {
  const cfg = getMetaConfig();
  if (!cfg) throw new Error("Meta OAuth is not configured");
  const params = new URLSearchParams({
    client_id: cfg.appId,
    redirect_uri: cfg.redirectUri,
    state,
    scope: FACEBOOK_SCOPES.join(","),
    response_type: "code",
  });
  return `${OAUTH}?${params.toString()}`;
}

interface ShortTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

async function metaFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

export async function exchangeCodeForUserToken(code: string): Promise<string> {
  const cfg = getMetaConfig();
  if (!cfg) throw new Error("Meta OAuth is not configured");
  const params = new URLSearchParams({
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    redirect_uri: cfg.redirectUri,
    code,
  });
  const data = await metaFetch<ShortTokenResponse>(
    `${GRAPH}/oauth/access_token?${params.toString()}`
  );
  return data.access_token;
}

export async function exchangeForLongLivedUserToken(shortToken: string): Promise<string> {
  const cfg = getMetaConfig();
  if (!cfg) throw new Error("Meta OAuth is not configured");
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    fb_exchange_token: shortToken,
  });
  const data = await metaFetch<ShortTokenResponse>(
    `${GRAPH}/oauth/access_token?${params.toString()}`
  );
  return data.access_token;
}

export interface ManagedPage {
  id: string;
  name: string;
  /** A page access token derived from a long-lived user token never expires. */
  access_token: string;
  category?: string;
  tasks?: string[];
}

export async function listManagedPages(longLivedUserToken: string): Promise<ManagedPage[]> {
  const url = `${GRAPH}/me/accounts?fields=id,name,access_token,category,tasks&access_token=${encodeURIComponent(longLivedUserToken)}`;
  const data = await metaFetch<{ data: ManagedPage[] }>(url);
  return data.data ?? [];
}

export async function subscribePageToLeadgen(
  pageId: string,
  pageAccessToken: string
): Promise<void> {
  const params = new URLSearchParams({
    subscribed_fields: "leadgen",
    access_token: pageAccessToken,
  });
  await metaFetch<{ success: boolean }>(
    `${GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps?${params.toString()}`,
    { method: "POST" }
  );
}

export async function unsubscribePage(
  pageId: string,
  pageAccessToken: string
): Promise<void> {
  const params = new URLSearchParams({ access_token: pageAccessToken });
  await metaFetch<{ success: boolean }>(
    `${GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps?${params.toString()}`,
    { method: "DELETE" }
  ).catch(() => {
    // Silent — user is disconnecting either way.
  });
}

export interface LeadFieldDatum {
  name: string;
  values: string[];
}

export interface LeadDetail {
  id: string;
  created_time: string;
  field_data: LeadFieldDatum[];
  form_id?: string;
  form_name?: string;
  ad_id?: string;
  campaign_id?: string;
  campaign_name?: string;
}

export async function getLead(
  leadId: string,
  pageAccessToken: string
): Promise<LeadDetail> {
  const fields = "id,created_time,field_data,form_id,form_name,ad_id,campaign_id,campaign_name";
  const url = `${GRAPH}/${encodeURIComponent(leadId)}?fields=${fields}&access_token=${encodeURIComponent(pageAccessToken)}`;
  return metaFetch<LeadDetail>(url);
}

/**
 * Fetch all leads from a specific form, handling Meta's cursor-based pagination.
 * Returns an array of LeadDetail objects (newest first).
 */
interface LeadsPageResponse {
  data: LeadDetail[];
  paging?: { next?: string };
}

export async function getFormLeads(
  formId: string,
  pageAccessToken: string,
  limit = 50
): Promise<LeadDetail[]> {
  const fields = "id,created_time,field_data,form_id,form_name,ad_id,campaign_id,campaign_name";
  let url: string | null =
    `${GRAPH}/${encodeURIComponent(formId)}/leads?fields=${fields}&limit=${limit}&access_token=${encodeURIComponent(pageAccessToken)}`;

  const allLeads: LeadDetail[] = [];

  while (url) {
    const resp: LeadsPageResponse = await metaFetch<LeadsPageResponse>(url);
    allLeads.push(...(resp.data ?? []));
    url = resp.paging?.next ?? null;
  }

  return allLeads;
}

/**
 * Verify Meta's X-Hub-Signature-256 header.
 * @param rawBody — the exact bytes Meta sent (must NOT be re-stringified)
 * @param signatureHeader — value of X-Hub-Signature-256 (e.g. "sha256=abc...")
 * @param appSecret — META_APP_SECRET
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice("sha256=".length);
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/**
 * Map Meta's lead field_data array to our ContactSubmission shape.
 *
 * Standard Meta field names (full_name, email, phone_number) are matched
 * exactly. Custom Hebrew questions on the Fuzion form are matched by
 * substring so the code is robust to trailing punctuation and RTL
 * reshuffling of leading symbols ("?" / ":"):
 *   - "במה את/ה מתעניין"  → interest (stored as `message`)
 *   - "שם החברה/עסק"       → company
 * Any remaining custom fields are concatenated into `message`.
 */
export function mapLeadFieldsToContact(lead: LeadDetail): {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string;
} {
  const getExact = (...candidates: string[]): string | null => {
    for (const cand of candidates) {
      const found = lead.field_data.find((f) => f.name === cand);
      if (found && found.values?.[0]) return found.values[0];
    }
    return null;
  };

  const getContains = (...needles: string[]): LeadFieldDatum | null => {
    for (const needle of needles) {
      const found = lead.field_data.find((f) => f.name.includes(needle));
      if (found && found.values?.[0]) return found;
    }
    return null;
  };

  const fullName = getExact("full_name");
  const firstName = getExact("first_name");
  const lastName = getExact("last_name");
  const name =
    fullName || [firstName, lastName].filter(Boolean).join(" ") || "ליד מפייסבוק";

  const email = getExact("email") ?? "";
  const phone = getExact("phone_number", "phone");

  const companyField = getContains("שם החברה", "חברה/עסק", "company");
  const company = companyField?.values?.[0] ?? null;

  const interestField = getContains("מתעניין", "interest");
  const interest = interestField?.values?.[0] ?? null;

  // Collect any remaining custom fields for the message body.
  const standardNames = new Set([
    "full_name",
    "first_name",
    "last_name",
    "email",
    "phone_number",
    "phone",
  ]);
  const consumed = new Set<string>();
  if (companyField) consumed.add(companyField.name);
  if (interestField) consumed.add(interestField.name);

  const extraLines = lead.field_data
    .filter((f) => !standardNames.has(f.name) && !consumed.has(f.name) && f.values?.[0])
    .map((f) => `${f.name}: ${f.values.join(", ")}`);

  const parts: string[] = [];
  if (interest) parts.push(interest);
  if (extraLines.length) parts.push(...extraLines);
  const message =
    parts.length > 0
      ? parts.join("\n")
      : lead.form_name
      ? `התקבל מטופס: ${lead.form_name}`
      : "ליד מפייסבוק (ללא תוכן נוסף)";

  return { name, email, phone, company, message };
}
