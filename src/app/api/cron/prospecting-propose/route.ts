import { NextRequest, NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cron-auth";
import {
  isProspectingAdminKillSwitchActive,
  runProspectingProposalCron,
} from "@/lib/prospecting/cron-handlers";
import { getProspectingConfig } from "@/lib/prospecting/config";
import { createWeeklyProposal } from "@/lib/prospecting/territory";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = getProspectingConfig();
  const result = await runProspectingProposalCron({
    enabled: config.enabled,
    adminKillSwitch: config.enabled ? await isProspectingAdminKillSwitchActive() : false,
    action: () => createWeeklyProposal(),
  });
  return NextResponse.json(result);
}
