import {createHash} from 'node:crypto';
import type {ArchiveConfig} from './archive-config';
import {classifyArchive, type ArchiveAction, type ArchiveRecord} from './archive-policy';
import {createArchiveTicket,verifyArchiveTicket} from './archive-ticket';
export interface ArchiveTx {
 isOwner(id:string):Promise<boolean>;
 records(ids?:string[],kind?:string):Promise<ArchiveRecord[]>;
 write(record:ArchiveRecord,actorId:string,action:ArchiveAction,reason:string):Promise<boolean>;
}
export interface ArchiveStore {
 transaction<T>(run:(tx:ArchiveTx)=>Promise<T>,readOnly?:boolean):Promise<T>;
}
export class ArchiveAccessError extends Error {readonly status=403;constructor(){super('Forbidden');}}
export function archiveFingerprint(record:ArchiveRecord):string {
 return createHash('sha256').update(JSON.stringify(record)).digest('hex');
}
async function requireArchiveOwner(tx:ArchiveTx,actorId:string) {
 if(!await tx.isOwner(actorId))throw new ArchiveAccessError();
}
export async function previewArchive(store:ArchiveStore,actorId:string,kind:string|undefined,action:ArchiveAction,config:ArchiveConfig) {
 return store.transaction(async tx=>{
  await requireArchiveOwner(tx,actorId);
  const records=await tx.records(undefined,kind);
  const now=Date.now();
  return {snapshotAt:new Date(now).toISOString(),expiresAt:new Date(now+300000).toISOString(),action,policyReady:config.ready,before:Number.isFinite(config.before.getTime())?config.before.toISOString():null,
   rows:records.map(a=>{
    const reasons=action==='RESTORE'?(a.archivedAt?[]:['NOT_ARCHIVED']):classifyArchive(a,config);
    if(config.secret.length<32)reasons.push('POLICY_NOT_CONFIGURED');
    const eligible=reasons.length===0;
    return {id:a.id,customerName:a.customerName,kind:a.kind,status:a.status,paymentStatus:a.paymentStatus,createdAt:a.createdAt.toISOString(),archivedAt:a.archivedAt?.toISOString()??null,signature:a.signature,payment:a.payment,recurring:a.recurring,dependencies:a.dependencies,reasons,eligible,
     ticket:eligible?createArchiveTicket({id:a.id,actorId,action,fingerprint:archiveFingerprint(a),policyVersion:config.version},config.secret,now):null};
   })};
 },true);
}
export interface ArchiveOutcome {id:string|null;status:'success'|'skipped'|'failed';reason:string}
export async function executeArchive(store:ArchiveStore,actorId:string,action:ArchiveAction,tickets:string[],reason:string,config:ArchiveConfig):Promise<ArchiveOutcome[]> {
 if(!['ARCHIVE','RESTORE'].includes(action)||tickets.length<1||tickets.length>50||reason.trim().length<3||reason.trim().length>500)throw new Error('Invalid archive request');
 await store.transaction(tx=>requireArchiveOwner(tx,actorId),true);
 const outcomes:ArchiveOutcome[]=[];
 for(const ticket of tickets){
  const proof=verifyArchiveTicket(ticket,config.secret,{actorId,action,policyVersion:config.version});
  if(!proof){outcomes.push({id:null,status:'failed',reason:'INVALID_OR_EXPIRED_PREVIEW'});continue;}
  try {
   outcomes.push(await store.transaction(async tx=>{
    await requireArchiveOwner(tx,actorId);
    const a=(await tx.records([proof.id]))[0];
    if (!verifyArchiveTicket(ticket,config.secret,{actorId,action,policyVersion:config.version})) return {id:proof.id,status:"skipped",reason:"PREVIEW_EXPIRED"};
    if(!a)return {id:proof.id,status:'skipped',reason:'NOT_FOUND'};
    if(action==='ARCHIVE'&&a.archivedAt||action==='RESTORE'&&!a.archivedAt)return {id:a.id,status:'skipped',reason:'ALREADY_APPLIED'};
    if(action==='ARCHIVE'){
     const reasons=classifyArchive(a,config);
     if(reasons.length)return {id:a.id,status:'skipped',reason:reasons.join(',')};
    }
    if(archiveFingerprint(a)!==proof.fingerprint)return {id:a.id,status:'skipped',reason:'STALE_PREVIEW'};
    if (!verifyArchiveTicket(ticket,config.secret,{actorId,action,policyVersion:config.version})) return {id:a.id,status:"skipped",reason:"PREVIEW_EXPIRED"};
    const written=await tx.write(a,actorId,action,reason.trim());
    return {id:a.id,status:written?'success':'skipped',reason:written?'APPLIED':'STALE_PREVIEW'};
   }));
  }catch(error){
   if(error instanceof ArchiveAccessError){
    outcomes.push({id:proof.id,status:"failed",reason:"FORBIDDEN"});
    for(let remaining=outcomes.length;remaining<tickets.length;remaining++)outcomes.push({id:null,status:"failed",reason:"FORBIDDEN"});
    break;
   }
   // Never return raw DB/provider errors or partially committed success.
   outcomes.push({id:proof.id,status:'failed',reason:'TRANSACTION_FAILED'});
  }
 }
 return outcomes;
}
