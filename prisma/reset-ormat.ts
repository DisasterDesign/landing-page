/**
 * Resets the Ormat proposal agreement back to SENT so the page is viewable and
 * signable again (used during iteration / after a test sign).
 *
 * Run:  npx tsx prisma/reset-ormat.ts
 *
 * Safety: if a real payment already COMPLETED, it aborts and prints the state
 * instead of wiping it — so a genuine signed+paid record is never silently lost.
 */
import { readFileSync } from "fs";
import { join } from "path";

for (const line of readFileSync(join(process.cwd(), ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (!m) continue;
  if (process.env[m[1]] !== undefined) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[m[1]] = v;
}

import { PrismaClient } from "@prisma/client";
import { ORMAT_PROPOSAL_TOKEN } from "../src/config/ormat-proposal";

const prisma = new PrismaClient();

async function main() {
  const a = await prisma.agreement.findUnique({
    where: { signToken: ORMAT_PROPOSAL_TOKEN },
    select: {
      id: true, status: true, customerName: true, email: true, signedAt: true,
      signedIp: true, paymentStatus: true, paidAmount: true, invoiceNumber: true,
    },
  });
  if (!a) {
    console.log("No Ormat agreement found. Run prisma/seed-ormat.ts first.");
    return;
  }

  console.log("Current state:");
  console.log(JSON.stringify(a, null, 2));

  if (a.paymentStatus === "COMPLETED") {
    console.log("\n⚠️  paymentStatus is COMPLETED — a real charge exists. NOT resetting.");
    console.log("   If this was a test charge, reset manually after confirming.");
    return;
  }

  await prisma.agreement.update({
    where: { signToken: ORMAT_PROPOSAL_TOKEN },
    data: {
      status: "SENT",
      signatureData: null,
      signedAt: null,
      signedIp: null,
      signedUserAgent: null,
      paymentStatus: "PENDING",
      paymentUrl: null,
      paymentId: null,
    },
  });
  console.log("\n✓ Reset to SENT — proposal is viewable and signable again.");
}

main()
  .catch((e) => { console.error("✗ reset-ormat failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
