import assert from 'node:assert/strict';
import test from 'node:test';
import { archiveHandlers } from './archive-http';
const deps={authenticate:async()=>({userId:'synthetic-owner'}),store:{transaction:async()=>{throw Error('must not read')}},config:()=>({ready:false,protectedIds:[],before:new Date(),secret:'',version:'v'})};
test('unauthorized preview returns 403 before reading records',async()=>{
 const h=archiveHandlers({...deps,authenticate:async()=>{throw {status:403};}});
 const r=await h.GET(new Request('https://synthetic.invalid/api/agreements/archive'));
 assert.equal(r.status,403);assert.equal(r.headers.get('cache-control'),'no-store');
});
test('client supplied owner, book, oversized bulk, missing reason and invalid actions never reach the store',async()=>{
 const h=archiveHandlers(deps);
 for(const body of [{action:'ARCHIVE',tickets:['x'],reason:'why',userId:'forged'},{action:'ARCHIVE',tickets:['x'],reason:'why',financeBook:'PRIVATE'},{action:'DELETE',tickets:['x'],reason:'why'},{action:'ARCHIVE',tickets:Array(51).fill('x'),reason:'why'},{action:'ARCHIVE',tickets:['x'],reason:''}]){
  assert.equal((await h.POST(new Request('https://synthetic.invalid',{method:'POST',body:JSON.stringify(body)}))).status,400);
 }
 assert.equal((await h.GET(new Request('https://synthetic.invalid?actorId=forged'))).status,400);
});
