export const dynamic="force-dynamic";
import {NextRequest,NextResponse} from "next/server";
import {requireOwner,viewerErrorResponse} from "@/lib/auth/viewer";
import {prisma} from "@/lib/prisma";
import {refreshFinanceSource} from "@/lib/finance/provider-sync";
import {financeSourceConfiguration} from "@/lib/finance/providers";

export async function GET(){
 try{
  await requireOwner();
  const states=await prisma.financeSyncState.findMany({where:{key:{startsWith:"provider:"}}});
  const now=Date.now();
  return NextResponse.json({sources:financeSourceConfiguration().map(source=>{
   const state=states.find(s=>s.key===source.key);
   return {...source,state:state??null,stale:!state?.lastSuccessAt||now-state.lastSuccessAt.getTime()>48*3600000};
  })});
 }catch(error){return viewerErrorResponse(error)??NextResponse.json({error:"לא ניתן לקרוא את מקורות ההוצאות"},{status:500});}
}
export async function POST(request:NextRequest){
 try{
  await requireOwner();
  const body=await request.json().catch(()=>null);
  const source=financeSourceConfiguration().find(s=>s.key===body?.key);
  if(!source)return NextResponse.json({error:"מקור לא תקין"},{status:400});
  if(!source.configured)return NextResponse.json({error:"החיבור עדיין לא הוגדר; אפשר להזין חשבונית ידנית"},{status:409});
  const result=await refreshFinanceSource(source.key);
  return NextResponse.json(result,{status:result.ok?200:502});
 }catch(error){return viewerErrorResponse(error)??NextResponse.json({error:"עדכון המקור נכשל"},{status:500});}
}
