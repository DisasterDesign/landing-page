import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(file: string) {
  return readFileSync(new URL(file, import.meta.url), "utf8");
}

test("outcome choices expose pressed semantics and reset when the sheet opens", () => {
  const outcome = source("./LeadOutcomeSheet.tsx");
  const workspace = source("../../leads/LeadWorkspace.tsx");

  assert.match(outcome, /role="group"/);
  assert.match(outcome, /aria-pressed=\{outcome === value\}/);
  assert.match(workspace, /outcomeOpen\s*&&\s*\(\s*<LeadOutcomeSheet/);
});

test("incoming claim opens source context before any explicit phone call", () => {
  const incoming = source("./UnifiedIncomingLeadsPage.tsx");
  const claimStart = incoming.indexOf("async function claim");
  const claimEnd = incoming.indexOf("\n  function copyPhone", claimStart);
  const claim = incoming.slice(claimStart, claimEnd);

  assert.doesNotMatch(incoming, /tel:/);
  assert.doesNotMatch(claim, /setTimeout/);
  assert.match(
    claim,
    /router\.push\(\s*`\/seller\/leads\/\$\{encodeURIComponent\(lead\.id\)\}\?tab=preparation`,?\s*\)/,
  );
  assert.match(incoming, /קח ליד והצג פרטי פנייה/);
  assert.match(
    incoming,
    /href=\{`\/seller\/leads\/\$\{encodeURIComponent\(lead\.id\)\}\?tab=preparation`\}/,
  );
});

test("cold preparation claims and opens the exact lead on preparation", () => {
  const cold = source("./UnifiedColdLeadsPage.tsx");
  const claimStart = cold.indexOf("async function claim");
  const claimEnd = cold.indexOf("\n\n  const leads", claimStart);
  const claim = cold.slice(claimStart, claimEnd);

  assert.match(
    claim,
    /router\.push\(\s*`\/seller\/leads\/\$\{encodeURIComponent\(lead\.id\)\}\?tab=preparation`,?\s*\)/,
  );
});

test("seller detail passes the requested tab through the workspace whitelist", () => {
  const workspace = source("../../leads/LeadWorkspace.tsx");
  const detailPage = source(
    "../../../app/seller/(dashboard)/leads/[id]/page.tsx",
  );

  assert.match(
    workspace,
    /leadWorkspaceTabFromQuery\(initialTab\)/,
  );
  assert.match(detailPage, /searchParams:\s*Promise/);
  assert.match(detailPage, /initialTab=\{tab\}/);
});

test("cold queue consumes nextCursor and offers access to later pages", () => {
  const cold = source("./UnifiedColdLeadsPage.tsx");

  assert.match(cold, /cursor=\$\{encodeURIComponent/);
  assert.match(cold, /mergeLeadQueueItems/);
  assert.match(cold, /טען עוד/);
});

test("incoming queue consumes nextCursor and offers access to later pages", () => {
  const incoming = source("./UnifiedIncomingLeadsPage.tsx");

  assert.match(incoming, /cursor=\$\{encodeURIComponent/);
  assert.match(incoming, /mergeLeadQueueItems/);
  assert.match(incoming, /טען עוד/);
});

test("incoming email action is gated by contact capability and DNC state", () => {
  const incoming = source("./UnifiedIncomingLeadsPage.tsx");

  assert.match(
    incoming,
    /lead\.email\s*&&\s*lead\.capabilities\.canContact\s*&&\s*!lead\.doNotContactAt/,
  );
});
