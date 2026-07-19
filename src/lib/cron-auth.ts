import type { NextRequest } from "next/server";

/**
 * Shared authorization for /api/cron/* routes.
 *
 * When CRON_SECRET is set (and Vercel injects it as a Bearer automatically),
 * the bearer match is the ONLY accepted proof — a spoofable user-agent must
 * not open a route that can hammer external APIs. Without the secret we fall
 * back to the vercel-cron user-agent so deploys keep working, but the old
 * "no secret configured → allow everyone" hole stays closed.
 */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || "";
  const auth = req.headers.get("authorization");
  if (secret) return auth === `Bearer ${secret}`;
  console.warn("[cron] CRON_SECRET not set — falling back to user-agent check");
  return req.headers.get("user-agent")?.includes("vercel-cron") ?? false;
}
