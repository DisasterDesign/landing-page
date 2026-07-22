import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

import { isForbiddenHostname, isPublicIp } from "./network-safety";

export const CONNECT_TIMEOUT_MS = 5_000;
export const TOTAL_TIMEOUT_MS = 12_000;
export const MAX_REDIRECTS = 5;
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
export const MAX_ANALYSIS_CHARS = 100_000;

type LookupResult = { address: string; family: number };
type Lookup = (hostname: string) => Promise<LookupResult[]>;
type FetchImplementation = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type SafeFetchFailureCode =
  | "INVALID_URL"
  | "BLOCKED_HOST"
  | "DNS_FAILURE"
  | "TIMEOUT"
  | "TOO_MANY_REDIRECTS"
  | "HTTP_ERROR"
  | "NON_HTML"
  | "RESPONSE_TOO_LARGE"
  | "FETCH_ERROR";

export type SafeHtmlResult =
  | { ok: true; url: string; status: number; html: string; responseBytes: number }
  | { ok: false; code: SafeFetchFailureCode; status?: number };

export interface SafeFetchOptions {
  lookup?: Lookup;
  fetchImpl?: FetchImplementation;
}

const defaultLookup: Lookup = async (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true });

function parseHttpUrl(value: string, base?: URL): URL | null {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

async function validateTarget(url: URL, lookup: Lookup): Promise<SafeFetchFailureCode | null> {
  if (isForbiddenHostname(url.hostname)) return "BLOCKED_HOST";

  const literalFamily = isIP(url.hostname);
  if (literalFamily > 0) return isPublicIp(url.hostname) ? null : "BLOCKED_HOST";

  let addresses: LookupResult[];
  try {
    addresses = await lookup(url.hostname);
  } catch {
    return "DNS_FAILURE";
  }

  if (addresses.length === 0) return "DNS_FAILURE";
  if (addresses.some(({ address }) => !isPublicIp(address))) return "BLOCKED_HOST";
  return null;
}

async function readBoundedHtml(response: Response): Promise<SafeHtmlResult> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    return { ok: false, code: "NON_HTML" };
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    return { ok: false, code: "RESPONSE_TOO_LARGE" };
  }

  if (!response.body) {
    return { ok: true, url: "", status: response.status, html: "", responseBytes: 0 };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let html = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      return { ok: false, code: "RESPONSE_TOO_LARGE" };
    }
    if (html.length < MAX_ANALYSIS_CHARS) {
      html += decoder.decode(value, { stream: true });
      if (html.length > MAX_ANALYSIS_CHARS) html = html.slice(0, MAX_ANALYSIS_CHARS);
    }
  }

  if (html.length < MAX_ANALYSIS_CHARS) html += decoder.decode();
  return { ok: true, url: "", status: response.status, html, responseBytes: bytes };
}

export async function safeFetchHtml(
  initialUrl: string,
  options: SafeFetchOptions = {},
): Promise<SafeHtmlResult> {
  const lookup = options.lookup ?? defaultLookup;
  const fetchImpl = options.fetchImpl ?? fetch;
  let current = parseHttpUrl(initialUrl);
  if (!current) return { ok: false, code: "INVALID_URL" };

  const totalController = new AbortController();
  const totalTimer = setTimeout(() => totalController.abort(), TOTAL_TIMEOUT_MS);

  try {
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      const targetFailure = await validateTarget(current, lookup);
      if (targetFailure) return { ok: false, code: targetFailure };

      const connectController = new AbortController();
      const connectTimer = setTimeout(() => connectController.abort(), CONNECT_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetchImpl(current, {
          method: "GET",
          redirect: "manual",
          credentials: "omit",
          signal: AbortSignal.any([totalController.signal, connectController.signal]),
          headers: {
            accept: "text/html,application/xhtml+xml",
            "user-agent": "FuzionWebz-SiteAudit/1.0",
          },
        });
      } catch (error) {
        if (totalController.signal.aborted || connectController.signal.aborted) {
          return { ok: false, code: "TIMEOUT" };
        }
        void error;
        return { ok: false, code: "FETCH_ERROR" };
      } finally {
        clearTimeout(connectTimer);
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return { ok: false, code: "HTTP_ERROR", status: response.status };
        if (redirectCount === MAX_REDIRECTS) return { ok: false, code: "TOO_MANY_REDIRECTS" };
        const redirectUrl = parseHttpUrl(location, current);
        if (!redirectUrl) return { ok: false, code: "INVALID_URL" };
        current = redirectUrl;
        continue;
      }

      if (!response.ok) return { ok: false, code: "HTTP_ERROR", status: response.status };
      const result = await readBoundedHtml(response);
      return result.ok ? { ...result, url: current.toString() } : result;
    }

    return { ok: false, code: "TOO_MANY_REDIRECTS" };
  } finally {
    clearTimeout(totalTimer);
  }
}
