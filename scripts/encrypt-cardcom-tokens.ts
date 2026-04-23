/**
 * One-shot migration: encrypt existing plaintext `Agreement.cardcomToken`
 * rows in place. Idempotent — rows whose token is already in the encrypted
 * (iv|tag|ct base64) shape are skipped.
 *
 * Run:
 *   npx tsx --env-file=.env scripts/encrypt-cardcom-tokens.ts
 *
 * Requires OAUTH_ENCRYPTION_KEY to be set.
 */
import { PrismaClient } from "@prisma/client";
import { encrypt, decrypt } from "../src/lib/crypto";

const prisma = new PrismaClient();

// Encrypted tokens from crypto.ts are base64-encoded (iv=12 + tag=16 +
// ciphertext), so the shortest possible encrypted output for even a 1-char
// token is ~40 base64 chars. We use a stronger signal: try to decrypt. If
// that succeeds, it's already encrypted. If it throws, it's plaintext.
function isAlreadyEncrypted(token: string): boolean {
  try {
    decrypt(token);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const rows = await prisma.agreement.findMany({
    where: { cardcomToken: { not: null } },
    select: { id: true, cardcomToken: true },
  });

  console.log(`Found ${rows.length} agreement(s) with a cardcomToken.`);

  let migrated = 0;
  let skipped = 0;

  for (const r of rows) {
    if (!r.cardcomToken) continue;
    if (isAlreadyEncrypted(r.cardcomToken)) {
      skipped++;
      continue;
    }
    const encrypted = encrypt(r.cardcomToken);
    await prisma.agreement.update({
      where: { id: r.id },
      data: { cardcomToken: encrypted },
    });
    migrated++;
  }

  console.log(`Done: ${migrated} migrated, ${skipped} already encrypted.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
