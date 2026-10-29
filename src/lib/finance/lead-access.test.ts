import assert from "node:assert/strict";
import test from "node:test";
import { financeLeadScope, requireFinanceLeadAccess } from "./lead-access";
import { buildAdminLeadWhere } from "@/lib/leads/admin-query";

test("non-owner lead scope excludes private, unassigned and mixed histories at the database", () => {
  assert.deepEqual(financeLeadScope({isOwner:false}), {agreements:{none:{financeBook:{not:"SHARED"}}}});
  assert.deepEqual(financeLeadScope({isOwner:true}), {});
  assert.deepEqual(financeLeadScope(undefined), financeLeadScope({isOwner:false}));
});
test("admin list, search and analytics filters carry the same fail-closed lead restriction", () => {
  assert.deepEqual(buildAdminLeadWhere({limit:20,search:"client"}, new Date()).agreements, {none:{financeBook:{not:"SHARED"}}});
  assert.equal(buildAdminLeadWhere({limit:20,financeOwner:true}, new Date()).agreements, undefined);
});
test("direct lead actions deny hidden identifiers before downstream mutation", async () => {
  let query: unknown;
  const db = {user:{findUnique:async()=>({role:"ADMIN",isOwner:false})},contactSubmission:{findFirst:async(input:unknown)=>{query=input;return null;}}};
  await assert.rejects(requireFinanceLeadAccess("roy","hidden",{db:db as never}), /Lead not found/);
  assert.deepEqual(query,{where:{id:"hidden",agreements:{none:{financeBook:{not:"SHARED"}}}},select:{id:true}});
});
test("persisted unauthorized roles fail before any lead identifier is queried", async () => {
  let queries=0;
  const db = {user:{findUnique:async()=>({role:"MEMBER",isOwner:false})},contactSubmission:{findFirst:async()=>{queries++;return {id:"lead"};}}};
  await assert.rejects(requireFinanceLeadAccess("member","lead",{db:db as never}), /not authorized/);
  assert.equal(queries,0);
});
