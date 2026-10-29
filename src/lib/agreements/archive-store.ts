import {Prisma,type PrismaClient} from '@prisma/client';
import {fromArchiveRow} from './archive-evidence';
import type {ArchiveStore,ArchiveTx} from './archive-service';

/** Only this adapter writes archive metadata and audit. No provider imports. */
export function prismaArchiveStore(client:PrismaClient,options:{legacyReadOnly?:boolean}={}):ArchiveStore {
 return {async transaction(run,readOnly=false){
  if(options.legacyReadOnly&&!readOnly)throw new Error("Legacy schema is read-only");
  for(let attempt=0;;attempt++){
   try{return await client.$transaction(async db=>{
    if(readOnly)await db.$executeRaw`SET TRANSACTION READ ONLY`;
    const tx:ArchiveTx={
     async isOwner(id){
      // Keep a concurrent owner revocation ordered with this mutation.
      if(!readOnly)await db.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${id} FOR SHARE`;
      return (await db.user.findUnique({where:{id},select:{isOwner:true}}))?.isOwner===true;
     },
     async records(ids,kind){
      if(!readOnly&&ids?.length)await db.$queryRaw(Prisma.sql`SELECT "id" FROM "Agreement" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`);
      const rows=await db.agreement.findMany({select:{id:true,customerName:true,kind:true,status:true,paymentStatus:true,createdAt:true,updatedAt:true,clientId:true,signedAt:true,signatureData:true,signedIp:true,signedUserAgent:true,paidAt:true,paidAmount:true,invoiceNumber:true,paymentId:true,paymentUrl:true,cardcomDealId:true,cardcomVerifiedLowProfileId:true,cardcomVerifiedReturnValue:true,cardcomVerifiedTransactionId:true,cardcomVerifiedAmount:true,cardcomPaymentVerifiedAt:true,cardcomToken:true,cardcomRecurringId:true,cardcomLowProfileId:true,cardcomAccountId:true,cardcomIsActive:true,cardcomNextBillDate:true,cardcomSyncedAt:true,...(options.legacyReadOnly?{}:{archivedAt:true,archiveVersion:true})},where:{...(ids?{id:{in:ids}}:{}),...(kind?{kind:kind as 'SUBSCRIPTION'|'ONE_TIME'}:{})},orderBy:{createdAt:'desc'}});
      const keys=rows.map(a=>a.id); if(!keys.length)return [];
      const [charges,receipts,products,commissions]=await Promise.all([
       db.agreementCharge.groupBy({by:['agreementId'],where:{agreementId:{in:keys}},_count:{_all:true}}),
       db.financeTransaction.groupBy({by:['agreementId'],where:{agreementId:{in:keys}},_count:{_all:true}}),
       db.clientProduct.groupBy({by:['agreementId'],where:{agreementId:{in:keys}},_count:{_all:true}}),
       db.sellerCommission.findMany({where:{OR:[{agreementId:{in:keys}},{agreementRefId:{in:keys}}]},select:{id:true,agreementId:true,agreementRefId:true}}),
      ]);
      const count=(list:Array<{agreementId:string|null;_count:{_all:number}}>,id:string)=>list.find(x=>x.agreementId===id)?._count._all??0;
      return rows.map(a=>fromArchiveRow({...a,...(options.legacyReadOnly?{archivedAt:null,archiveVersion:0}:{})},{charges:count(charges,a.id),receipts:count(receipts,a.id),products:count(products,a.id),commissions:commissions.filter(c=>c.agreementId===a.id||c.agreementRefId===a.id).length}));
     },
     async write(a,actorId,action,reason){
      const now=new Date();
      const result=await db.agreement.updateMany({where:{id:a.id,archiveVersion:a.archiveVersion,updatedAt:a.updatedAt,archivedAt:a.archivedAt},data:{archivedAt:action==='ARCHIVE'?now:null,archivedById:action==='ARCHIVE'?actorId:null,archiveReason:action==='ARCHIVE'?reason:null,archiveVersion:{increment:1}}});
      if(result.count!==1)return false;
      await db.agreementArchiveEvent.create({data:{agreementId:a.id,actorId,action,reason,occurredAt:now,version:a.archiveVersion+1}});
      return true;
     },
    };
    return run(tx);
   },{isolationLevel:readOnly?Prisma.TransactionIsolationLevel.RepeatableRead:Prisma.TransactionIsolationLevel.Serializable,timeout:30000});}
   catch(error){if(attempt>=2||!(error instanceof Prisma.PrismaClientKnownRequestError)||error.code!=='P2034')throw error;}
  }
 }};
}
