import { prisma } from "@/lib/prisma";

interface CronHandlerOptions<T extends { action: string; [key: string]: unknown }> {
  enabled: boolean;
  adminKillSwitch?: boolean;
  action: () => Promise<T>;
}

async function runCron<T extends { action: string; [key: string]: unknown }>(
  options: CronHandlerOptions<T>,
): Promise<{ enabled: boolean; action: string; [key: string]: unknown }> {
  if (!options.enabled) return { enabled: false, action: "disabled" };
  if (options.adminKillSwitch) return { enabled: false, action: "admin-kill-switch" };
  return { enabled: true, ...(await options.action()) };
}

export const runProspectingProposalCron = runCron;
export const runProspectingWorkerCron = runCron;
export const runProspectingMaintenanceCron = runCron;

export async function isProspectingAdminKillSwitchActive(): Promise<boolean> {
  const setting = await prisma.keyValue.findUnique({
    where: { key: "prospecting:adminKillSwitch" },
  });
  return setting?.value === true;
}

export async function performProspectingMaintenance(now = new Date()): Promise<{
  action: "maintained";
  releasedCycles: number;
  releasedProspects: number;
}> {
  const staleBefore = new Date(now.getTime() - 15 * 60 * 1_000);
  const [cycles, prospects] = await prisma.$transaction([
    prisma.prospectingCycle.updateMany({
      where: { lockedAt: { lt: staleBefore } },
      data: { lockedAt: null, lockToken: null },
    }),
    prisma.prospect.updateMany({
      where: { status: "AUDITING", updatedAt: { lt: staleBefore } },
      data: { status: "AUDIT_PENDING", nextAuditAt: now },
    }),
  ]);
  return {
    action: "maintained",
    releasedCycles: cycles.count,
    releasedProspects: prospects.count,
  };
}
