import assert from "node:assert/strict";
import test from "node:test";

import {
  contactDetailsForUpdate,
  firstAllowedAdminStageAction,
  initialLeadOutcomeFormState,
  leadContactActionState,
  leadWorkspaceTabFromQuery,
  mergeLeadQueueItems,
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
      phoneSource: "GOOGLE",
      allowPublicPhoneBeforeClaim: true,
      website: "https://example.com",
      mapUrl: "https://maps.example",
      capabilities: {
        ...capabilities,
        canClaim: true,
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

test("an eligible seller may use a public Google phone before claiming", () => {
  assert.deepEqual(
    leadContactActionState({
      doNotContactAt: null,
      phone: "08-1234567",
      phoneSource: "GOOGLE",
      allowPublicPhoneBeforeClaim: true,
      website: null,
      mapUrl: null,
      capabilities: {
        ...capabilities,
        canClaim: true,
      },
    }),
    {
      blocked: false,
      canCall: true,
      canCopyPhone: true,
      canWhatsApp: false,
      canOpenWebsite: false,
      canOpenMap: false,
      canScheduleFollowUp: false,
    },
  );
});

test("a public phone still requires claim or contact capability", () => {
  const state = leadContactActionState({
    doNotContactAt: null,
    phone: "08-1234567",
    phoneSource: "GOOGLE",
    website: null,
    mapUrl: null,
    capabilities,
  });

  assert.equal(state.canCall, false);
  assert.equal(state.canCopyPhone, false);
  assert.equal(state.canWhatsApp, false);
});

test("lead detail does not inherit cold-card phone access before ownership", () => {
  const state = leadContactActionState({
    doNotContactAt: null,
    phone: "08-1234567",
    phoneSource: "GOOGLE",
    website: null,
    mapUrl: null,
    capabilities: {
      ...capabilities,
      canClaim: true,
    },
  });

  assert.equal(state.canCall, false);
  assert.equal(state.canCopyPhone, false);
  assert.equal(state.canWhatsApp, false);
});

test("seller can confirm the unchanged projected Google phone into CRM", () => {
  assert.deepEqual(
    contactDetailsForUpdate({
      current: {
        name: "נועה",
        company: "סטודיו נועה",
        email: null,
        phone: "08-1234567",
        phoneSource: "GOOGLE",
      },
      draft: {
        name: "נועה",
        company: "סטודיו נועה",
        email: "",
        phone: "08-1234567",
      },
      confirmGooglePhone: true,
    }),
    { phone: "08-1234567" },
  );

  assert.deepEqual(
    contactDetailsForUpdate({
      current: {
        name: "נועה",
        company: "סטודיו נועה",
        email: null,
        phone: "08-1234567",
        phoneSource: "CRM",
      },
      draft: {
        name: "נועה",
        company: "סטודיו נועה",
        email: "",
        phone: "08-1234567",
      },
      confirmGooglePhone: true,
    }),
    {},
  );
});

test("a reopened outcome form starts from a fresh empty state", () => {
  const first = initialLeadOutcomeFormState();
  first.usedCallAngleIds.push("angle-1");
  first.note = "שיחה קודמת";

  assert.deepEqual(initialLeadOutcomeFormState(), {
    channel: "PHONE",
    outcome: null,
    decisionMakerReached: false,
    note: "",
    followUpAction: null,
    followUpAt: "",
    followUpIsFuture: false,
    lossReason: null,
    lossReasonDetails: "",
    usedCallAngleIds: [],
  });
});

test("loading another queue page appends new leads without duplicating rows", () => {
  assert.deepEqual(
    mergeLeadQueueItems(
      [
        { id: "lead-1", label: "first" },
        { id: "lead-2", label: "stale" },
      ],
      [
        { id: "lead-2", label: "fresh" },
        { id: "lead-3", label: "third" },
      ],
    ),
    [
      { id: "lead-1", label: "first" },
      { id: "lead-2", label: "fresh" },
      { id: "lead-3", label: "third" },
    ],
  );
});

test("admin stage controls submit only an action the current lead allows", () => {
  assert.equal(
    firstAllowedAdminStageAction({
      canMarkLost: false,
      canMarkSpam: false,
      canReopen: true,
    }),
    "reopen-lost",
  );
  assert.equal(
    firstAllowedAdminStageAction({
      canMarkLost: false,
      canMarkSpam: true,
      canReopen: false,
    }),
    "mark-spam",
  );
  assert.equal(
    firstAllowedAdminStageAction({
      canMarkLost: false,
      canMarkSpam: false,
      canReopen: false,
    }),
    null,
  );
});

test("workspace tab query accepts only known single-value tabs", () => {
  assert.equal(leadWorkspaceTabFromQuery("preparation"), "preparation");
  assert.equal(leadWorkspaceTabFromQuery("agreement"), "agreement");
  assert.equal(leadWorkspaceTabFromQuery("activity"), "activity");
  assert.equal(leadWorkspaceTabFromQuery("call"), "activity");
  assert.equal(leadWorkspaceTabFromQuery(["preparation"]), "activity");
  assert.equal(leadWorkspaceTabFromQuery(null), "activity");
});
