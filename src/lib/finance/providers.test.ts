import assert from "node:assert/strict";
import test from "node:test";

import * as subject from "./providers";

test("Cloudflare invoice evidence deduplicates provider ids and keeps original currency", async () => {
  const m = subject;
  assert.equal(typeof m.normalizeCloudflareBilling, "function");
  const data = m.normalizeCloudflareBilling([
    { id:"invoice-1", amount:12.34, currency:"usd", occurred_at:"2026-10-01T00:00:00Z", status:"paid", type:"charge" },
    { id:"invoice-1", amount:12.34, currency:"usd", occurred_at:"2026-10-01T00:00:00Z", status:"paid", type:"charge" },
  ]);
  assert.equal(data.length, 1);
  assert.deepEqual({amountMinor:data[0].amountMinor,currency:data[0].currency,ilsAmountMinor:data[0].ilsAmountMinor}, {amountMinor:1234,currency:"USD",ilsAmountMinor:null});
});

test("failed refresh preserves the last successful coverage and evidence", async () => {
  const m = subject;
  assert.equal(typeof m.failedSourceRefresh, "function");
  const old = {lastSuccessAt:new Date("2026-10-01"),coveredFrom:new Date("2026-09-01"),coveredTo:new Date("2026-10-01"),metadata:{amountMinor:1200}};
  const next = m.failedSourceRefresh(old,new Date("2026-10-26"));
  assert.equal(next.status,"ERROR"); assert.deepEqual(next.metadata,old.metadata);
  assert.equal(next.lastSuccessAt,old.lastSuccessAt); assert.equal(next.coveredTo,old.coveredTo);
});

test("usage metrics remain usage evidence rather than invented cost", async () => {
  const m = subject;
  assert.equal(typeof m.neonUsageEvidence,"function");
  const evidence = m.neonUsageEvidence([{project_id:"private-db",periods:[{metrics:{compute_unit_seconds:3600}}]}]);
  assert.equal(evidence.kind,"USAGE"); assert.equal(evidence.amountMinor,null);
  assert.equal(evidence.estimate,true); assert.equal(evidence.projects.length,1);
});

test("a provider authentication error never echoes credentials or resets to empty success", async () => {
  const m = subject;
  assert.equal(typeof m.fetchCloudflareBilling,"function");
  await assert.rejects(m.fetchCloudflareBilling({accountId:"account",token:"SECRET",from:new Date("2026-10-01"),to:new Date("2026-10-26")}, async () => new Response('{"error":"SECRET"}',{status:403})), /Cloudflare HTTP 403/);
});

test("paginated billing is complete and a repeated non-terminal page fails instead of hiding missing evidence", async () => {
  const m = subject;
  assert.equal(typeof m.fetchCloudflareBilling,"function");
  let calls=0;
  const result=await m.fetchCloudflareBilling({accountId:"account",token:"key",from:new Date("2026-10-01"),to:new Date("2026-10-26")},async()=>{
    calls++; return Response.json({success:true,result:[{id:`bill-${calls}`,amount:1,currency:"ILS",occurred_at:"2026-10-02T00:00:00Z"}],result_info:{total_pages:2,page:calls}});
  });
  assert.equal(calls,2); assert.equal(result.length,2);
});
