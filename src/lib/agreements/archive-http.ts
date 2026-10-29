import {z} from 'zod';
import type {ArchiveConfig} from './archive-config';
import {ArchiveAccessError,executeArchive,previewArchive,type ArchiveStore} from './archive-service';
const input=z.object({action:z.enum(['ARCHIVE','RESTORE']),tickets:z.array(z.string().min(1).max(4096)).min(1).max(50),reason:z.string().trim().min(3).max(500)}).strict();
const query=z.object({kind:z.enum(['SUBSCRIPTION','ONE_TIME']).optional(),action:z.enum(['ARCHIVE','RESTORE']).optional()}).strict();
interface Dependencies {authenticate:()=>Promise<{userId:string}>;store:ArchiveStore;config:()=>ArchiveConfig}
function json(body:unknown,status=200){return Response.json(body,{status,headers:{'Cache-Control':'no-store','Vary':'Cookie'}});}
function failure(error:unknown){
 const status=error instanceof ArchiveAccessError?403:typeof error==='object'&&error&&'status'in error?Number(error.status):500;
 return json({error:status===401?'Unauthorized':status===403?'Forbidden':'לא ניתן להשלים את בדיקת הארכיון'},status===401||status===403?status:500);
}
export function archiveHandlers(deps:Dependencies){return {
 async GET(request:Request){
  try{
   const actor=await deps.authenticate();
   const parsed=query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
   if(!parsed.success)return json({error:'Invalid preview request'},400);
   return json(await previewArchive(deps.store,actor.userId,parsed.data.kind,parsed.data.action??'ARCHIVE',deps.config()));
  }catch(error){return failure(error);}
 },
 async POST(request:Request){
  try{
   const actor=await deps.authenticate();
   const parsed=input.safeParse(await request.json().catch(()=>null));
   if(!parsed.success)return json({error:'Invalid archive request'},400);
   const {action,tickets,reason}=parsed.data;
   return json({results:await executeArchive(deps.store,actor.userId,action,tickets,reason,deps.config())});
  }catch(error){return failure(error);}
 },
};}
