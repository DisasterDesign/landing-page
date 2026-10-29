/** Read-only production-compatible preview. No archive, migration or provider calls. */
import {PrismaClient} from '@prisma/client';
import {writeFile} from 'node:fs/promises';
import {privateArchiveReportPath} from '../src/lib/agreements/archive-report';
import {archiveConfig} from '../src/lib/agreements/archive-config';
import {prismaArchiveStore} from '../src/lib/agreements/archive-store';
import {previewArchive} from '../src/lib/agreements/archive-service';

async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--output')throw Error('Use --output with a private absolute path outside the repository');
 const output=await privateArchiveReportPath(args[1]);
 const policy=archiveConfig();if(!policy.ready)throw Error('Private archive policy is incomplete');
 const db=new PrismaClient();
 try{
  // Even discovery is explicitly read-only. Do not infer an owner from CLI input.
  const {owner,legacy}=await db.$transaction(async tx=>{
   await tx.$executeRaw`SET TRANSACTION READ ONLY`;
   const owners=await tx.user.findMany({where:{isOwner:true},select:{id:true}});
   if(owners.length!==1)throw Error('A unique persisted owner is required');
   const columns=await tx.$queryRaw<Array<{name:string}>>`SELECT column_name AS name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='Agreement' AND column_name='archivedAt'`;
   return {owner:owners[0],legacy:columns.length===0};
  },{isolationLevel:'RepeatableRead'});
  const store=prismaArchiveStore(db,{legacyReadOnly:legacy});
  const preview=await previewArchive(store,owner.id,undefined,'ARCHIVE',policy);
  const rows=preview.rows.map(({ticket,...row})=>{void ticket;return row;});
  const report={snapshotAt:preview.snapshotAt,before:preview.before,legacySchema:legacy,readOnly:true,total:rows.length,eligible:rows.filter(a=>a.eligible).length,rows};
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({readOnly:true,total:report.total,eligible:report.eligible,report:output}));
 }finally{await db.$disconnect();}
}
main().catch(()=>{console.error('Read-only archive preview failed. No cleanup or migration was performed.');process.exitCode=1;});
