import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getMetaConfig } from "@/lib/facebook";

/**
 * The Meta app credentials must live in env only.
 *
 * The original app's secret was committed on 23.4.2026 and flagged public by
 * GitGuardian the same day; that app is also orphaned (its sole admin was
 * Elad's deleted profile). Roy's replacement app must never repeat this — a
 * secret in source is a secret on GitHub.
 */
const ORIGINAL_APP_ID = "1731795861128446";

test("no Meta credential is hardcoded in the source", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/facebook.ts"), "utf8");
  assert.equal(src.includes(ORIGINAL_APP_ID), false, "the leaked app id must be gone");
  // A 32-hex literal in this file is an app secret or a verify token.
  const hexLiteral = src.match(/["'][0-9a-f]{32,}["']/);
  assert.equal(hexLiteral, null, `secret-shaped literal in source: ${hexLiteral?.[0]}`);
});

test("getMetaConfig returns null when the env vars are absent", () => {
  const saved = {
    id: process.env.META_APP_ID,
    secret: process.env.META_APP_SECRET,
    redirect: process.env.META_REDIRECT_URI,
    verify: process.env.META_WEBHOOK_VERIFY_TOKEN,
  };
  delete process.env.META_APP_ID;
  delete process.env.META_APP_SECRET;
  delete process.env.META_REDIRECT_URI;
  delete process.env.META_WEBHOOK_VERIFY_TOKEN;
  try {
    // Null makes the admin page render "מחכה להגדרת מפתחות Meta" instead of
    // silently authenticating against a dead app.
    assert.equal(getMetaConfig(), null);
  } finally {
    if (saved.id) process.env.META_APP_ID = saved.id;
    if (saved.secret) process.env.META_APP_SECRET = saved.secret;
    if (saved.redirect) process.env.META_REDIRECT_URI = saved.redirect;
    if (saved.verify) process.env.META_WEBHOOK_VERIFY_TOKEN = saved.verify;
  }
});

test("a partially configured app is treated as unconfigured, not half-connected", () => {
  const saved = { ...process.env };
  process.env.META_APP_ID = "123";
  delete process.env.META_APP_SECRET;
  process.env.META_REDIRECT_URI = "https://x/cb";
  process.env.META_WEBHOOK_VERIFY_TOKEN = "tok";
  try {
    assert.equal(getMetaConfig(), null);
  } finally {
    process.env = saved;
  }
});

test("a fully configured app is returned as-is", () => {
  const saved = { ...process.env };
  process.env.META_APP_ID = "999";
  process.env.META_APP_SECRET = "sec";
  process.env.META_REDIRECT_URI = "https://x/cb";
  process.env.META_WEBHOOK_VERIFY_TOKEN = "tok";
  try {
    assert.deepEqual(getMetaConfig(), {
      appId: "999",
      appSecret: "sec",
      redirectUri: "https://x/cb",
      verifyToken: "tok",
    });
  } finally {
    process.env = saved;
  }
});
