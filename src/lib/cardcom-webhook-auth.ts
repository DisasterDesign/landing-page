import { timingSafeEqual } from "node:crypto";

type RecurringWebhookSecretResult =
  | { ok: true }
  | {
      ok: false;
      status: 403 | 503;
      reason: "secret-mismatch" | "secret-not-configured";
    };

export function verifyRecurringWebhookSecret(input: {
  expectedSecret: string | undefined;
  receivedSecret: string | null | undefined;
}): RecurringWebhookSecretResult {
  const expected = input.expectedSecret;
  if (!expected) {
    return {
      ok: false,
      status: 503,
      reason: "secret-not-configured",
    };
  }

  const received = input.receivedSecret ?? "";
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  if (
    expectedBytes.length !== receivedBytes.length ||
    !timingSafeEqual(expectedBytes, receivedBytes)
  ) {
    return {
      ok: false,
      status: 403,
      reason: "secret-mismatch",
    };
  }

  return { ok: true };
}
