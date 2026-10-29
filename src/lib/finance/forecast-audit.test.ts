import test from 'node:test';
import assert from 'node:assert/strict';
import { auditForecastClient } from './forecast-audit';
const product={monthlyAmount:118,financeBook:'SHARED',status:'בוצע',archivedAt:null,agreementId:'synthetic-agreement'};
const client={name:'Synthetic client',monthlyAmount:118,products:[product],agreements:[{id:'synthetic-agreement',cardcomIsActive:false}]};
test('forecast explicitly flags an included product whose linked agreement order is inactive',()=>{
 assert.equal(auditForecastClient(client,b=>b==='SHARED',true).some(x=>x.code==='INACTIVE_PRODUCT_AGREEMENT'),true);
});
test('archived and nonbilling products do not create false price or inactive-order warnings',()=>{
 const c={...client,monthlyAmount:0,products:[{...product,archivedAt:new Date()},{...product,status:''}]};
 assert.deepEqual(auditForecastClient(c,()=>true,true),[]);
});
test('partial shared view cannot compare private-inclusive legacy rollup or expose private amount gaps',()=>{
 const c={...client,monthlyAmount:99999,products:[{...product,agreementId:null},{...product,monthlyAmount:null,financeBook:'PRIVATE'}]};
 assert.deepEqual(auditForecastClient(c,b=>b==='SHARED',false),[]);
 assert.equal(auditForecastClient(c,b=>b==='SHARED',true).some(w=>w.code==='CLIENT_PRODUCT_DRIFT'||w.code==='UNVALUED_PRODUCT'),false);
});
test('agreeing product and client amounts remain free of drift diagnostics',()=>{
 const c={...client,agreements:[{id:'synthetic-agreement',cardcomIsActive:true}]};
 assert.deepEqual(auditForecastClient(c,()=>true,true),[]);
});

test('a valued active product without agreement or stored provider-account linkage has a scoped diagnostic',()=>{
 const c={...client,products:[{...product,agreementId:null}],agreements:[],cardcomAccountIds:[]};
 assert.equal(auditForecastClient(c,()=>true,true).some(w=>w.code==='UNVERIFIED_COLLECTION_LINK'),true);
 assert.deepEqual(auditForecastClient(c,()=>true,false),[]);
});
test('stored provider-account linkage does not require fabricating a legal agreement for a legacy product',()=>{
 const c={...client,products:[{...product,agreementId:null}],agreements:[],cardcomAccountIds:[123]};
 assert.equal(auditForecastClient(c,()=>true,true).some(w=>w.code==='UNVERIFIED_COLLECTION_LINK'),false);
});
