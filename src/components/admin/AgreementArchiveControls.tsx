'use client';
import {useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {ARCHIVE_REASONS,parseArchiveView,type ArchiveAction,type ArchiveView} from '@/lib/agreements/archive-policy';
import {archiveViewUrl,selectedArchiveTickets} from '@/lib/agreements/archive-ui';
import type {previewArchive,ArchiveOutcome} from '@/lib/agreements/archive-service';
type Preview=Awaited<ReturnType<typeof previewArchive>>;
const labels:Record<ArchiveView,string>={active:'פעילים',archived:'ארכיון',all:'הכול'};
const outcomeLabels={success:'הצליח',skipped:'דולג',failed:'נכשל'};
const resultReasons:Record<string,string>={APPLIED:'בוצע',ALREADY_APPLIED:'המצב המבוקש כבר קיים',STALE_PREVIEW:'המידע השתנה — יש להפיק תצוגה מקדימה חדשה',INVALID_OR_EXPIRED_PREVIEW:'התצוגה פגה או אינה תקפה',TRANSACTION_FAILED:'הפעולה לא הושלמה — יש לבדוק מחדש',NOT_FOUND:'ההסכם אינו זמין',NOT_ARCHIVED:'ההסכם אינו בארכיון',PREVIEW_EXPIRED:'תוקף הבדיקה פג — יש להפיק תצוגה חדשה',FORBIDDEN:'ההרשאה נשללה — הפעולה לא בוצעה'};
function describe(reason:string){return reason.split(',').map(r=>ARCHIVE_REASONS[r]??resultReasons[r]??'נדרשת בדיקה').join(' · ');}
export function useAgreementArchiveView(){
 const params=useSearchParams(),router=useRouter();
 const view=parseArchiveView(params.get('archive'));
 return {view,setView:(next:ArchiveView)=>router.replace(archiveViewUrl(window.location.href,next),{scroll:false})};
}
export default function AgreementArchiveControls({kind,isOwner,view,onViewChange,onChanged}:{kind:'SUBSCRIPTION'|'ONE_TIME';isOwner:boolean;view:ArchiveView;onViewChange:(view:ArchiveView)=>void;onChanged:()=>void|Promise<void>}){
 const [preview,setPreview]=useState<Preview|null>(null),[selected,setSelected]=useState<Set<string>>(new Set()),[reason,setReason]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState(''),[results,setResults]=useState<ArchiveOutcome[]>([]);
 async function load(action:ArchiveAction){
  if(pending)return;setPending(true);setError('');setResults([]);setPreview(null);setSelected(new Set());
  try{
   const res=await fetch(`/api/agreements/archive?kind=${kind}&action=${action}`,{cache:'no-store'});
   if(!res.ok)throw Error('לא ניתן להפיק תצוגה מקדימה. יש לבדוק הרשאות ותצורת שרת.');
   const p:Preview=await res.json();setPreview(p);setReason('');setSelected(new Set(p.rows.filter(a=>a.eligible).slice(0,50).map(a=>a.id)));
  }catch(e){setError(e instanceof Error?e.message:'הבדיקה נכשלה');}finally{setPending(false);}
 }
 async function execute(){
  if(!preview||pending||reason.trim().length<3)return;
  const tickets=selectedArchiveTickets(preview.rows,selected);if(!tickets.length)return;
  setPending(true);setError('');
  try{
   const res=await fetch('/api/agreements/archive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:preview.action,tickets,reason})});
   if(!res.ok)throw Error('לא ניתן לבצע את הפעולה. יש לבדוק הרשאות ולהפיק בדיקה חדשה.');
   setResults((await res.json()).results);setPreview(null);setSelected(new Set());await onChanged();
  }catch(e){setError(e instanceof Error?e.message:'הפעולה נכשלה');setPreview(null);}finally{setPending(false);}
 }
 return <section dir="rtl" className="space-y-3 rounded-xl border border-gray-700 bg-gray-900 p-3" aria-label="ארכיון הסכמים">
  <div className="flex flex-wrap items-center gap-2">
   <div role="group" aria-label="תצוגת הסכמים" className="flex gap-1">{(Object.keys(labels) as ArchiveView[]).map(v=><button type="button" key={v} disabled={pending} aria-pressed={view===v} onClick={()=>{setPreview(null);setResults([]);onViewChange(v);}} className={`rounded-lg px-3 py-2 text-sm ${view===v?'bg-gray-700 text-white':'text-gray-400'}`}>{labels[v]}</button>)}</div>
   {isOwner&&<><button type="button" disabled={pending} onClick={()=>load('ARCHIVE')} className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-white">בדיקת ניקוי מרובה</button><button type="button" disabled={pending} onClick={()=>load('RESTORE')} className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-white">בדיקת שחזור</button></>}
   {pending&&<span role="status" className="text-xs text-gray-400">בודק…</span>}
  </div>
  {error&&<p role="alert" className="text-sm text-red-400">{error}</p>}
  {preview&&isOwner&&<div className="space-y-3">
   <p className="text-xs text-gray-400">{preview.action==='ARCHIVE'?'תצוגה מקדימה לארכוב':'תצוגה מקדימה לשחזור'} · נבדק {new Date(preview.snapshotAt).toLocaleString('he-IL')} · תוקף עד {new Date(preview.expiresAt).toLocaleTimeString('he-IL')}. נבדק שוב בשרת בזמן הביצוע. עד 50 הסכמים בכל פעולה.</p>
   {preview.action==='ARCHIVE'&&<p className="text-xs text-gray-400">{preview.before?`תאריך סף: ${new Date(preview.before).toLocaleString('he-IL')}`:'תאריך הסף לא הוגדר'} · ארכוב משנה נראות בלבד, ואינו ביטול הסכם או סילוק חוב.</p>}
   <div className="max-h-96 overflow-auto"><table className="w-full text-right text-xs"><thead><tr>{['בחירה','מזהה','לקוח','סוג','נוצר','חתימה','תשלום','גבייה חוזרת','התאמה / חסימה'].map(x=><th key={x} className="p-2 text-gray-400">{x}</th>)}</tr></thead><tbody>{preview.rows.map(a=><tr key={a.id} className="border-t border-gray-800 text-gray-300">
    <td className="p-2"><input type="checkbox" aria-label={`בחירת ${a.customerName} ${a.id}`} disabled={pending||!a.eligible||(!selected.has(a.id)&&selected.size>=50)} checked={selected.has(a.id)} onChange={e=>{const next=new Set(selected);if(e.target.checked)next.add(a.id);else next.delete(a.id);setSelected(next);}}/></td>
    <td className="p-2 break-all" dir="ltr">{a.id}</td><td className="p-2">{a.customerName}</td><td className="p-2">{a.kind==='ONE_TIME'?'חד־פעמי':'מנוי'}</td><td className="p-2 whitespace-nowrap">{new Date(a.createdAt).toLocaleDateString('he-IL')}</td>
    <td className="p-2">{a.signature===null?'לא ידוע':a.signature||a.status==='SIGNED'?'קיימת':'אין ראיה'}</td><td className="p-2">{a.payment===null?'לא ידוע':a.payment||a.paymentStatus!=='PENDING'?'קיימת ראיה / ניסיון':'אין ראיה'} ({a.paymentStatus})</td><td className="p-2">{a.recurring===null?'לא ידוע':a.recurring?'קיים קשר':'אין קשר שמור'}</td><td className="p-2">{a.eligible?'מתאים':a.reasons.map(describe).join(' · ')}</td>
   </tr>)}</tbody></table></div>
   <label className="block text-xs text-gray-400">סיבת {preview.action==='ARCHIVE'?'ארכוב':'שחזור'}<textarea aria-label="סיבת פעולה" minLength={3} maxLength={500} disabled={pending} value={reason} onChange={e=>setReason(e.target.value)} className="mt-1 block w-full rounded-lg bg-gray-800 p-2 text-white"/></label>
   <div className="flex gap-2"><button type="button" disabled={pending||!selected.size||reason.trim().length<3} onClick={execute} className="rounded-lg bg-pink px-4 py-2 text-sm text-white disabled:opacity-40">{preview.action==='ARCHIVE'?'העבר לארכיון':'שחזר נראות'} ({selected.size})</button><button type="button" disabled={pending} onClick={()=>setPreview(null)} className="px-3 text-sm text-gray-400">סגור</button></div>
  </div>}
  {!!results.length&&<div role="status" className="space-y-1 text-xs text-gray-300">{results.map((r,i)=><p key={i}>{r.id??'פריט'} — {outcomeLabels[r.status]}: {describe(r.reason)}</p>)}</div>}
 </section>;
}
