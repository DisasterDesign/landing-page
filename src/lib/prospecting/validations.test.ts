import assert from "node:assert/strict";
import test from "node:test";

import {
  createAgreementSchema,
  promoteProspectSchema,
  prospectInteractionSchema,
  prospectingSettingsSchema,
  territoryApprovalSchema,
  territoryRejectionSchema,
} from "../validations";

test("prospecting mutations accept only bounded, explicit input", () => {
  assert.equal(territoryApprovalSchema.parse({ proposalId: "proposal-1" }).proposalId, "proposal-1");
  assert.equal(
    territoryRejectionSchema.safeParse({ proposalId: "proposal-1", reason: "" }).success,
    false,
  );
  assert.equal(
    prospectInteractionSchema.safeParse({ outcome: "CALLBACK", nextFollowUpAt: "bad-date" }).success,
    false,
  );
  assert.equal(promoteProspectSchema.parse({}).email, undefined);
  assert.equal(
    prospectingSettingsSchema.safeParse({ sellerId: "seller-1", weeklyTarget: 51 }).success,
    false,
  );
});

test("agreement creation carries the originating lead id", () => {
  const parsed = createAgreementSchema.parse({
    monthlyPrice: 1_500,
    customerName: "לקוח",
    phone: "0501234567",
    email: "client@example.com",
    leadId: "lead-1",
  });

  assert.equal(parsed.leadId, "lead-1");
});
