import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { LeadPhoneProvenance } from "@prisma/client";

import LeadContactActions from "./LeadContactActions";

const capabilities = {
  canClaim: false,
  canPrepare: false,
  canContact: true,
  canRecordInteraction: true,
  canAddNote: true,
  canUpdateContact: true,
  canScheduleFollowUp: true,
  canCompleteFollowUp: false,
  canCreateAgreement: false,
  canReassign: false,
  canCorrectSource: false,
  canChangeCommissionCredit: false,
  canMarkLost: true,
  canMarkSpam: false,
  canReopen: false,
};

function renderPhoneSource(input: {
  phone: string | null;
  phoneSource: "CRM" | "GOOGLE" | "NONE";
  phoneProvenance: LeadPhoneProvenance | null;
}): string {
  const props = {
    ...input,
    website: null,
    mapUrl: null,
    doNotContactAt: null,
    capabilities,
  };
  return renderToStaticMarkup(
    createElement(
      LeadContactActions,
      props as Parameters<typeof LeadContactActions>[0],
    ),
  );
}

test("CRM phone provenance has a short visible Hebrew label for every persisted origin", () => {
  const cases: Array<[LeadPhoneProvenance, string]> = [
    ["FIRST_PARTY_FORM", "CRM · נמסר בטופס"],
    ["SELLER_CONFIRMED", "CRM · אומת על ידי איש מכירות"],
    ["ADMIN_CONFIRMED", "CRM · אומת על ידי אדמין"],
    ["MIGRATED", "CRM · הועבר מהמערכת הקודמת"],
  ];

  for (const [phoneProvenance, label] of cases) {
    const markup = renderPhoneSource({
      phone: "050-1234567",
      phoneSource: "CRM",
      phoneProvenance,
    });
    assert.match(markup, /מקור הטלפון/);
    assert.match(markup, new RegExp(label));
  }
});

test("live Google phone is identified as public and never presented as CRM provenance", () => {
  const markup = renderPhoneSource({
    phone: "08-1234567",
    phoneSource: "GOOGLE",
    phoneProvenance: "FIRST_PARTY_FORM",
  });

  assert.match(markup, /Google · מספר ציבורי חי/);
  assert.doesNotMatch(markup, /CRM · נמסר בטופס/);
});

test("unknown CRM provenance is honest while a missing phone has no source badge", () => {
  const unknownCrm = renderPhoneSource({
    phone: "050-1234567",
    phoneSource: "CRM",
    phoneProvenance: null,
  });
  assert.match(unknownCrm, /CRM · מקור לא מתועד/);

  const noPhone = renderPhoneSource({
    phone: null,
    phoneSource: "NONE",
    phoneProvenance: null,
  });
  assert.match(noPhone, /אין מספר מאומת/);
  assert.doesNotMatch(noPhone, /מקור הטלפון/);
});

test("the shared admin and seller workspace forwards projected phone provenance", () => {
  const workspace = readFileSync(
    new URL("./LeadWorkspace.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    workspace,
    /phoneProvenance=\{lead\.phoneProvenance\}/,
  );
});
