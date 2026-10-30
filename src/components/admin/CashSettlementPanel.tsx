"use client";

import React, { useCallback, useEffect, useState } from 'react';
import type { CashSettlementReport } from '@/lib/finance/cash-data';

const money=(minor:number|null|undefined)=>minor==null?'לא ידוע':new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',minimumFractionDigits:2}).format(minor/100);
const date=(value:string)=>new Date(value).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'});
const reason:Record<string,string>={RECEIPT_CLASSIFICATION_UNKNOWN:'יש תקבולים שטרם שויכו לספר הכנסות',PERIOD_OPEN:'התקופה עדיין פתוחה',SOURCE_INCOMPLETE:'מקור התקבולים אינו מעודכן או אינו מכסה את התקופה',EXPENSE_COVERAGE_UNKNOWN:'טרם אושר שכל ההוצאות ששולמו נכללו',ADVANCE_COVERAGE_UNKNOWN:'אין יומן מקדמות מאומת לתקופה',RECEIPT_FX_MISSING:'חסר שווי שקלי בפועל לתקבולים במט״ח',VAT_CALCULATED:'בחלק מהתקבולים המע״מ מחושב; מע״מ המקור חסר',FEES_ESTIMATED:'עמלות הסליקה משוערות',EXPENSE_VAT_UNKNOWN:'חסר מע״מ תשומות מוכר לצורך הוצאה נטו',EXPENSE_PAYER_UNKNOWN:'לא זוהה מי שילם חלק מההוצאות',RECEIPT_CLIENT_UNLINKED:'יש תקבול ללא לקוח מזוהה'};
const tableClass='w-full text-sm text-right [&_th]:p-3 [&_td]:p-3 [&_th]:text-gray-400 [&_td]:border-t [&_td]:border-gray-800';

