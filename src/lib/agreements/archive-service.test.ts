import assert from 'node:assert/strict';
import test from 'node:test';
import { previewArchive, executeArchive, type ArchiveStore, type ArchiveTx } from './archive-service';
import type {ArchiveRecord} from './archive-policy';
const config={ready:true,protectedIds:['synthetic-exception'],before:new Date('2026-10-01Z'),secret:'synthetic-secret-longer-than-thirty-two-characters',version:'v1'};
function fixture() {
 let owner=true; let row:ArchiveRecord={id:'synthetic',customerName:'Synthetic',kind:'SUBSCRIPTION',status:'DRAFT',paymentStatus:'PENDING',createdAt:new Date('2026-01-01Z'),updatedAt:new Date('2026-01-02Z'),archivedAt:null,archiveVersion:0,signature:false,payment:false,recurring:false,linkedClient:false,dependencies:{charges:0,receipts:0,commissions:0,products:0}};
 const events:Array<{action:string;reason:string}>=[];
 const tx:ArchiveTx={isOwner:async()=>owner,records:async()=>[row],write:async(a,_actor,action,reason)=>{if(a.archiveVersion!==row.archiveVersion)return false;row={...row,archivedAt:action==='ARCHIVE'?new Date():null,archiveVersion:row.archiveVersion+1};events.push({action,reason});return true;}};
 const store:ArchiveStore={transaction:async(run)=>run(tx)};
 return {store,events,get row(){return row;},patch:(x:Partial<ArchiveRecord>)=>{row={...row,...x};},revoke:()=>{owner=false;}};
}
test('archive/restore are metadata-only, repeated commands skip and audit occurs once per transition',async()=>{
 const f=fixture(); const before={status:f.row.status,paymentStatus:f.row.paymentStatus,dependencies:f.row.dependencies};
 const p=await previewArchive(f.store,'owner','SUBSCRIPTION','ARCHIVE',config);
 assert.equal(p.rows[0].eligible,true);
 const tickets=[p.rows[0].ticket!];
 assert.equal((await executeArchive(f.store,'owner','ARCHIVE',tickets,'synthetic reason',config))[0].status,'success');
 assert.equal((await executeArchive(f.store,'owner','ARCHIVE',tickets,'synthetic reason',config))[0].status,'skipped');
 assert.deepEqual({status:f.row.status,paymentStatus:f.row.paymentStatus,dependencies:f.row.dependencies},before);
 f.patch({payment:true,paymentStatus:'COMPLETED'});
 const restore=await previewArchive(f.store,'owner','SUBSCRIPTION','RESTORE',config);
 assert.equal(restore.rows[0].eligible,true);
 const rt=[restore.rows[0].ticket!];
 assert.equal((await executeArchive(f.store,'owner','RESTORE',rt,'restore visibility',config))[0].status,'success');
 assert.equal((await executeArchive(f.store,'owner','RESTORE',rt,'restore visibility',config))[0].status,'skipped');
 assert.equal(f.row.paymentStatus,'COMPLETED');assert.equal(f.row.archivedAt,null);assert.equal(f.events.length,2);
});
test('signature, payment and linked charge arriving after preview prevent archive',async()=>{
 for(const patch of [{signature:true},{payment:true},{dependencies:{charges:1,receipts:0,commissions:0,products:0}}]) {
  const f=fixture();const p=await previewArchive(f.store,'owner',undefined,'ARCHIVE',config);
  f.patch(patch);
  assert.equal((await executeArchive(f.store,'owner','ARCHIVE',[p.rows[0].ticket!],'synthetic reason',config))[0].status,'skipped');
  assert.equal(f.row.archivedAt,null);assert.equal(f.events.length,0);
 }
});
test('revoked persisted ownership blocks preview and execution without exposing records',async()=>{
 const f=fixture();const p=await previewArchive(f.store,'owner',undefined,'ARCHIVE',config);f.revoke();
 await assert.rejects(()=>previewArchive(f.store,'owner',undefined,'ARCHIVE',config),/Forbidden/);
 await assert.rejects(()=>executeArchive(f.store,'owner','ARCHIVE',[p.rows[0].ticket!],'synthetic reason',config),/Forbidden/);
 assert.equal(f.events.length,0);
});
test('invalid tickets fail independently; protected and incomplete records never receive an archive ticket',async()=>{
 const f=fixture();const p=await previewArchive(f.store,'owner',undefined,'ARCHIVE',config);
 const r=await executeArchive(f.store,'owner','ARCHIVE',['tampered',p.rows[0].ticket!],'synthetic reason',config);
 assert.deepEqual(r.map(x=>x.status),['failed','success']);
 f.patch({id:'synthetic-exception',archivedAt:null});
 assert.equal((await previewArchive(f.store,'owner',undefined,'ARCHIVE',config)).rows[0].ticket,null);
 assert.equal(f.events.length,1);
});
test('a ticket expiring during a transaction wait cannot archive',async()=>{
 const realNow=Date.now;let clock=1000;Date.now=()=>clock;
 try{
  const f=fixture();const p=await previewArchive(f.store,'owner',undefined,'ARCHIVE',config);
  const base=f.store.transaction;
  f.store.transaction=(run,readOnly)=>base(tx=>{if(!readOnly)clock=302000;return run(tx);},readOnly);
  const r=await executeArchive(f.store,'owner','ARCHIVE',[p.rows[0].ticket!],'Synthetic delayed',config);
  assert.equal(r[0].status,'skipped');assert.equal(f.row.archivedAt,null);
 }finally{Date.now=realNow;}
});
test('bulk owner revocation preserves already committed outcomes and denies remaining items',async()=>{
 const f=fixture();const p=await previewArchive(f.store,'owner',undefined,'ARCHIVE',config);
 const base=f.store.transaction;
 f.store.transaction=(run,readOnly)=>base(tx=>run({...tx,write:async(...args)=>{const applied=await tx.write(...args);f.revoke();return applied;}}),readOnly);
 const r=await executeArchive(f.store,'owner','ARCHIVE',[p.rows[0].ticket!,p.rows[0].ticket!],'Synthetic revoked midway',config);
 assert.deepEqual(r.map(x=>x.status),['success','failed']);assert.equal(f.events.length,1);
});
