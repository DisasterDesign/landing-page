import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  agreementLeadPrefill,
  parseAgreementPageQuery,
} from "./admin-agreement-ui";

test("parses canonical lead creation and agreement focus query parameters", () => {
  const query = new URLSearchParams({
    new: "1",
    leadId: "lead-123",
    focus: "agreement-456",
  });

  assert.deepEqual(parseAgreementPageQuery(query), {
    leadId: "lead-123",
    focusAgreementId: "agreement-456",
  });
});

test("ignores leadId unless the create intent is explicit", () => {
  const query = new URLSearchParams({
    leadId: "lead-123",
    focus: "agreement-456",
  });

  assert.deepEqual(parseAgreementPageQuery(query), {
    leadId: null,
    focusAgreementId: "agreement-456",
  });
});

test("prefills a contract with CRM contact data only", () => {
  assert.deepEqual(
    agreementLeadPrefill({
      name: "רונית",
      company: "הסטודיו של רונית",
      email: "ronit@example.com",
      phone: "050-1234567",
      phoneSource: "CRM",
    }),
    {
      customerName: "רונית",
      businessName: "הסטודיו של רונית",
      email: "ronit@example.com",
      phone: "050-1234567",
    },
  );

  assert.equal(
    agreementLeadPrefill({
      name: "רונית",
      company: "הסטודיו של רונית",
      email: "ronit@example.com",
      phone: "08-1234567",
      phoneSource: "GOOGLE",
    }).phone,
    "",
  );
});

test("admin agreement history is cancelled with a reason and never deleted", () => {
  const page = readFileSync(
    new URL("../../app/admin/(dashboard)/agreements/page.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(page, /method:\s*"DELETE"/);
  assert.doesNotMatch(page, />\s*מחק\s*</);
  assert.match(page, /status:\s*"CANCELLED"/);
  assert.match(page, /cancelReason/);
});
