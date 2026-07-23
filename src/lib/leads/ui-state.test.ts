import assert from "node:assert/strict";
import test from "node:test";

import {
  leadContactActionState,
  primaryLeadAction,
  type LeadUiStateInput,
} from "./ui-state";

const capabilities = {
  canClaim: false,
  canPrepare: false,
  canContact: false,
  canRecordInteraction: false,
  canAddNote: false,
  canUpdateContact: false,
  canScheduleFollowUp: false,
  canCompleteFollowUp: false,
  canCreateAgreement: false,
  canReassign: false,
  canCorrectSource: false,
  canChangeCommissionCredit: false,
  canMarkLost: false,
  canMarkSpam: false,
  canReopen: false,
};

function state(overrides: Partial<LeadUiStateInput>): LeadUiStateInput {
  return {
    intentLevel: "OUTBOUND",
    stage: "NEW",
    nextAction: { kind: "NONE" },
    capabilities,
    ...overrides,
  };
}

test("one primary action follows the approved seller journey", () => {
  assert.equal(
    primaryLeadAction(
      state({
        capabilities: { ...capabilities, canClaim: true },
      }),
    ),
    "START_PREPARATION",
  );
  assert.equal(
    primaryLeadAction(
      state({
        intentLevel: "INBOUND",
        capabilities: { ...capabilities, canClaim: true },
      }),
    ),
    "CLAIM_AND_CALL",
  );
  assert.equal(
    primaryLeadAction(
      state({
        stage: "PREPARING",
        capabilities: {
          ...capabilities,
          canPrepare: true,
          canContact: true,
          canRecordInteraction: true,
        },
      }),
    ),
    "CALL",
  );
  assert.equal(
    primaryLeadAction(
      state({
        stage: "QUALIFIED",
        capabilities: { ...capabilities, canCreateAgreement: true },
      }),
    ),
    "CREATE_AGREEMENT",
  );
  assert.equal(
    primaryLeadAction(state({ stage: "WON" })),
    "NONE",
  );
});

test("an active or failed agreement has one agreement action", () => {
  assert.equal(
    primaryLeadAction(
      state({
        stage: "AGREEMENT_SIGNED",
        nextAction: {
          kind: "RECOVER_FIRST_PAYMENT",
          agreementId: "agreement-1",
        },
      }),
    ),
    "VIEW_AGREEMENT",
  );
  assert.equal(
    primaryLeadAction(
      state({
        stage: "AGREEMENT_DRAFT",
        nextAction: {
          kind: "VIEW_AGREEMENT",
          agreementId: "agreement-1",
          status: "DRAFT",
        },
      }),
    ),
    "VIEW_AGREEMENT",
  );
});

test("do-not-contact removes call, copy, WhatsApp and follow-up controls", () => {
  assert.deepEqual(
    leadContactActionState({
      doNotContactAt: "2026-07-23T10:00:00.000Z",
      phone: "0501234567",
      website: "https://example.com",
      mapUrl: "https://maps.example",
      capabilities: {
        ...capabilities,
        canContact: true,
        canScheduleFollowUp: true,
      },
    }),
    {
      blocked: true,
      canCall: false,
      canCopyPhone: false,
      canWhatsApp: false,
      canOpenWebsite: true,
      canOpenMap: true,
      canScheduleFollowUp: false,
    },
  );
});
