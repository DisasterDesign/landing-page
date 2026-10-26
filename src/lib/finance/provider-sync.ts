import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/prisma";
import {financeSourceConfiguration,fetchCloudflareBilling,fetchNeonConsumption,failedSourceRefresh} from "./providers";
/** Server-only read of supplier evidence. Allocation is a separate owner action. */
export async function refreshFinanceSource(key:string){
 const source=financeSourceConfiguration().find(s=>s.key===key&&s.configured);
 if(!source)throw new Error("Finance source is not configured");
  const now=new Date();const from=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));
  const old=await prisma.financeSyncState.findUnique({where:{key:source.key}});
  try{
   const metadata=source.key==="provider:cloudflare"
    ?{kind:"BILLING_HISTORY",invoices:await fetchCloudflareBilling({accountId:process.env.CLOUDFLARE_FINANCE_ACCOUNT_ID!,token:process.env.CLOUDFLARE_FINANCE_API_TOKEN!,from,to:now}),costsAllocated:false}
    :await fetchNeonConsumption({orgId:process.env.NEON_FINANCE_ORG_ID!,token:process.env.NEON_FINANCE_API_KEY!,from,to:now});
   await prisma.financeSyncState.upsert({where:{key:source.key},create:{key:source.key,status:"SUCCESS",lastAttemptAt:now,lastSuccessAt:now,coveredFrom:from,coveredTo:now,metadata:metadata as Prisma.InputJsonValue},update:{status:"SUCCESS",lastAttemptAt:now,lastSuccessAt:now,coveredFrom:from,coveredTo:now,error:null,metadata:metadata as Prisma.InputJsonValue}});
   return {ok:true as const};
  }catch{
   const preserved=failedSourceRefresh(old??{},now);
   // Updating only attempt/error keeps the old successful evidence and coverage intact.
   await prisma.financeSyncState.upsert({where:{key:source.key},create:{key:source.key,status:preserved.status,lastAttemptAt:now,error:preserved.error},update:{status:preserved.status,lastAttemptAt:now,error:preserved.error}});
   return {ok:false as const,error:preserved.error};
  }
}
