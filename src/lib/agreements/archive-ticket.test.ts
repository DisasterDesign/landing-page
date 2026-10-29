import assert from 'node:assert/strict';
import test from 'node:test';
import { createArchiveTicket, verifyArchiveTicket } from './archive-ticket';
const key='synthetic-key-with-at-least-thirty-two-characters';
const input={id:'synthetic',actorId:'owner',action:'ARCHIVE' as const,fingerprint:'snapshot',policyVersion:'private-policy'};
test('preview tickets bind owner, action, policy and expire; tampering never authorizes cleanup',()=>{
 const ticket=createArchiveTicket(input,key,1000);
 assert.equal(verifyArchiveTicket(ticket,key,{actorId:'owner',action:'ARCHIVE',policyVersion:'private-policy'},1100)?.id,'synthetic');
 for(const scope of [{actorId:'other',action:'ARCHIVE' as const,policyVersion:'private-policy'},{actorId:'owner',action:'RESTORE' as const,policyVersion:'private-policy'},{actorId:'owner',action:'ARCHIVE' as const,policyVersion:'changed'}])
   assert.equal(verifyArchiveTicket(ticket,key,scope,1100),null);
 assert.equal(verifyArchiveTicket(ticket+'x',key,input,1100),null);
 assert.equal(verifyArchiveTicket(ticket,key,input,301001),null);
 assert.equal(verifyArchiveTicket(ticket,key,input,999),null);
});
