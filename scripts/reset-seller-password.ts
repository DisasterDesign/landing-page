/**
 * Resets one user's password to a fresh temporary one.
 *
 * Separate from create-seller.ts on purpose: that script also overwrites name,
 * email and role, which is the wrong blast radius for "they forgot their
 * password".
 *
 * The new password is random and printed once. `mustChangePassword` is set, so
 * the login flow forces the user to replace it — the temporary value is only
 * valid until they first sign in.
 *
 *   npx tsx scripts/reset-seller-password.ts <username>
 *   PASSWORD=chosen-value npx tsx scripts/reset-seller-password.ts <username>
 */
import { randomBytes } from "crypto";

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

/** No 0/O/1/l/I — this gets read aloud or typed on a phone. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generatePassword(): string {
  const bytes = randomBytes(12);
  const body = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error("usage: npx tsx scripts/reset-seller-password.ts <username>");
    process.exit(1);
  }

  // Login is case-insensitive, so the lookup must be too — otherwise "delbaz"
  // fails to find the user stored as "Elbaz".
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true, name: true, username: true, role: true },
  });
  if (!user) {
    const all = await prisma.user.findMany({ select: { username: true } });
    console.error(
      `no user with username "${username}". known: ${all
        .map((u) => u.username)
        .filter(Boolean)
        .join(", ")}`,
    );
    process.exit(1);
  }

  const password = process.env.PASSWORD || generatePassword();
  // Cost 12 — the project's baseline, and what create-seller.ts uses.
  const passwordHash = await hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: true },
  });

  console.log(`\nreset: ${user.name} (${user.username}, ${user.role})`);
  console.log(`temporary password: ${password}`);
  console.log("\nmustChangePassword is set — they must choose a new one at first login.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("FAILED:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
