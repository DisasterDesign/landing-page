import type {Prisma,PrismaClient} from '@prisma/client';
import {parseArchiveView} from './archive-policy';
type VisibilityDatabase=Pick<PrismaClient,'agreement'|'financeTransaction'|'clientProduct'|'sellerCommission'>;
/** List surfaces only. Never apply to finance, debtors, MCP or history readers. */
function protectedEvidenceWhere():Prisma.AgreementWhereInput {
 return {OR:[{status:'SIGNED'},{signedAt:{not:null}},{signatureData:{not:null}},{signedIp:{not:null}},{signedUserAgent:{not:null}},{paymentStatus:{not:'PENDING'}},{paidAt:{not:null}},{paidAmount:{not:null}},{invoiceNumber:{not:null}},{paymentId:{not:null}},{paymentUrl:{not:null}},{cardcomDealId:{not:null}},{cardcomVerifiedLowProfileId:{not:null}},{cardcomVerifiedReturnValue:{not:null}},{cardcomVerifiedTransactionId:{not:null}},{cardcomVerifiedAmount:{not:null}},{cardcomPaymentVerifiedAt:{not:null}},{cardcomRecurringId:{not:null}},{cardcomToken:{not:null}},{cardcomAccountId:{not:null}},{cardcomLowProfileId:{not:null}},{cardcomIsActive:{not:null}},{cardcomNextBillDate:{not:null}},{cardcomSyncedAt:{not:null}},{clientId:{not:null}},{charges:{some:{}}},{commission:{isNot:null}}]};
}
export function archiveListWhere(value:string|null,protectedIds:string[]=[]):Prisma.AgreementWhereInput {
 const view=parseArchiveView(value);
 if(view==='all')return {};
 if(view==='archived')return {archivedAt:{not:null}};
 return {OR:[{archivedAt:null},protectedEvidenceWhere(),{id:{in:protectedIds}}]};
}
/** Plain-string historical links have no Prisma relation. Preserve them too,
 * checking scope before collecting IDs so no other book's records are exposed. */
export async function archiveProtectedIds(db:VisibilityDatabase,scope:Prisma.AgreementWhereInput,ids?:string[]):Promise<string[]> {
 const rows=await db.agreement.findMany({where:{AND:[scope,...(ids?[{id:{in:ids}}]:[])]},select:{id:true}});
 const keys=rows.map(a=>a.id);if(!keys.length)return [];
 const [direct,receipts,products,commissions]=await Promise.all([
  db.agreement.findMany({where:{AND:[scope,{id:{in:keys}},protectedEvidenceWhere()]},select:{id:true}}),
  db.financeTransaction.findMany({where:{agreementId:{in:keys}},select:{agreementId:true},distinct:['agreementId']}),
  db.clientProduct.findMany({where:{agreementId:{in:keys}},select:{agreementId:true},distinct:['agreementId']}),
  db.sellerCommission.findMany({where:{OR:[{agreementId:{in:keys}},{agreementRefId:{in:keys}}]},select:{agreementId:true,agreementRefId:true}}),
 ]);
 const allowed=new Set(keys);
 return [...new Set([...direct.map(a=>a.id),...receipts.map(a=>a.agreementId),...products.map(a=>a.agreementId),...commissions.flatMap(a=>[a.agreementId,a.agreementRefId])].filter((id):id is string=>id!==null&&allowed.has(id)))];
}
export async function archiveVisibilityWhere(db:VisibilityDatabase,value:string|null,scope:Prisma.AgreementWhereInput):Promise<Prisma.AgreementWhereInput>{
 if(parseArchiveView(value)!=='active')return archiveListWhere(value);
 const archived=await db.agreement.findMany({where:{AND:[scope,{archivedAt:{not:null}}]},select:{id:true}});
 return archiveListWhere(value,await archiveProtectedIds(db,scope,archived.map(a=>a.id)));
}
