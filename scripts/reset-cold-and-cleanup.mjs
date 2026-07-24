// One-time reset (Elad, 24.7): archive then delete the entire first
// prospecting run (Dizengoff+Yavne) and the website test lead, for a clean
// fresh sweep. Dry-run by default; APPLY=1 to execute.
import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
const p = new PrismaClient();
const APPLY = process.env.APPLY === "1";
const dir = process.env.HOME + "/Documents/fuzion-recovery-2026-07-23";
mkdirSync(dir, { recursive: true });

// A second run after deletion overwrites the archive with the now-empty DB
// state — that ALREADY HAPPENED on 24.7 (archive lost, rebuilt from pg_dump).
// Never overwrite an existing archive file.
const archivePath = `${dir}/prospecting-run1-archive-2026-07-24.json`;
if (existsSync(archivePath)) {
  console.error(`archive already exists: ${archivePath} — refusing to overwrite. Move it aside first.`);
  process.exit(1);
}

const coldLeads = await p.contactSubmission.findMany({
  where: { intentLevel: "OUTBOUND" },
  include: { events: true, interactions: true, followUps: true },
});
const testLeads = await p.contactSubmission.findMany({
  where: { intentLevel: "INBOUND", stage: "SPAM" },
  include: { events: true },
});
const [cycles, proposals, batches, prospects, audits] = await Promise.all([
  p.prospectingCycle.findMany(),
  p.territoryProposal.findMany(),
  p.weeklyProspectBatch.findMany(),
  p.prospect.findMany(),
  p.prospectWebsiteAudit.findMany(),
]);
const archive = {
  archivedAt: new Date().toISOString(),
  reason: "Elad requested a clean prospecting slate before a fresh sweep",
  coldLeads, testLeads, cycles, proposals, batches, prospects, audits,
};
const file = archivePath;
writeFileSync(file, JSON.stringify(archive, null, 1), { mode: 0o600 });
console.log(`archived: ${coldLeads.length} cold leads, ${testLeads.length} test leads, ${prospects.length} prospects, ${cycles.length} cycles → ${file}`);

if (!APPLY) { console.log("DRY RUN — nothing deleted. APPLY=1 to execute."); process.exit(0); }

const leadIds = [...coldLeads, ...testLeads].map((l) => l.id);
const r = {};
r.notifications = (await p.notification.updateMany({ where: { leadId: { in: leadIds } }, data: { leadId: null } })).count;
r.events = (await p.leadEvent.deleteMany({ where: { leadId: { in: leadIds } } })).count;
r.interactions = (await p.leadInteraction.deleteMany({ where: { leadId: { in: leadIds } } })).count;
r.followUps = (await p.leadFollowUp.deleteMany({ where: { leadId: { in: leadIds } } })).count;
r.prospectInteractions = (await p.prospectInteraction.deleteMany({})).count;
r.suppressions = (await p.prospectSuppression.deleteMany({})).count;
r.audits = (await p.prospectWebsiteAudit.deleteMany({})).count;
r.prospects = (await p.prospect.deleteMany({})).count;
r.batches = (await p.weeklyProspectBatch.deleteMany({})).count;
r.proposals = (await p.territoryProposal.deleteMany({})).count;
r.cycles = (await p.prospectingCycle.deleteMany({})).count;
r.leads = (await p.contactSubmission.deleteMany({ where: { id: { in: leadIds } } })).count;
console.log("deleted:", JSON.stringify(r));
console.log("leads remaining:", await p.contactSubmission.count());
await p.$disconnect();