export function CashSettlementView({report:r}:{report:CashSettlementReport}) {
  const t=r.totals;
  return <section dir="rtl" className="space-y-5 rounded-2xl border border-cyan-700/50 bg-gray-950 p-4 md:p-6" aria-label="התחשבנות בפועל">
    <div><h2 className="text-xl font-bold text-white">התחשבנות משותפת לפי כסף שהתקבל</h2><p className="mt-2 text-sm text-gray-400">{date(r.period.from)} עד {date(r.period.toExclusive)} (הגבול האחרון אינו כלול) · חתך מזומן: {date(r.period.asOf)}</p><p className="text-xs text-gray-500">אזור זמן התקופה: {r.period.timezone}. התקבולים וההוצאות הפרטיים מחוץ לחלוקה.</p></div>
    <div className={`rounded-xl border p-4 ${r.status==='FINAL'?'border-green-700 bg-green-950/30':'border-amber-700 bg-amber-950/20'}`}>
      <p className="font-bold text-white">{r.status==='FINAL'?'סכום להעברה לרועי':'תמונה חלקית — סכום ההעברה הסופי טרם ניתן לקבוע'}</p>
      <p className="mt-2 text-2xl font-bold text-cyan-200">{r.roy.finalPayableIlsMinor==null?'טרם ניתן לקבוע':money(r.roy.finalPayableIlsMinor)}</p>
      {r.blockers.length>0&&<ul className="mt-3 list-disc space-y-1 pr-5 text-sm text-amber-200">{r.blockers.map(code=><li key={code}>{reason[code]??code}</li>)}</ul>}
    </div>
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      ['תקבולים משותפים — ברוטו לאחר החזרים',t.grossIlsMinor],['מע״מ בתקבולים — מקור או חישוב',t.vatIlsMinor],['עמלות סליקה'+(t.feeEstimated?' — אומדן':''),t.feeIlsMinor],['הכנסה משותפת נטו ידועה',t.netIncomeIlsMinor],
      ['הוצאות ששולמו — ברוטו ידוע',t.expenseGrossIlsMinor],['הוצאות נטו עם בסיס מע״מ ידוע',t.expenseNetIlsMinor],['חלק רועי הידוע לפני מע״מ והשלמות',r.roy.shareBeforeVatIlsMinor],['מע״מ על חלק רועי — 18%',r.roy.invoiceVatIlsMinor],
    ].map(([label,value])=><div key={String(label)} className="rounded-lg bg-gray-900 p-3"><dt className="text-xs text-gray-400">{label}</dt><dd className="mt-2 font-mono text-lg text-white">{money(value as number)}</dd></div>)}</dl>
    <p className="text-sm text-gray-400">החישוב: תקבולים ללא מע״מ ועמלות, פחות הוצאות משותפות נטו מאומתות, חלוקה לשניים, תוספת מע״מ פעם אחת על חלק רועי. החזר הוצאות ששילם רועי: {money(r.roy.reimbursementIlsMinor)}; מקדמות מאומתות שנוכו: {money(r.roy.confirmedAdvanceIlsMinor)}. אין בכך אישור שלא היו מקדמות נוספות. אגורה שאינה מתחלקת נשארת אצל אלעד.</p>
    <p className="text-sm text-amber-200">{t.receiptCount} תקבולים משותפים; מתוכם חסר שווי שקלי ל־{t.missingFxCount}. {r.missingExpensePaymentCount} הוצאות פעילות ללא תשלום מתועד בתקופה. הוצאות ללא בסיס מע״מ נטו אינן נכללות בסכום ההוצאות נטו הידוע ({t.expenseVatUnknownCount}). סכומי הביניים אינם סכום לתשלום.</p>
    <div><h3 className="mb-2 font-bold text-white">תקבולים משותפים לפי לקוח</h3><div className="overflow-x-auto"><table className={tableClass}><thead><tr><th>לקוח</th><th>תקבולים</th><th>ברוטו לאחר החזרים</th><th>החזרים (כלולים)</th><th>מע״מ מקור או מחושב</th><th>עמלות</th><th>נטו</th><th>חסרים</th></tr></thead><tbody>{r.clients.map(c=><tr key={c.clientId??'unlinked'}><td>{c.name}</td><td>{c.receiptCount}</td><td>{money(c.receiptCount===c.missingFxCount?null:c.grossIlsMinor)}</td><td>{money(c.refundsIlsMinor)} ({c.refundCount})</td><td>{money(c.receiptCount===c.missingFxCount?null:c.vatIlsMinor)}</td><td>{money(c.receiptCount===c.missingFxCount?null:c.feeIlsMinor)}</td><td>{money(c.receiptCount===c.missingFxCount?null:c.netIlsMinor)}</td><td>{c.missingFxCount} שערי חיוב; {c.calculatedVatCount} מע״מ מחושב</td></tr>)}</tbody><tfoot><tr><th>סה״כ ידוע</th><th>{t.receiptCount}</th><th>{money(t.grossIlsMinor)}</th><th>{money(t.refundsIlsMinor)}</th><th>{money(t.vatIlsMinor)}</th><th>{money(t.feeIlsMinor)}</th><th>{money(t.netIncomeIlsMinor)}</th><th>{t.missingFxCount} ללא שווי</th></tr></tfoot></table></div></div>
    {r.receiptRows&&<details><summary className="cursor-pointer font-bold text-cyan-200">פירוט קבלות והחזרים ({r.receiptRows.length}) — לבעלים</summary><div className="mt-3 overflow-x-auto"><table className={tableClass}><thead><tr><th>לקוח / תאריך</th><th>סוג</th><th>סכום מקור</th><th>ברוטו ₪</th><th>מע״מ מקור ₪</th><th>מע״מ בחישוב</th><th>עמלות</th><th>נטו</th></tr></thead><tbody>{r.receiptRows.map(line=><tr key={line.reference}><td>{line.clientName}<br/><small>{date(line.occurredAt)}</small></td><td>{line.kind==='REFUND'?'החזר':'תקבול'}</td><td dir="ltr">{(line.originalAmountMinor/100).toFixed(2)} {line.currency}<br/><small>{line.fxBasis==='MISSING'?'חסר חיוב שקלי':line.fxBasis==='RECORDED_ILS'?'שווי שקלי מתועד':'שקלים במקור'}</small></td><td>{money(line.grossIlsMinor)}</td><td>{money(line.sourceVatIlsMinor)}</td><td>{money(line.vatIlsMinor)}<br/><small>{line.vatBasis==='SOURCE'?'מקור':line.vatBasis==='CALCULATED'?'מע״מ מחושב':line.vatBasis==='EXEMPT'?'לפי סימון פטור':'לא ידוע'}</small></td><td>{money(line.feeIlsMinor)} {line.feeEstimated?'(אומדן)':''}</td><td>{money(line.netIlsMinor)}</td></tr>)}</tbody></table></div></details>}
    <div><h3 className="mb-2 font-bold text-white">הוצאות משותפות ששולמו</h3><div className="overflow-x-auto"><table className={tableClass}><thead><tr><th>הוצאה</th><th>מועד תשלום</th><th>משלם</th><th>ברוטו משותף</th><th>מע״מ תשומות מוכר</th><th>נטו</th></tr></thead><tbody>{r.expenses.map(e=><tr key={e.id}><td>{e.name}</td><td>{date(e.paidAt)}</td><td>{e.paidBy==='ROY'?'רועי':e.paidBy==='OWNER'?'אלעד':'לא ידוע'}</td><td>{money(e.grossIlsMinor)}</td><td>{money(e.deductibleVatIlsMinor)}</td><td>{money(e.netIlsMinor)}</td></tr>)}{r.expenses.length===0&&<tr><td colSpan={6}>אין תשלומי הוצאות מתועדים לתקופה. אין זו הוכחה שלא שולמו הוצאות.</td></tr>}</tbody><tfoot><tr><th colSpan={3}>סה״כ ידוע</th><th>{money(t.expenseGrossIlsMinor)}</th><th>{t.expenseVatUnknownCount?'חסר בסיס מע״מ בחלק מהתשלומים':money(t.expenseGrossIlsMinor-t.expenseNetIlsMinor)}</th><th>{money(t.expenseNetIlsMinor)}</th></tr></tfoot></table></div><p className="mt-2 text-xs text-gray-500">תשלום במט״ח דורש שווי שקלי בפועל; היומן הקיים שומר סכום שקלי אך אינו שומר מטבע מקור או מע״מ תשומות. תקציב חודשי ופריסת הוצאה שנתית אינם תשלומים בפועל.</p></div>
    {(r.unassignedReceiptCount??0)>0&&<p className="text-sm text-amber-200">{r.unassignedReceiptCount} תקבולים בטווח טרם שויכו ואינם נכללים בסכומים.</p>}
    {r.privateExcluded&&<p className="text-sm text-gray-400">לבעלים בלבד: הוצאו מהחלוקה {r.privateExcluded.receiptCount} תקבולים פרטיים, ברוטו שקלי ידוע {money(r.privateExcluded.grossIlsMinor)}; ללא שווי שקלי: {r.privateExcluded.missingFxCount}.</p>}
    <details className="text-xs text-gray-400"><summary className="cursor-pointer">מקור, תאריך חתך והתאמה לדוח</summary><p className="mt-2">סטטוס מקור: {r.source.status}; עדכון מוצלח אחרון: {r.source.lastSuccessAt?date(r.source.lastSuccessAt):'אין'}. התצוגה משתמשת ברשומות הקיימות כעת לפי מועד העסקה; היא אינה משחזרת גרסה היסטורית של הפנקס.</p><p dir="ltr" className="mt-2 break-all">from={r.period.from} · to={r.period.toExclusive} · asOf={r.period.asOf} · timezone={r.period.timezone} · scope=SHARED</p></details>
  </section>;
}

