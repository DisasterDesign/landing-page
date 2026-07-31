/**
 * Stage 7 — Roy ADMIN → SELLER (partner). Approved by Elad 28.7.2026
 * ("הבירוקרטיה לגבי רועי בוצע... צא למימוש מלא").
 * Rollback: UPDATE "User" SET role='ADMIN' WHERE email='roy@fuzionwebz.com'
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const APPLY = process.env.APPLY === "1";
const roy = await p.user.findUnique({ where: { email: "roy@fuzionwebz.com" }, select: { id: true, name: true, role: true, isOwner: true, revenueSharePct: true } });
console.log("לפני:", JSON.stringify(roy));
if (APPLY) {
  await p.user.update({ where: { email: "roy@fuzionwebz.com" }, data: { role: "SELLER" } });
  const after = await p.user.findUnique({ where: { email: "roy@fuzionwebz.com" }, select: { role: true, isOwner: true, revenueSharePct: true } });
  console.log("אחרי:", JSON.stringify(after));
  const owners = await p.user.findMany({ where: { isOwner: true }, select: { name: true, role: true } });
  console.log("בעלים:", JSON.stringify(owners));
} else console.log("DRY RUN");
await p.$disconnect();
