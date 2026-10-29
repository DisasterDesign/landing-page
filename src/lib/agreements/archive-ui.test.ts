import assert from 'node:assert/strict';
import test from 'node:test';
import {archiveViewUrl,selectedArchiveTickets,quoteWorkingVisible} from './archive-ui';
test('archive filters survive URL navigation without losing focused agreement or other filters',()=>{
 assert.equal(archiveViewUrl('https://synthetic.invalid/admin/agreements?focus=synthetic&archive=all#details','archived'),'/admin/agreements?focus=synthetic&archive=archived#details');
 assert.equal(archiveViewUrl('https://synthetic.invalid/admin/jobs?archive=all','active'),'/admin/jobs');
});
test('bulk submission includes only selected eligible server tickets and caps each batch',()=>{
 const rows=[{id:'a',eligible:true,ticket:'server-a'},{id:'b',eligible:false,ticket:'forged-b'},{id:'c',eligible:true,ticket:null}];
 assert.deepEqual(selectedArchiveTickets(rows,new Set(['a','b','c'])),['server-a']);
 assert.equal(selectedArchiveTickets(Array.from({length:60},(_,i)=>({id:String(i),eligible:true,ticket:'ticket'+i})),new Set(Array.from({length:60},(_,i)=>String(i)))).length,50);
});

test('cancelled quotes with server-confirmed protection survive the secondary UI filter',()=>{
 assert.equal(quoteWorkingVisible({agreementStatus:'CANCELLED',archiveProtected:true},false),true);
 assert.equal(quoteWorkingVisible({agreementStatus:'CANCELLED',archiveProtected:false},false),false);
});
