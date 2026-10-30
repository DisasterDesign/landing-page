import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CashSettlementView } from './CashSettlementPanel';
import { calculateCashSettlement } from '../../lib/finance/cash-settlement';
import { resolveCashPeriod } from '../../lib/finance/cash-period';
import type { CashSettlementReport } from '../../lib/finance/cash-data';

test('cash UI explains missing evidence and renders client/expense tables from the same canonical values',()=>{
 const period=resolveCashPeriod({from:'2026-10-01',to:'2026-11-01',asOf:'2026-10-30T00:00:00Z'},new Date('2026-10-30T01:00:00Z'));
 const cash=calculateCashSettlement({period,isOwner:true,receipts:[{provider:'TEST',terminalId:'test',providerTransactionId:'1',kind:'CHARGE',amountMinor:11800,ilsAmountMinor:11800,currency:'ILS',occurredAt:new Date('2026-10-02T00:00:00Z'),financeBook:'SHARED',clientId:'a'}],clients:[{id:'a',name:'Synthetic shared client'}],expenses:[],advances:[],coverage:{sourceComplete:false,expensesConfirmed:false,advancesConfirmed:false}});
 const report={...cash,generatedAt:period.asOf,source:{status:'FAILED',lastSuccessAt:null,coveredFrom:null,coveredTo:null,stale:true,complete:false},expenseCoverage:'NOT_CONFIRMED',advanceCoverage:'NOT_RECORDED',expenseFxCoverage:'ORIGINAL_CURRENCY_NOT_RECORDED',asOfBasis:'EVENT_TIME_CUTOFF_CURRENT_RECORDS',missingExpensePaymentCount:2} satisfies CashSettlementReport;
 const html=renderToStaticMarkup(React.createElement(CashSettlementView,{report}));
 assert.ok(html.includes('Synthetic shared client'));assert.ok(html.includes('טרם ניתן לקבוע'));assert.ok(html.includes('מע״מ מחושב'));assert.ok(html.includes('תקבולים משותפים לפי לקוח'));assert.ok(html.includes('הוצאות משותפות ששולמו'));assert.ok(html.includes('Asia/Jerusalem'));assert.equal(html.includes('undefined'),false);
});
