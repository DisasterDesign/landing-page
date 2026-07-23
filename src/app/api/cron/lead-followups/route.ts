export const dynamic = "force-dynamic";
export const maxDuration = 60;

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cron-auth";
import { dispatchDueFollowUps } from "@/lib/leads/follow-up-reminders";
import { dispatchLeadSlaAlerts } from "@/lib/leads/lead-sla";

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const [followUps, sla] = await Promise.all([
    dispatchDueFollowUps(now),
    dispatchLeadSlaAlerts(now),
  ]);
  return NextResponse.json({ followUps, sla });
}
