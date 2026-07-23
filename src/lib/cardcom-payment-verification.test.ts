import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { verifyLowProfilePayment } from "./cardcom";

const config = {
  terminal: 1000,
  apiName: "api-user",
  apiPassword: "not-sent-to-low-profile-read",
};

test("first payment truth is pulled from Cardcom and bound to the stored attempt", async () => {
  let requestPath = "";
  let requestBody: unknown;
  const result = await verifyLowProfilePayment(
    {
      lowProfileId: "lp-verified",
      agreementId: "agreement-1",
      expectedAmount: 702,
    },
    {
      config,
      request: async (path, body) => {
        requestPath = path;
        requestBody = body;
        return {
          ResponseCode: 0,
          LowProfileId: "lp-verified",
          ReturnValue: "agreement-1",
          TranzactionId: 9911,
          TokenInfo: { Token: "provider-token" },
          DocumentInfo: { DocumentNumber: 771 },
          TranzactionInfo: {
            ResponseCode: 0,
            Amount: 702,
            CreateDate: "2026-07-23T10:00:00.000Z",
          },
        };
      },
    },
  );

  assert.equal(requestPath, "/api/v11/LowProfile/GetLpResult");
  assert.deepEqual(requestBody, {
    TerminalNumber: 1000,
    ApiName: "api-user",
    LowProfileId: "lp-verified",
  });
  assert.deepEqual(result, {
    success: true,
    lowProfileId: "lp-verified",
    agreementId: "agreement-1",
    transactionId: "9911",
    amount: 702,
    token: "provider-token",
    invoiceNumber: "771",
    occurredAt: new Date("2026-07-23T10:00:00.000Z"),
  });
});

test("provider result must match agreement, attempt and expected first-charge amount", async () => {
  const providerResult = {
    ResponseCode: 0,
    LowProfileId: "lp-other",
    ReturnValue: "agreement-other",
    TranzactionId: 9911,
    TranzactionInfo: { ResponseCode: 0, Amount: 1 },
  };

  await assert.rejects(
    verifyLowProfilePayment(
      {
        lowProfileId: "lp-expected",
        agreementId: "agreement-1",
        expectedAmount: 702,
      },
      { config, request: async () => providerResult },
    ),
    /does not match/i,
  );

  await assert.rejects(
    verifyLowProfilePayment(
      {
        lowProfileId: "lp-expected",
        agreementId: "agreement-1",
        expectedAmount: 702,
      },
      {
        config,
        request: async () => ({
          ...providerResult,
          LowProfileId: "lp-expected",
          ReturnValue: "agreement-1",
          TranzactionInfo: { ResponseCode: 0, Amount: 1 },
        }),
      },
    ),
    /amount does not match/i,
  );
});

test("declines are provider-verified but never represented as successful payment", async () => {
  const result = await verifyLowProfilePayment(
    {
      lowProfileId: "lp-declined",
      agreementId: "agreement-1",
      expectedAmount: 702,
    },
    {
      config,
      request: async () => ({
        ResponseCode: 12,
        LowProfileId: "lp-declined",
        ReturnValue: "agreement-1",
        Description: "Declined",
      }),
    },
  );

  assert.equal(result.success, false);
  assert.equal(result.transactionId, null);
  assert.equal(result.amount, null);
});

test("public callback values cannot be used directly as first-payment truth", () => {
  const route = readFileSync(
    new URL("../app/api/payments/webhook/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /verifyLowProfilePayment/);
  assert.match(route, /where:\s*\{\s*paymentId:\s*lowProfileId/);
  assert.doesNotMatch(
    route,
    /agreementId\s*=\s*typeof payload\.ReturnValue/,
  );
  assert.doesNotMatch(
    route,
    /paidAmount:\s*paidAmount\s*\?\?\s*agreement\.monthlyPrice/,
  );
});
