import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The Facebook Lead Ads connection is operated by whichever ADMIN owns a
 * Facebook profile that can see the Page — since 16.8.2026 that is Roy, not
 * Elad (Elad's profile is gone). Every route on the integration surface must
 * therefore gate on the persisted ADMIN role, not on isOwner, and none may be
 * left ungated. This test pins both.
 */
const ROUTES = ["connect", "callback", "pages", "subscribe", "status", "disconnect", "sync"];

for (const name of ROUTES) {
  test(`facebook/${name} gates on persisted ADMIN, not owner`, () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/api/integrations/facebook", name, "route.ts"),
      "utf8",
    );
    assert.match(src, /await\s+requireAdmin\(\s*\)/, `${name}: must call requireAdmin()`);
    assert.doesNotMatch(src, /requireOwner\(/, `${name}: owner-only gate would lock Roy out`);
  });
}
