import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("prospecting worker allows the bounded external audits to complete", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src/app/api/cron/prospecting-worker/route.ts"),
    "utf8",
  );

  assert.match(source, /export const maxDuration = 300;/);
});
