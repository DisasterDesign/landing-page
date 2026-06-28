/**
 * Creates (or refreshes) the single Agreement row that backs the Ormat
 * proposal page at ormat.fuzionwebz.com.
 *
 * Run:  npx tsx prisma/seed-ormat.ts
 *
 * Idempotent: upserts by signToken. If the agreement is already SIGNED or
 * CANCELLED it is left untouched. dotenv is not a dependency, so .env is loaded
 * inline below before the Prisma client is constructed.
 */
import { readFileSync } from "fs";
import { join } from "path";

// --- load .env (KEY=value, optional quotes) into process.env -------------
for (const line of readFileSync(join(process.cwd(), ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (!m) continue;
  const key = m[1];
  if (process.env[key] !== undefined) continue;
  let val = m[2];
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

import { PrismaClient } from "@prisma/client";
import {
  ORMAT_PROPOSAL_TOKEN,
  ormatPricing,
  ormatLegalBodyHtml,
  ormatMeta,
} from "../src/config/ormat-proposal";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.agreement.findUnique({
    where: { signToken: ORMAT_PROPOSAL_TOKEN },
    select: { id: true, status: true },
  });

  if (existing && (existing.status === "SIGNED" || existing.status === "CANCELLED")) {
    console.log(
      `↩︎  Ormat agreement already ${existing.status} (id ${existing.id}) — leaving untouched.`
    );
    return;
  }

  const placeholderContent =
    "<p>Ormat proposal — view at https://ormat.fuzionwebz.com</p>";

  const data = {
    tier: null,
    monthlyPrice: 0,
    oneTimeFee: ormatPricing.firstPaymentNet, // 22,500 net → 26,550 gross at first charge
    locale: "he",
    vatExempt: false,
    customerName: ormatMeta.clientName,
    businessName: ormatMeta.clientLegalName,
    idNumber: null,
    phone: "0500000000",
    email: "info@ormat.com",
    status: "SENT" as const,
    content: placeholderContent,
    customBodyHtml: ormatLegalBodyHtml,
    createdBy: "system:ormat-proposal",
  };

  const agreement = await prisma.agreement.upsert({
    where: { signToken: ORMAT_PROPOSAL_TOKEN },
    update: {
      // Refresh the terms + price on re-run, but never overwrite signer data.
      oneTimeFee: data.oneTimeFee,
      monthlyPrice: data.monthlyPrice,
      customBodyHtml: data.customBodyHtml,
      content: data.content,
      businessName: data.businessName,
      status: data.status,
    },
    create: {
      ...data,
      signToken: ORMAT_PROPOSAL_TOKEN,
    },
    select: { id: true, signToken: true, status: true, oneTimeFee: true },
  });

  console.log("✓ Ormat agreement ready:");
  console.log(`  id:        ${agreement.id}`);
  console.log(`  signToken: ${agreement.signToken}`);
  console.log(`  status:    ${agreement.status}`);
  console.log(`  firstPay:  ${agreement.oneTimeFee} ₪ net  → ${ormatPricing.firstPaymentGross} ₪ gross`);
  console.log("  page:      https://ormat.fuzionwebz.com");
}

main()
  .catch((e) => {
    console.error("✗ seed-ormat failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
