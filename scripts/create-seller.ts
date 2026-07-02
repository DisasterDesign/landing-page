/**
 * Create (or update) a seller user. Sellers sign in by USERNAME, not email,
 * so we generate a synthetic unique email to satisfy the required column.
 *
 * Usage:
 *   SELLER_NAME="לי ניסים" SELLER_USERNAME="LEE" SELLER_PASSWORD="LEE1234" \
 *     npx tsx scripts/create-seller.ts
 *
 * Idempotent: re-running with the same username updates name/password/role.
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const name = process.env.SELLER_NAME?.trim();
  const username = process.env.SELLER_USERNAME?.trim();
  const password = process.env.SELLER_PASSWORD;

  if (!name || !username || !password) {
    throw new Error(
      "Missing SELLER_NAME / SELLER_USERNAME / SELLER_PASSWORD env vars"
    );
  }

  const email =
    process.env.SELLER_EMAIL?.trim().toLowerCase() ||
    `${username.toLowerCase()}@sellers.fuzionwebz.com`;
  const passwordHash = await hash(password, 12);

  // Match by username first (the stable seller handle); fall back to email.
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: username, mode: "insensitive" } },
        { email },
      ],
    },
  });

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { name, username, passwordHash, role: "SELLER", mustChangePassword: true },
    });
    console.log(`Updated seller: ${updated.name} (username=${updated.username}, id=${updated.id})`);
  } else {
    const created = await prisma.user.create({
      data: { name, username, email, passwordHash, role: "SELLER", mustChangePassword: true },
    });
    console.log(`Created seller: ${created.name} (username=${created.username}, id=${created.id})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
