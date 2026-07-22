import { NextRequest, NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cron-auth";
import {
  isProspectingAdminKillSwitchActive,
  performProspectingMaintenance,
  runProspectingMaintenanceCron,
} from "@/lib/prospecting/cron-handlers";
import { getProspectingConfig } from "@/lib/prospecting/config";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = getProspectingConfig();
  const result = await runProspectingMaintenanceCron({
    enabled: config.enabled,
    adminKillSwitch: config.enabled ? await isProspectingAdminKillSwitchActive() : false,
    action: () => performProspectingMaintenance(),
  });
  return NextResponse.json(result);
}