export default function CashSettlementPanel() {
  const [month,setMonth]=useState(()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit'}).format(new Date()));
  const [report,setReport]=useState<CashSettlementReport|null>(null);
  const [error,setError]=useState(false);
  const [loading,setLoading]=useState(true);
  const load=useCallback(async(signal:AbortSignal)=>{
    setLoading(true);setError(false);
    try {
      if(!/^\d{4}-\d{2}$/.test(month))throw new Error('Invalid month');
      const [year,m]=month.split('-').map(Number);
      const next=new Date(Date.UTC(year,m,1)).toISOString().slice(0,10);
      const params=new URLSearchParams({from:`${month}-01`,to:next,timezone:'Asia/Jerusalem'});
      const response=await fetch(`/api/finance/settlement?${params}`,{cache:'no-store',signal});
      if(!response.ok)throw new Error('Unavailable');
      setReport(await response.json());
    }catch{if(!signal.aborted){setError(true);setReport(null);}}
    finally{if(!signal.aborted)setLoading(false);}
  },[month]);
  useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load]);
  return <div className="space-y-3"><label className="flex items-center gap-3 text-sm text-gray-300">חודש להתחשבנות בפועל<input aria-label="חודש להתחשבנות בפועל" type="month" value={month} onChange={e=>setMonth(e.target.value)} className="rounded border border-gray-700 bg-gray-900 p-2"/></label>{loading?<p role="status" className="text-gray-400">טוען התחשבנות...</p>:error?<p role="alert" className="text-amber-200">קריאת ההתחשבנות נכשלה. אין סכום זמין להעברה.</p>:report&&<CashSettlementView report={report}/>}</div>;
}
