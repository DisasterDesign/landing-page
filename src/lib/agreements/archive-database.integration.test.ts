import assert from 'node:assert/strict';
import test from 'node:test';
import {Prisma,PrismaClient} from '@prisma/client';
import {prismaArchiveStore} from './archive-store';
import {previewArchive,executeArchive} from './archive-service';
import {archiveListWhere,archiveVisibilityWhere,archiveProtectedIds} from './archive-visibility';
import {financeAgreementScope,redactFinanceAgreement} from '../finance/access';
import {archiveHandlers} from './archive-http';
const database=process.env.ARCHIVE_TEST_DATABASE_URL;
const allowed=!!database&&/^postgresql:\/\/[^/]*@127\.0\.0\.1:55983\/fuzion_archive_synthetic$/.test(database);
const config={ready:true,protectedIds:['synthetic-exception'],before:new Date('2026-10-01Z'),secret:'synthetic-secret-longer-than-thirty-two-characters',version:'v1'};
test('real PostgreSQL: archive guards, scoped views, audit rollback, owner revocation and concurrent signing/payment', {skip:!allowed},async()=>{
 const db=new PrismaClient({datasources:{db:{url:database!}}});
 const prefix='archive-test-'+Date.now();
 const owner=await db.user.create({data:{email:prefix+'@invalid.example',name:'Synthetic owner',passwordHash:'not-a-password',role:'ADMIN',isOwner:true}});
 const ids:string[]=[];
 let productClientId:string|undefined;
 async function make(extra:Prisma.AgreementUncheckedCreateInput extends infer T?Partial<T>:never={}){
  const a=await db.agreement.create({data:{customerName:'Synthetic customer',phone:'000',email:'synthetic@invalid.example',content:'Synthetic agreement',createdBy:owner.id,createdAt:new Date('2026-01-01Z'),financeBook:'SHARED',monthlyPrice:99,...extra}});ids.push(a.id);return a;
 }
 const store=prismaArchiveStore(db);
 try{
  const eligible=await make(),cancelled=await make({status:'CANCELLED'}),signed=await make({status:'CANCELLED',signedAt:new Date(),signatureData:'synthetic signature'}),paid=await make({paidAmount:1}),processing=await make({paymentStatus:'SENT'}),active=await make({cardcomRecurringId:123,cardcomIsActive:true}),privateRow=await make({financeBook:'PRIVATE'}),charged=await make(),receipt=await make(),commission=await make();
  await db.agreementCharge.create({data:{agreementId:charged.id,amount:1,success:false}});
  await db.financeTransaction.create({data:{agreementId:receipt.id,provider:'SYNTHETIC',terminalId:prefix,providerTransactionId:prefix,amountMinor:1,currency:'ILS',occurredAt:new Date()}});
  await db.sellerCommission.create({data:{sellerId:owner.id,agreementId:'legacy-'+prefix,agreementRefId:commission.id,clientName:'Synthetic',amount:1}});
  const productClient=await db.client.create({data:{name:'Synthetic product client'}});productClientId=productClient.id;
  const product=await make();await db.clientProduct.create({data:{clientId:productClient.id,name:'Synthetic archived product',agreementId:product.id,archivedAt:new Date()}});
  const preview=await previewArchive(store,owner.id,undefined,'ARCHIVE',config);
  const candidate=(id:string)=>preview.rows.find(a=>a.id===id)!;
  for(const a of [signed,paid,processing,active,charged,receipt,commission,product])assert.equal(candidate(a.id).eligible,false,a.id);
  assert.equal(candidate(cancelled.id).eligible,true);
  const except=await previewArchive(store,owner.id,undefined,'ARCHIVE',{...config,protectedIds:[eligible.id]});
  assert.ok(except.rows.find(a=>a.id===eligible.id)!.reasons.includes('PROTECTED'));
  const original=await db.agreement.findUniqueOrThrow({where:{id:eligible.id}});
  const financeBefore={charges:await db.agreementCharge.count(),receipts:await db.financeTransaction.count(),commissions:await db.sellerCommission.count(),clients:await db.client.count()};
  const result=await executeArchive(store,owner.id,'ARCHIVE',[candidate(eligible.id).ticket!,candidate(cancelled.id).ticket!],'Synthetic cleanup',config);
  assert.deepEqual(result.map(a=>a.status),['success','success']);
  assert.equal((await executeArchive(store,owner.id,'ARCHIVE',[candidate(eligible.id).ticket!],'Synthetic repeat',config))[0].status,'skipped');
  const archived=await db.agreement.findUniqueOrThrow({where:{id:eligible.id}});
  const withoutMeta=({archivedAt,archivedById,archiveReason,archiveVersion,updatedAt,...r}:typeof archived)=>{void archivedAt;void archivedById;void archiveReason;void archiveVersion;void updatedAt;return r;};
  assert.deepEqual(withoutMeta(archived),withoutMeta(original));
  assert.equal(await db.agreementArchiveEvent.count({where:{agreementId:eligible.id}}),1);
  const visible=await db.agreement.findMany({where:{id:{in:ids},...archiveListWhere(null)}});
  assert.equal(visible.some(a=>a.id===eligible.id),false);
  const roy={userId:'synthetic-partner',isOwner:false,role:'ADMIN' as const,revenueSharePct:50};
  const scoped=await db.agreement.findMany({where:{AND:[{id:{in:ids}},archiveListWhere('all'),financeAgreementScope(roy)]}});
  assert.equal(scoped.some(a=>a.id===privateRow.id),false);
  const safe=redactFinanceAgreement(roy,{...archived});assert.equal('archiveReason'in safe,false);assert.equal('archivedById'in safe,false);
  await db.agreement.update({where:{id:eligible.id},data:{paidAt:new Date(),paidAmount:118,paymentStatus:'COMPLETED'}});
  assert.equal((await db.agreement.findMany({where:{id:eligible.id,...archiveListWhere(null)}})).length,1);
  const restore=await previewArchive(store,owner.id,undefined,'RESTORE',config),rt=restore.rows.find(a=>a.id===eligible.id)!.ticket!;
  assert.equal((await executeArchive(store,owner.id,'RESTORE',[rt],'Synthetic restore',config))[0].status,'success');
  assert.equal((await executeArchive(store,owner.id,'RESTORE',[rt],'Synthetic restore',config))[0].status,'skipped');
  assert.equal((await db.agreement.findUniqueOrThrow({where:{id:eligible.id}})).paymentStatus,'COMPLETED');
  assert.deepEqual(financeBefore,{charges:await db.agreementCharge.count(),receipts:await db.financeTransaction.count(),commissions:await db.sellerCommission.count(),clients:await db.client.count()});
  // A failure after the metadata UPDATE must roll back both it and its audit.
  const rollback=await make();
  await assert.rejects(()=>db.$transaction(async tx=>{await tx.agreement.update({where:{id:rollback.id},data:{archivedAt:new Date()}});await tx.agreementArchiveEvent.create({data:{agreementId:rollback.id,actorId:'missing-actor',action:'ARCHIVE',reason:'synthetic',version:1}});}));
  assert.equal((await db.agreement.findUniqueOrThrow({where:{id:rollback.id}})).archivedAt,null);
  for(const patch of [{signedAt:new Date(),signatureData:'synthetic late signature',status:'SIGNED' as const},{paidAt:new Date(),paidAmount:1,paymentStatus:'COMPLETED' as const}]){
   const raced=await make();const p=await previewArchive(store,owner.id,undefined,'ARCHIVE',config),ticket=p.rows.find(a=>a.id===raced.id)!.ticket!;
   let ready!:()=>void,release!:()=>void;const locked=new Promise<void>(r=>ready=r),unblock=new Promise<void>(r=>release=r);
   const writer=db.$transaction(async tx=>{await tx.$queryRaw`SELECT "id" FROM "Agreement" WHERE "id"=${raced.id} FOR UPDATE`;ready();await unblock;await tx.agreement.update({where:{id:raced.id},data:patch});},{isolationLevel:'Serializable'});
   await locked;const cleanup=executeArchive(store,owner.id,'ARCHIVE',[ticket],'Synthetic race',config);release();await writer;
   assert.equal((await cleanup)[0].status,'skipped');assert.equal((await db.agreement.findUniqueOrThrow({where:{id:raced.id}})).archivedAt,null);
  }
  // Every late dependency must survive the working-list projection, including
  // cancelled quotes' separate client-side filter protection flag.
  const lateRows=[];
  for(const name of ['receipt','product','legacyCommission','client','signedIp','signedUserAgent']){
   const late=await make({kind:'ONE_TIME',status:'CANCELLED'});
   const before=await previewArchive(store,owner.id,undefined,'ARCHIVE',config);
   await executeArchive(store,owner.id,'ARCHIVE',[before.rows.find(x=>x.id===late.id)!.ticket!],'Synthetic late link',config);
   if(name==='receipt')await db.financeTransaction.create({data:{agreementId:late.id,provider:'SYNTHETIC',terminalId:prefix,providerTransactionId:prefix+name,amountMinor:1,currency:'ILS',occurredAt:new Date()}});
   if(name==='product')await db.clientProduct.create({data:{clientId:productClient.id,name:'Synthetic late archived product',agreementId:late.id,archivedAt:new Date()}});
   if(name==='legacyCommission')await db.sellerCommission.create({data:{sellerId:owner.id,agreementId:late.id,clientName:'Synthetic legacy',amount:1}});
   if(name==='client')await db.agreement.update({where:{id:late.id},data:{clientId:productClient.id}});
   if(name==='signedIp'||name==='signedUserAgent')await db.agreement.update({where:{id:late.id},data:{[name]:'synthetic legal trace'}});
   assert.equal((await db.agreement.findMany({where:{id:late.id,...await archiveVisibilityWhere(db,null,{})}})).length,1,name);
   assert.ok((await archiveProtectedIds(db,{},[late.id])).includes(late.id),name);
   lateRows.push(late.id);
  }
  const h=archiveHandlers({authenticate:async()=>({userId:owner.id}),store,config:()=>config});
  await db.user.update({where:{id:owner.id},data:{isOwner:false}});
  assert.equal((await h.GET(new Request('https://synthetic.invalid'))).status,403);
  assert.equal((await h.POST(new Request('https://synthetic.invalid',{method:'POST',body:JSON.stringify({action:'ARCHIVE',tickets:[candidate(privateRow.id).ticket!],reason:'Synthetic revoked'})}))).status,403);
  await db.agreement.updateMany({where:{id:{in:lateRows}},data:{clientId:null}});
  await db.clientProduct.deleteMany({where:{clientId:productClient.id}});await db.client.delete({where:{id:productClient.id}});
 }finally{
  if(productClientId)await db.clientProduct.deleteMany({where:{clientId:productClientId}});
  await db.agreementArchiveEvent.deleteMany({where:{agreementId:{in:ids}}});
  await db.sellerCommission.deleteMany({where:{sellerId:owner.id}});await db.financeTransaction.deleteMany({where:{terminalId:prefix}});await db.agreementCharge.deleteMany({where:{agreementId:{in:ids}}});await db.agreement.deleteMany({where:{id:{in:ids}}});if(productClientId)await db.client.deleteMany({where:{id:productClientId}});await db.user.delete({where:{id:owner.id}});await db.$disconnect();
 }
});
