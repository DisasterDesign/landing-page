import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";
import { OAUTH_ENCRYPTION_KEY as INJECTED_KEY } from "@/lib/env-runtime";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.OAUTH_ENCRYPTION_KEY || INJECTED_KEY;
  if (!raw) {
    throw new Error("OAUTH_ENCRYPTION_KEY is not configured");
  }
  // Accept any length input — derive a 32-byte key via SHA-256.
  return createHash("sha256").update(raw).digest();
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Pack: iv | tag | ciphertext, base64 encoded
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}
