import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRoute } from '../payments/route-harness';
import * as math from '../finance/report';
import * as money from '../finance';
import * as access from '../finance/access';
import * as transactions from '../finance/transactions';
import * as dismissal from '../debtor-dismissal';
import type { Viewer } from '../auth/viewer';
import type { buildFinanceReport as Report } from '../finance/report-data';
import type { loadReceipts as Receipts, receiptTotals as Totals } from '../finance/receipts';
import type { loadDebtorsReport as Debtors } from '../finance/debtors-report';
import type * as Data from './data';

// Minimal synthetic relational reader. Any mutation, transaction, provider I/O or
// unknown dependency is an immediate test failure; it cannot reach a real DB.
function matches(row:Record<string,unknown>,where:Record<string,unknown>={}):boolean{
 return Object.entries(where).every(([k,v])=>{
  if(k==='AND')return (v as Record<string,unknown>[]).every(w=>matches(row,w));
  if(k==='OR')return (v as Record<string,unknown>[]).some(w=>matches(row,w));
  const a=row[k];if(v===null||typeof v!=='object'||v instanceof Date)return a===v;
  const b=v as Record<string,unknown>;
  if('some'in b)return (a as Record<string,unknown>[]??[]).some(r=>matches(r,b.some as Record<string,unknown>));
  if('in'in b)return (b.in as unknown[]).includes(a);
  if('contains'in b)return String(a).toLowerCase().includes(String(b.contains).toLowerCase());
  for(const op of ['gte','gt','lte','lt'])if(op in b){const x=a instanceof Date?a.getTime():Number(a),y=b[op] instanceof Date?(b[op] as Date).getTime():Number(b[op]);return op==='gte'?x>=y:op==='gt'?x>y:op==='lte'?x<=y:x<y;}
  return a!==null&&typeof a==='object'&&matches(a as Record<string,unknown>,b);
 });
}
function fixture(){
 const now=new Date();const at=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),2));
 const product=(book:string,amount:number)=>({id:book,name:book==='PRIVATE'?'PRIVATE_PRODUCT_SECRET':'Shared site',financeBook:book,monthlyAmount:amount,status:'בוצע',archivedAt:null});
 const mixed={id:'mixed',name:'Mixed client',status:'בוצע',archivedAt:null,partner:'personal',monthlyAmount:99999,vatExempt:false,products:[product('SHARED',118),product('PRIVATE',1180)],agreements:[],_count:{products:2}};
 const receipt=(id:string,book:string,amount:number,date=at)=>({id,provider:'CARDCOM',terminalId:'legacy',providerTransactionId:id,kind:amount<0?'REFUND':'CHARGE',amountMinor:amount,ilsAmountMinor:amount,currency:'ILS',occurredAt:date,financeBook:book,clientId:'mixed'});
 const open={name:'Visible debtor',idNumber:'visible',amount:100,attempts:2,lastAttempt:at.toISOString(),responseCode:4,reason:'PAYMENT_IDENTIFIER_SECRET'};
 const snapshot={visible:open,hidden:{...open,idNumber:'hidden',name:'Hidden debtor',amount:50},paid:{...open,idNumber:'paid',name:'Paid debtor',amount:20,settledAt:now.toISOString()}};
 const tables:Record<string,Record<string,unknown>[]>= {
  client:[mixed,{...mixed,id:'private-only',name:'PRIVATE_CLIENT_SECRET',products:[product('PRIVATE',10000)],_count:{products:1}}],
  expense:[],clientJob:[],agreement:[{id:'inactive',cardcomIsActive:false,financeBook:'SHARED',kind:'SUBSCRIPTION',client:{archivedAt:null,name:'Inactive shared'},monthlyPrice:100,cardcomSyncedAt:at}],agreementCharge:[],financeExpensePayment:[],user:[],
  financeTransaction:[receipt('shared','SHARED',11800),receipt('refund','SHARED',-1180),receipt('private','PRIVATE',118000),receipt('future','SHARED',500000,new Date('2099-01-01'))],
  financeSyncState:[{key:'cardcom:transactions',status:'OK',lastSuccessAt:now}],
  keyValue:[{key:'cardcom_debtors_snapshot',value:snapshot,updatedAt:new Date(0)},{key:'cardcom_debtors_dismissed',value:{hidden:{name:'Hidden debtor',dismissedAt:'2026-01-01'},old:{name:'Historical hidden',dismissedAt:'2020-01-01'}}}],
 };
 let reads=0;
 function project(row:Record<string,unknown>,args:Record<string,unknown>){
  const result={...row};
  const shape={...(args.include as object??{}),...(args.select as object??{})};
  for(const [key,v]of Object.entries(shape))if(v&&typeof v==='object'&&Array.isArray(row[key]))result[key]=query(row[key] as Record<string,unknown>[],v as Record<string,unknown>);
  return result;
 }
 function query(rows:Record<string,unknown>[],args:Record<string,unknown>){return rows.filter(r=>matches(r,args.where as Record<string,unknown>)).slice(0,args.take as number|undefined).map(r=>project(r,args));}
 const db=new Proxy({}, {get(_t,model:string){if(!(model in tables))throw Error(`Forbidden DB action ${model}`);return new Proxy({}, {get(_t,method:string){if(!['findMany','findUnique'].includes(method))throw Error(`Mutation forbidden ${method}`);return async(args:Record<string,unknown>)=>{reads++;const rows=query(tables[model],args);return method==='findUnique'?rows[0]??null:rows;};}});}});
 const receipts=loadRoute<{loadReceipts:typeof Receipts;receiptTotals:typeof Totals}>(new URL('../finance/receipts.ts',import.meta.url),{'@/lib/prisma':{prisma:db},'@/lib/cardcom':{getCardcomConfig:()=>null},'@/lib/finance':money,'./transactions':transactions,'./report':math});
 const report=loadRoute<{buildFinanceReport:typeof Report}>(new URL('../finance/report-data.ts',import.meta.url),{'@/lib/prisma':{prisma:db},'@/lib/auth/viewer':{ViewerAuthorizationError:Error},'./access':access,'@/lib/finance':money,'./report':math,'./receipts':receipts});
 const debtors=loadRoute<{loadDebtorsReport:typeof Debtors}>(new URL('../finance/debtors-report.ts',import.meta.url),{'@/lib/prisma':{prisma:db},'@/lib/debtor-dismissal':dismissal});
 const data=loadRoute<typeof Data>(new URL('./data.ts',import.meta.url),{'@/lib/prisma':{prisma:db},'@/lib/finance/report-data':report,'@/lib/finance/access':access,'@/lib/finance/debtors-report':debtors,'@/lib/debtor-dismissal':dismissal});
 return {data,report,receipts,reads:()=>reads,at,tables};
}
const owner:Viewer={userId:'elad',isOwner:true,role:'ADMIN',revenueSharePct:null};const roy:Viewer={...owner,userId:'roy',isOwner:false};
test('MCP cash/run-rate matches actual app report for owner and Roy; refunds, periods, private scope and no side effects',async()=>{
 const f=fixture();
 for(const viewer of [owner,roy]){
  const from=new Date(Date.UTC(f.at.getUTCFullYear(),f.at.getUTCMonth(),1));const to=new Date(Date.UTC(f.at.getUTCFullYear(),f.at.getUTCMonth()+1,1));
  const input={from:from.toISOString().slice(0,10),to:to.toISOString().slice(0,10)};
  const direct=await f.report.buildFinanceReport(viewer,viewer.isOwner?'combined':'fuzion',{from,to});
  const mcp=await f.data.financeSummary(viewer,input);
  assert.deepEqual(mcp.collectedCash,{...direct.actual,allocationAfterRecordedExpenses:direct.actualAllocation});
  assert.deepEqual(mcp.recurringMonthly.books,direct.books);assert.equal(mcp.forecast.myShare,direct.myProfit);
  assert.equal(mcp.collectedCash.gross,viewer.isOwner?1286.2:106.2);
  if(!viewer.isOwner){assert.equal('personal'in mcp.recurringMonthly.books,false);assert.equal(JSON.stringify(mcp).includes('PRIVATE_'),false);assert.equal('privateProfit'in mcp.forecast,false);}
 }
 const empty=await f.data.financeSummary(roy,{from:'2000-01-01',to:'2000-02-01'});assert.equal(empty.collectedCash.gross,0);
});
test('search filters before limiting and never returns private children, notes, identities or payment identifiers',async()=>{
 const f=fixture();const rows=await f.data.searchClients(roy,{query:'client',limit:1});
 assert.equal(rows.clients.length,1);assert.equal(rows.truncated,false);assert.equal(rows.clients[0].products.length,1);
 assert.equal(rows.clients[0].products[0].monthlyGross,118);assert.equal(JSON.stringify(rows).includes('PRIVATE'),false);
 assert.deepEqual((await f.data.searchClients(roy,{query:'PRIVATE_CLIENT_SECRET',limit:5})).clients,[]);
 assert.equal((await f.data.searchClients(owner,{query:'client',limit:1})).truncated,true);
});
test('debtors reuse original partition including historical hidden, stale amounts unknown, no IDs, counts owner-only',async()=>{
 const f=fixture();const before=f.reads();await assert.rejects(()=>f.data.debtorsReport(roy,{limit:10}));assert.equal(f.reads(),before);
 const result=await f.data.debtorsReport(owner,{limit:1});
 assert.equal(result.visible.knownOpenAmount,100);assert.equal(result.hidden.knownOpenAmount,50);assert.equal(result.hidden.count,2);assert.equal(result.hidden.unknownAmountCount,1);assert.equal(result.hidden.truncated,true);assert.equal(result.stale,true);assert.equal(result.inactiveOrders.count,1);assert.equal(result.inactiveOrders.rows[0].name,'Inactive shared');
 const full=await f.data.debtorsReport(owner,{limit:20});assert.equal(full.hidden.rows[1].amount,null);assert.equal(full.settled.knownOpenAmount,0);
 for(const secret of ['IDENTITY_SECRET','PAYMENT_IDENTIFIER_SECRET','idNumber','invoiceNumber','key'])assert.equal(JSON.stringify(full).includes(secret),false);
});

test('debtor display names cannot reveal upstream identity/transaction fallback keys',async()=>{
 const f=fixture();f.tables.keyValue[0].value={payer:{name:'123456789',idNumber:'123456789',amount:1,lastAttempt:new Date().toISOString()},fallback:{name:'tx-12345',idNumber:null,amount:2,lastAttempt:new Date().toISOString()}};
 f.tables.keyValue[1].value={old:{name:'987654321',dismissedAt:'2020-01-01'}};
 const value=await f.data.debtorsReport(owner,{limit:20});
 for(const key of ['123456789','tx-12345','987654321'])assert.equal(JSON.stringify(value).includes(key),false);
 assert.ok(value.visible.rows.every(d=>d.name==='Unnamed debtor'));assert.equal(value.hidden.rows[0].name,'Unnamed debtor');
});
