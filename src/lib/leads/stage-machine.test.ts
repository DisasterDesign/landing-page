import assert from "node:assert/strict";
import test from "node:test";
import {
  assertLeadStageTransition,
  canTransitionLeadStage,
  legacyStatusForStage,
} from "./stage-machine";

test("manual actors cannot mark a lead won", () => {
  assert.equal(
    canTransitionLeadStage("AGREEMENT_SIGNED", "WON", {
      actorType: "USER",
      actorRole: "SELLER",
      intentLevel: "OUTBOUND",
    }),
    false,
  );
  assert.throws(
    () =>
      assertLeadStageTransition("AGREEMENT_SIGNED", "WON", {
        actorType: "USER",
        actorRole: "SELLER",
        intentLevel: "OUTBOUND",
      }),
    /system-only/,
  );
});

test("payment integration may move signed or lost leads to won", () => {
  const payment = {
    actorType: "INTEGRATION" as const,
    actorRole: null,
    intentLevel: "OUTBOUND" as const,
  };
  assert.equal(canTransitionLeadStage("AGREEMENT_SIGNED", "WON", payment), true);
  assert.equal(canTransitionLeadStage("LOST", "WON", payment), true);
});

test("only an admin may reopen a lost lead", () => {
  assert.equal(
    canTransitionLeadStage("LOST", "CONTACTING", {
      actorType: "USER",
      actorRole: "SELLER",
      intentLevel: "AD_RESPONSE",
    }),
    false,
  );
  assert.equal(
    canTransitionLeadStage("LOST", "CONTACTING", {
      actorType: "USER",
      actorRole: "ADMIN",
      intentLevel: "AD_RESPONSE",
    }),
    true,
  );
});

test("new-stage transitions respect the immutable intent level", () => {
  assert.equal(
    canTransitionLeadStage("NEW", "PREPARING", {
      actorType: "USER",
      actorRole: "SELLER",
      intentLevel: "OUTBOUND",
    }),
    true,
  );
  assert.equal(
    canTransitionLeadStage("NEW", "PREPARING", {
      actorType: "USER",
      actorRole: "SELLER",
      intentLevel: "INBOUND",
    }),
    false,
  );
  assert.equal(
    canTransitionLeadStage("NEW", "CONTACTING", {
      actorType: "USER",
      actorRole: "SELLER",
      intentLevel: "INBOUND",
    }),
    true,
  );
  assert.equal(
    canTransitionLeadStage("NEW", "CONTACTING", {
      actorType: "USER",
      actorRole: "SELLER",
      intentLevel: "OUTBOUND",
    }),
    false,
  );
});

test("spam is restricted to non-outbound leads", () => {
  for (const intentLevel of ["INBOUND", "AD_RESPONSE"] as const) {
    assert.equal(
      canTransitionLeadStage("NEW", "SPAM", {
        actorType: "USER",
        actorRole: "ADMIN",
        intentLevel,
      }),
      true,
    );
  }
  assert.equal(
    canTransitionLeadStage("NEW", "SPAM", {
      actorType: "USER",
      actorRole: "ADMIN",
      intentLevel: "OUTBOUND",
    }),
    false,
  );
});

test("forward sales transitions and terminal losses follow the approved table", () => {
  const seller = {
    actorType: "USER" as const,
    actorRole: "SELLER" as const,
    intentLevel: "OUTBOUND" as const,
  };
  for (const [from, to] of [
    ["NEW", "PREPARING"],
    ["PREPARING", "CONTACTING"],
    ["CONTACTING", "QUALIFIED"],
    ["QUALIFIED", "AGREEMENT_DRAFT"],
    ["AGREEMENT_DRAFT", "AGREEMENT_SENT"],
    ["AGREEMENT_SENT", "AGREEMENT_SIGNED"],
  ] as const) {
    assert.equal(canTransitionLeadStage(from, to, seller), true, `${from} → ${to}`);
  }
  for (const from of [
    "NEW",
    "PREPARING",
    "CONTACTING",
    "QUALIFIED",
    "AGREEMENT_DRAFT",
    "AGREEMENT_SENT",
    "AGREEMENT_SIGNED",
  ] as const) {
    assert.equal(canTransitionLeadStage(from, "LOST", seller), true, `${from} → LOST`);
  }
});

test("legacy status never reports closed before payment", () => {
  assert.equal(legacyStatusForStage("NEW"), "NEW");
  assert.equal(legacyStatusForStage("QUALIFIED"), "IN_PROGRESS");
  assert.equal(legacyStatusForStage("AGREEMENT_SIGNED"), "IN_PROGRESS");
  assert.equal(legacyStatusForStage("WON"), "CLOSED");
  assert.equal(legacyStatusForStage("LOST"), "LOST");
  assert.equal(legacyStatusForStage("SPAM"), "SPAM");
});
