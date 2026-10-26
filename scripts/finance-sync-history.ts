/** Provider READS only. Explicit date bounds required. Dry-run default, --apply writes only the local database. */
import {prisma} from '../src/lib/prisma';
import {syncCardcomLedger} from '../src/lib/finance/sync';
import {parseFinanceHistoryDate, type Receipt} from '../src/lib/finance/transactions';
import type {FinanceBook} from '@prisma/client';
const apply=process.argv.includes('--apply');
function dateArg(name:'from'|'to', now:Date){
 const value=process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
 if(!value)throw new Error(`--${name}=YYYY-MM-DD or full ISO timestamp is required${name==='to'?' (--to=now is supported)':''}`);
 return parseFinanceHistoryDate(value,{allowNow:name==='to',now});
}
async function main(){
 const now=new Date(),from=dateArg('from',now),to=dateArg('to',now);if(to<=from||to>now)throw new Error('Invalid history range');
 let cursor=from;const receipts:Receipt[]=[];
 while(cursor<to){const next=new Date(Math.min(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,1),to.getTime()));receipts.push(...(await syncCardcomLedger(cursor,next,{persist:false})).receipts);cursor=next;}
 const rows=[...new Map(receipts.map(r=>[JSON.stringify([r.provider,r.terminalId,r.providerTransactionId,r.kind]),r])).values()];
 console.log(JSON.stringify({mode:apply?'APPLY':'DRY_RUN',from,to,providerWrites:false,receipts:rows},null,2));
 if(!apply)return;
 await prisma.$transaction(async tx=>{
  for(const r of rows)await tx.financeTransaction.upsert({where:{provider_terminalId_providerTransactionId_kind:{provider:r.provider,terminalId:r.terminalId,providerTransactionId:r.providerTransactionId,kind:r.kind}},create:{...r,financeBook:r.financeBook as FinanceBook},update:{}});
  const previous=await tx.financeSyncState.findUnique({where:{key:'cardcom:transactions'}});
  const contiguous=previous?.coveredFrom&&previous.coveredTo&&previous.coveredTo>=from&&previous.coveredFrom<=to;
  const coveredFrom=contiguous&&previous.coveredFrom!<from?previous.coveredFrom!:from;
  const coveredTo=contiguous&&previous.coveredTo!>to?previous.coveredTo!:to;
  const data={status:'SUCCESS',lastAttemptAt:new Date(),lastSuccessAt:new Date(),coveredFrom,coveredTo,error:null};
  await tx.financeSyncState.upsert({where:{key:'cardcom:transactions'},create:{key:'cardcom:transactions',...data},update:data});
 },{timeout:120000,maxWait:10000});
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
