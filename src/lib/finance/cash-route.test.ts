import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest, NextResponse } from 'next/server';
import { loadRoute } from '../payments/route-harness';
import { calculateCashSettlement } from './cash-settlement';
import { resolveCashPeriod } from './cash-period';
import type { GET as Get } from '../../app/api/finance/settlement/route';

test('HTTP settlement authenticates before reads, rejects scope spoofing, and serializes the canonical object without caching',async()=>{
 let reads=0;let authorized=true;
 const request={from:'2026-10-01',to:'2026-11-01',asOf:'2026-10-30T00:00:00Z'};
 const period=resolveCashPeriod(request,new Date('2026-10-30T01:00:00Z'));
 const canonical=calculateCashSettlement({period,isOwner:false,receipts:[],clients:[],expenses:[],advances:[],coverage:{sourceComplete:false,expensesConfirmed:false,advancesConfirmed:false}});
 class AccessError extends Error {}
 const route=loadRoute<{GET:typeof Get}>(new URL('../../app/api/finance/settlement/route.ts',import.meta.url),{
  'next/server':{NextRequest,NextResponse},
  '@/lib/auth/viewer':{requireAdmin:async()=>{if(!authorized)throw new AccessError();return {userId:'roy',isOwner:false,role:'ADMIN'};},viewerErrorResponse:(error:unknown)=>error instanceof AccessError?NextResponse.json({error:'Unauthorized'},{status:401}):null},
  '@/lib/finance/cash-data':{CashAccessError:AccessError,buildCashSettlement:async(_v:unknown,p:unknown)=>{reads++;assert.deepEqual(p,request);return canonical;}},
 });
 const url='https://app.example.invalid/api/finance/settlement?'+new URLSearchParams(request);
 authorized=false;assert.equal((await route.GET(new NextRequest(url))).status,401);assert.equal(reads,0);
 authorized=true;assert.equal((await route.GET(new NextRequest(url+'&isOwner=true'))).status,400);assert.equal(reads,0);
 const response=await route.GET(new NextRequest(url));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.deepEqual(await response.json(),canonical);assert.equal(reads,1);
});
