import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyArchive, workingArchiveVisible, type ArchiveRecord } from './archive-policy';

export function syntheticRecord(changes: Partial<ArchiveRecord> = {}): ArchiveRecord {
  return { id:'synthetic-agreement', customerName:'Synthetic customer', kind:'SUBSCRIPTION', status:'DRAFT', paymentStatus:'PENDING', createdAt:new Date('2026-01-01Z'), updatedAt:new Date('2026-01-02Z'), archivedAt:null, archiveVersion:0, signature:false, payment:false, recurring:false, linkedClient:false, dependencies:{charges:0,receipts:0,commissions:0,products:0}, ...changes };
}
const policy={ ready:true, protectedIds:['synthetic-protected'], before:new Date('2026-10-01Z') };
test('an old unsigned unpaid draft and a cancelled agreement can be archived without status changes',()=>{
  for(const status of ['DRAFT','CANCELLED']) {
    const a=syntheticRecord({status});
    assert.deepEqual(classifyArchive(a,policy),[]);
    assert.equal(a.status,status);
  }
});
test('signature, paid-only, both, partial payment and every financial dependency block cleanup',()=>{
  const cases:Partial<ArchiveRecord>[]=[{signature:true},{payment:true},{signature:true,payment:true},{paymentStatus:'SENT'},{paymentStatus:'FAILED'},{paymentStatus:'COMPLETED'},{status:'SIGNED'},{recurring:true},{linkedClient:true}];
  for(const patch of cases) assert.ok(classifyArchive(syntheticRecord(patch),policy).length,JSON.stringify(patch));
  for(const field of ['charges','receipts','commissions','products'] as const)
    assert.ok(classifyArchive(syntheticRecord({dependencies:{charges:0,receipts:0,commissions:0,products:0,[field]:1}}),policy).length,field);
});
test('unknown evidence, missing configuration, fresh agreements and the private exception fail closed',()=>{
  for(const patch of [{signature:null},{payment:null},{recurring:null},{id:'synthetic-protected'},{status:'UNKNOWN'},{createdAt:new Date('2026-10-02Z')},{dependencies:{charges:null,receipts:0,commissions:0,products:0}}])
    assert.ok(classifyArchive(syntheticRecord(patch),policy).length);
  assert.ok(classifyArchive(syntheticRecord(),{...policy,ready:false}).length);
});
test('a cancelled record with signature evidence is protected and late payment remains visible',()=>{
  const a=syntheticRecord({status:'CANCELLED',signature:true,archivedAt:new Date()});
  assert.ok(classifyArchive(a,policy).length);
  assert.equal(workingArchiveVisible(a),true);
  assert.equal(workingArchiveVisible(syntheticRecord({archivedAt:new Date(),payment:true})),true);
  assert.equal(workingArchiveVisible(syntheticRecord({archivedAt:new Date()})),false);
});
