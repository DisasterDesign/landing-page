import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partnerForecastFigures } from './partner-forecast';
const report = {bottomLine:{totalMrr:1500,netProfit:1000},books:{personal:{amount:500,profit:400,count:2},fuzion:{amount:1000,profit:600,count:5}},settlement:{royEntitlement:300},myProfit:700};
test('recurring partnership uses half of all shared profit after expenses, independently of sales owner',()=>{
 assert.deepEqual(partnerForecastFigures(false,50,report),{gross:1000,profit:600,payout:300,clientCount:5});
});
test('owner keeps private profit and half shared profit',()=>{
 assert.deepEqual(partnerForecastFigures(true,null,report),{gross:1500,profit:1000,payout:700,clientCount:7});
});
test('first month partners retain their separate commission model',()=>{
 assert.equal(partnerForecastFigures(false,null,report),null);
});
