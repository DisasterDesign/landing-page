import { prisma } from "@/lib/prisma";

export interface SellerAssignmentStore {
  keyValue: {
    findUnique(args: {
      where: { key: string };
      select: { value: true };
    }): Promise<{ value: unknown } | null>;
  };
  user: {
    findFirst(args: {
      where: { id: string; role: "SELLER" };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
}

const assignmentKeys = [
  "sales:defaultSellerId",
  "prospecting:defaultSellerId",
] as const;

export async function resolveEligibleSellerId(
  database: SellerAssignmentStore = prisma,
): Promise<string | null> {
  for (const key of assignmentKeys) {
    const setting = await database.keyValue.findUnique({
      where: { key },
      select: { value: true },
    });
    const sellerId =
      typeof setting?.value === "string" ? setting.value.trim() : "";
    if (!sellerId) continue;
    const seller = await database.user.findFirst({
      where: { id: sellerId, role: "SELLER" },
      select: { id: true },
    });
    if (seller) return seller.id;
  }
  return null;
}
