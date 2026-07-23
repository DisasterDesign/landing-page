import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireProspectingAdmin } from "@/lib/prospecting/admin-auth";
import { getProspectingConfig } from "@/lib/prospecting/config";
import { prospectingSettingsSchema } from "@/lib/validations";

export async function GET() {
  if (!(await requireProspectingAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const [settings, sellers] = await Promise.all([
    prisma.keyValue.findMany({
      where: {
        key: {
          in: [
            "prospecting:defaultSellerId",
            "prospecting:adminKillSwitch",
            "prospecting:weeklyTarget",
          ],
        },
      },
    }),
    prisma.user.findMany({
      where: { role: "SELLER" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const values = new Map(settings.map(({ key, value }) => [key, value]));
  const config = getProspectingConfig();
  return NextResponse.json({
    environmentEnabled: config.enabled,
    sellerId: values.get("prospecting:defaultSellerId") ?? null,
    adminKillSwitch: values.get("prospecting:adminKillSwitch") === true,
    weeklyTarget: values.get("prospecting:weeklyTarget") ?? 50,
    sellers,
  });
}

export async function PUT(request: Request) {
  if (!(await requireProspectingAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = prospectingSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }
  const seller = await prisma.user.findFirst({
    where: { id: parsed.data.sellerId, role: "SELLER" },
    select: { id: true },
  });
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 400 });

  await prisma.$transaction([
    prisma.keyValue.upsert({
      where: { key: "prospecting:defaultSellerId" },
      create: { key: "prospecting:defaultSellerId", value: seller.id },
      update: { value: seller.id },
    }),
    // Lead routing reads sales:defaultSellerId FIRST (assignment.ts) but no
    // code ever wrote it — keep both keys in lockstep so warm-lead routing
    // never silently depends on the prospecting fallback.
    prisma.keyValue.upsert({
      where: { key: "sales:defaultSellerId" },
      create: { key: "sales:defaultSellerId", value: seller.id },
      update: { value: seller.id },
    }),
    prisma.keyValue.upsert({
      where: { key: "prospecting:adminKillSwitch" },
      create: { key: "prospecting:adminKillSwitch", value: parsed.data.adminKillSwitch },
      update: { value: parsed.data.adminKillSwitch },
    }),
    prisma.keyValue.upsert({
      where: { key: "prospecting:weeklyTarget" },
      create: { key: "prospecting:weeklyTarget", value: parsed.data.weeklyTarget },
      update: { value: parsed.data.weeklyTarget },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
