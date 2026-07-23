import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("legacy incoming keeps structured outcomes and company history", () => {
  const page = source("./LegacyIncomingLeadsPage.tsx");
  const route = source("../../../app/api/seller/leads/route.ts");

  assert.match(page, /LeadOutcomeSheet/);
  assert.match(page, /\/interactions/);
  assert.match(route, /myNotesCount:\s*lead\.noteCount/);
});

test("legacy seller deep links request and report the exact scoped lead", () => {
  const incomingPage = source("./LegacyIncomingLeadsPage.tsx");
  const coldPage = source("./LegacyColdLeadsPage.tsx");
  const incomingRoute = source("../../../app/api/seller/leads/route.ts");
  const coldRoute = source("../../../app/api/seller/cold-leads/route.ts");

  assert.match(incomingPage, /focusState/);
  assert.match(coldPage, /focusState/);
  assert.match(incomingRoute, /searchParams\.get\("focus"\)/);
  assert.match(coldRoute, /searchParams\.get\("focus"\)/);
});

test("legacy cold cards use canonical append-only company notes", () => {
  const page = source("./LegacyColdLeadsPage.tsx");
  const card = source("../LegacyColdLeadCard.tsx");
  const notesRoute = source(
    "../../../app/api/seller/leads/[id]/notes/route.ts",
  );

  assert.match(page, /lead\.leadId/);
  assert.match(page, /\/api\/seller\/leads\/\$\{leadId\}\/notes/);
  assert.match(page, /method:\s*"POST"/);
  assert.match(page, /await load\(\)/);
  assert.match(card, /הערות חברה/);
  assert.match(card, /companyNotesCount/);
  assert.match(card, /canManageCompanyNotes/);
  assert.doesNotMatch(page, /method:\s*"DELETE"/);
  assert.doesNotMatch(card, /privateNote|isPrivate|הערה פרטית/iu);
  assert.match(notesRoute, /Lead notes are append-only/);
});

test("legacy rollback phone copy is capability-gated and has a selectable fallback", () => {
  const coldCard = source("../LegacyColdLeadCard.tsx");
  const incomingPage = source("./LegacyIncomingLeadsPage.tsx");
  const incomingRoute = source("../../../app/api/seller/leads/route.ts");

  assert.match(coldCard, /function copyPhone/);
  assert.match(coldCard, /lead\.liveStatus !== "READY"/);
  assert.match(coldCard, /contactBlocked/);
  assert.match(coldCard, /navigator\.clipboard/);
  assert.match(coldCard, /העתק טלפון/);
  assert.match(coldCard, /readOnly/);
  assert.match(coldCard, /currentTarget\.select\(\)/);

  assert.match(incomingPage, /function copyPhone/);
  assert.match(incomingPage, /lead\.doNotContactAt/);
  assert.match(incomingPage, /lead\.capabilities\.canContact/);
  assert.match(incomingPage, /navigator\.clipboard/);
  assert.match(incomingPage, /העתק טלפון/);
  assert.match(incomingPage, /readOnly/);
  assert.match(incomingPage, /currentTarget\.select\(\)/);
  assert.match(incomingRoute, /doNotContactAt:\s*lead\.doNotContactAt/);
  assert.match(
    incomingRoute,
    /canContact:\s*lead\.capabilities\.canContact/,
  );
});

test("legacy cold qualification hands the exact outbound lead to agreement creation", () => {
  const coldPage = source("./LegacyColdLeadsPage.tsx");

  assert.match(
    coldPage,
    /\/seller\/agreements\/new\?leadId=\$\{encodeURIComponent\(result\.leadId\)\}/,
  );
  assert.doesNotMatch(
    coldPage,
    /router\.push\(`\/seller\/leads\?focus=\$\{result\.leadId\}`\)/,
  );
});
