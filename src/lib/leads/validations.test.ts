import assert from "node:assert/strict";
import test from "node:test";
import {
  createContactSchema,
  leadCompanyNoteSchema,
  leadContactCorrectionSchema,
  leadFollowUpCompleteSchema,
  leadFollowUpRescheduleSchema,
  leadFollowUpScheduleSchema,
  leadInteractionSchema,
  leadOwnershipSchema,
  leadSourceCorrectionSchema,
  leadStageCorrectionSchema,
} from "../validations";

const future = new Date(Date.now() + 60_000).toISOString();

test("interaction validation requires explicit next action for unanswered calls", () => {
  assert.equal(
    leadInteractionSchema.safeParse({
      channel: "PHONE",
      outcome: "NO_ANSWER",
      decisionMakerReached: false,
      usedCallAngleIds: [],
    }).success,
    false,
  );
  assert.equal(
    leadInteractionSchema.safeParse({
      channel: "PHONE",
      outcome: "NO_ANSWER",
      decisionMakerReached: false,
      followUpAction: "SCHEDULE",
      followUpAt: future,
      usedCallAngleIds: [],
    }).success,
    true,
  );
});

test("decision-maker outcomes and terminal outcomes enforce their invariants", () => {
  assert.equal(
    leadInteractionSchema.safeParse({
      channel: "PHONE",
      outcome: "INTERESTED",
      decisionMakerReached: false,
      usedCallAngleIds: [],
    }).success,
    false,
  );
  assert.equal(
    leadInteractionSchema.safeParse({
      channel: "PHONE",
      outcome: "NOT_INTERESTED",
      decisionMakerReached: true,
      lossReason: "NO_INTEREST",
      usedCallAngleIds: [],
    }).success,
    true,
  );
  assert.equal(
    leadInteractionSchema.safeParse({
      channel: "PHONE",
      outcome: "DO_NOT_CALL",
      decisionMakerReached: true,
      followUpAction: "SCHEDULE",
      followUpAt: future,
      usedCallAngleIds: [],
    }).success,
    false,
  );
});

test("ownership and stage requests require the audited reasoned shape", () => {
  assert.equal(
    leadOwnershipSchema.safeParse({
      action: "reassign",
      reason: "Territory handoff",
    }).success,
    false,
  );
  assert.equal(
    leadOwnershipSchema.safeParse({
      action: "reassign",
      sellerId: "seller-2",
      reason: "Territory handoff",
    }).success,
    true,
  );
  assert.equal(
    leadStageCorrectionSchema.safeParse({
      action: "reopen-lost",
    }).success,
    false,
  );
});

test("note, contact, source and follow-up schemas reject empty mutations", () => {
  assert.equal(leadCompanyNoteSchema.safeParse({ body: "  " }).success, false);
  assert.equal(leadContactCorrectionSchema.safeParse({}).success, false);
  assert.equal(
    leadSourceCorrectionSchema.safeParse({
      intentLevel: "INBOUND",
      sourceKey: "website",
      sourceSnapshot: {},
      reason: " ",
    }).success,
    false,
  );
  assert.equal(
    leadFollowUpScheduleSchema.safeParse({ dueAt: future, reason: "Call again" }).success,
    true,
  );
  assert.equal(
    leadFollowUpRescheduleSchema.safeParse({
      followUpId: "follow-up-1",
      dueAt: future,
      reason: "Customer requested later",
    }).success,
    true,
  );
  assert.equal(
    leadFollowUpCompleteSchema.safeParse({ followUpId: "follow-up-1" }).success,
    true,
  );
});

test("all mutation schemas are strict", () => {
  const parsed = leadCompanyNoteSchema.safeParse({ body: "Valid note", actorId: "spoof" });
  assert.equal(parsed.success, false);
});

test("website contact capture accepts an optional company", () => {
  const parsed = createContactSchema.safeParse({
    name: "נועה",
    company: "סטודיו נועה",
    email: "noa@example.com",
    message: "אשמח לשמוע פרטים",
  });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.company, "סטודיו נועה");
});
