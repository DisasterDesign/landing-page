/** Dry run by default. --expense-map=FILE is an owner-reviewed JSON expenseId -> PRIVATE/SHARED map. */
import {readFileSync} from 'node:fs';
import type {FinanceBook} from '@prisma/client';
import {prisma} from '../src/lib/prisma';
import {parseLegacyImportManifest,planLegacyProducts} from '../src/lib/finance/legacy-import';
const apply=process.argv.includes('--apply');
async function main(){
 if(process.argv.some(a=>a.startsWith('--receipts-')))throw new Error('Receipt backfill is a separate phase: first apply reviewed classifications, then preview finance-sync-history.ts --from --to');
 const manifestPath=process.argv.find(a=>a.startsWith('--manifest='))?.slice('--manifest='.length);
 let manifestInput:unknown;
 if(manifestPath){try{manifestInput=JSON.parse(readFileSync(manifestPath,'utf8'));}catch{throw new Error('Unable to read private import manifest');}}
 const manifest=manifestPath?parseLegacyImportManifest(manifestInput):[];
 const mapPath=process.argv.find(a=>a.startsWith('--expense-map='))?.slice('--expense-map='.length);
 const reviewed:Record<string,FinanceBook>=mapPath?JSON.parse(readFileSync(mapPath,'utf8')):{};
 for(const [id,book] of Object.entries(reviewed))if(!id||!['PRIVATE','SHARED'].includes(book))throw new Error('Invalid reviewed expense map');
 const [clients,expenses,jobs]=await Promise.all([
  prisma.client.findMany({include:{products:{select:{id:true,financeBook:true,agreementId:true}},agreements:{select:{id:true,financeBook:true}}}}),
  prisma.expense.findMany({select:{id:true,financeBook:true,clientId:true,clientProductId:true,name:true}}),
  prisma.clientJob.findMany({where:{financeBook:'UNASSIGNED'},select:{id:true,clientId:true}}),
 ]);
 const clientById=new Map(clients.map(c=>[c.id,c]));
 const products=planLegacyProducts(clients,manifest);
 type Update={model:'agreement'|'clientProduct'|'clientJob'|'expense';id:string;financeBook:FinanceBook};
 const updates:Update[]=[];const unknown: {model:string;id:string;reason:string}[]=products.filter(p=>p.data.financeBook==='UNASSIGNED').map(p=>({model:'newClientProduct',id:p.data.id,reason:'Mixed or unknown legacy financial attribution'}));
 const defaultBook=(id:string|null):FinanceBook=>{const c=id?clientById.get(id):null;return c?.partner==='personal'?'PRIVATE':c?.partner==='fuzion'?'SHARED':'UNASSIGNED';};
 const mixed=(id:string)=>{const c=clientById.get(id);return new Set([...(c?.products??[]),...(c?.agreements??[])].map(r=>r.financeBook).filter(b=>b!=='UNASSIGNED')).size>1;};
 const add=(model:Update['model'],id:string,book:FinanceBook,reason:string)=>{if(book==='UNASSIGNED')unknown.push({model,id,reason});else updates.push({model,id,financeBook:book});};
 for(const c of clients){
  for(const a of c.agreements)if(a.financeBook==='UNASSIGNED')add('agreement',a.id,mixed(c.id)?'UNASSIGNED':defaultBook(c.id),'Mixed or missing explicit legacy client book');
  for(const p of c.products)if(p.financeBook==='UNASSIGNED'){
   const agreement=p.agreementId?c.agreements.find(a=>a.id===p.agreementId):null;
   const linked=agreement?.financeBook!=='UNASSIGNED'?agreement?.financeBook:undefined;
   add('clientProduct',p.id,linked??(mixed(c.id)?'UNASSIGNED':defaultBook(c.id)),'Mixed client has no exact settled agreement linkage');
  }
 }
 const productBooks=new Map(clients.flatMap(c=>c.products.map(p=>[p.id,p.financeBook]as const)));
 for(const update of updates)if(update.model==='clientProduct')productBooks.set(update.id,update.financeBook);
 for(const j of jobs)add('clientJob',j.id,mixed(j.clientId)?'UNASSIGNED':defaultBook(j.clientId),'Mixed client job needs explicit owner attribution');
 const expenseIds=new Set(expenses.map(e=>e.id));for(const id of Object.keys(reviewed))if(!expenseIds.has(id))throw new Error(`Reviewed expense ${id} is missing`);
 for(const e of expenses){
  if(e.financeBook!=='UNASSIGNED'){if(reviewed[e.id]&&reviewed[e.id]!==e.financeBook)throw new Error(`Reviewed expense ${e.id} contradicts immutable stored book`);continue;}
  const book=reviewed[e.id]??(e.clientProductId?productBooks.get(e.clientProductId)??'UNASSIGNED':e.clientId&&!mixed(e.clientId)?defaultBook(e.clientId):'UNASSIGNED');
  add('expense',e.id,book,'Unlinked or mixed expense is NOT assumed studio overhead; explicit owner-reviewed expense map required');
 }
 console.log(JSON.stringify({mode:apply?'APPLY':'DRY_RUN',products,updates,unknown,warnings:['Ambiguous account mappings require separate owner-reviewed evidence; no mapping is guessed.','Explicit foreign-currency products have null monthly ILS until explicit valuation.','Archived clients/products retain archive; no provider operations.','Unknown unlinked expenses remain owner-only. No blanket overhead promotion.']},null,2));
 if(!apply)return;
 await prisma.$transaction(async tx=>{
  for(const row of updates){const where={id:row.id,financeBook:'UNASSIGNED' as const},data={financeBook:row.financeBook};
   switch(row.model){case'agreement':await tx.agreement.updateMany({where,data});break;case'clientProduct':await tx.clientProduct.updateMany({where,data});break;case'clientJob':await tx.clientJob.updateMany({where,data});break;case'expense':await tx.expense.updateMany({where,data});break;}
  }
  for(const row of products)await tx.clientProduct.upsert({where:{id:row.data.id},create:row.data,update:{}});
 },{timeout:120000,maxWait:10000});
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
