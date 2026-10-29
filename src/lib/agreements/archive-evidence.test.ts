import assert from 'node:assert/strict';
import test from 'node:test';
import { fromArchiveRow } from './archive-evidence';
const row={id:'synthetic',customerName:'Synthetic',kind:'SUBSCRIPTION',status:'CANCELLED',paymentStatus:'PENDING',createdAt:new Date('2026-01-01Z'),updatedAt:new Date('2026-01-02Z'),archivedAt:null,archiveVersion:0,clientId:null,signedAt:null,signatureData:null,signedIp:null,signedUserAgent:null,paidAt:null,paidAmount:null,invoiceNumber:null,paymentId:null,paymentUrl:null,cardcomDealId:null,cardcomVerifiedLowProfileId:null,cardcomVerifiedReturnValue:null,cardcomVerifiedTransactionId:null,cardcomVerifiedAmount:null,cardcomPaymentVerifiedAt:null,cardcomToken:null,cardcomRecurringId:null,cardcomLowProfileId:null,cardcomAccountId:null,cardcomIsActive:null,cardcomNextBillDate:null,cardcomSyncedAt:null};
const counts={charges:0,receipts:0,commissions:0,products:0};
test('all individual signature, partial payment and provider traces survive projection',()=>{
 assert.equal(fromArchiveRow(row,counts).payment,false);
 for(const key of ['paidAt','paidAmount','invoiceNumber','paymentId','paymentUrl','cardcomDealId','cardcomVerifiedLowProfileId','cardcomVerifiedReturnValue','cardcomVerifiedTransactionId','cardcomVerifiedAmount','cardcomPaymentVerifiedAt']) {
  const r=fromArchiveRow({...row,[key]:key.endsWith('Amount')?0:'trace'},counts);
  assert.equal(r.payment,true,key);
 }
 for(const key of ['signedAt','signatureData','signedIp','signedUserAgent']) assert.equal(fromArchiveRow({...row,[key]:'trace'},counts).signature,true,key);
 for(const key of ['cardcomToken','cardcomRecurringId','cardcomLowProfileId','cardcomAccountId','cardcomNextBillDate','cardcomSyncedAt']) assert.equal(fromArchiveRow({...row,[key]:'trace'},counts).recurring,true,key);
 assert.equal(fromArchiveRow({...row,cardcomIsActive:false},counts).recurring,true);
 assert.equal(fromArchiveRow({...row,signatureData:undefined},counts).signature,null);
 assert.equal(fromArchiveRow({...row,paidAt:undefined},counts).payment,null);
});
