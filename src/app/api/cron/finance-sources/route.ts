export const dynamic="force-dynamic";
export const maxDuration=300;
import {NextRequest,NextResponse} from "next/server";
import {isCronAuthorized} from "@/lib/cron-auth";
import {financeSourceConfiguration} from "@/lib/finance/providers";
import {refreshFinanceSource} from "@/lib/finance/provider-sync";
export async function GET(request:NextRequest){
 if(!isCronAuthorized(request))return NextResponse.json({error:"Forbidden"},{status:403});
 const results=[];
 for(const source of financeSourceConfiguration().filter(s=>s.configured)){
  try{results.push({key:source.key,...await refreshFinanceSource(source.key)});}
  catch{results.push({key:source.key,ok:false,error:"Supplier refresh failed"});}
 }
 return NextResponse.json({results},{status:results.some(r=>!r.ok)?502:200});
}
