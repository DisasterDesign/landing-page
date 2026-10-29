import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as dismissal from '../debtor-dismissal';
import * as evidence from '../cardcom-debtor-evidence';

test('opening an old stored debtor report reads data without posting a provider refresh',async()=>{
 const page=process.env.DEBTOR_PAGE_TEST_SOURCE ?? new URL('../../app/admin/(dashboard)/finance/debtors/page.tsx',import.meta.url);
 const code=ts.transpileModule(readFileSync(page,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const effects:(()=>unknown)[]=[];const requests:{url:string;method:string}[]=[];
 const modules:Record<string,unknown>={
  react:{useState:<T,>(value:T|(()=>T))=>[typeof value==='function'?(value as ()=>T)():value,()=>{}],useCallback:(fn:unknown)=>fn,useRef:(value:unknown)=>({current:value}),useEffect:(fn:()=>unknown)=>effects.push(fn)},
  'react/jsx-runtime':{jsx:()=>null,jsxs:()=>null},'next/link':{},'react-hot-toast':{default:{error:()=>{},success:()=>{}}},
  '@/components/ui/PullToRefresh':{},'@/components/ui/ConfirmSheet':{},'@/lib/debtor-dismissal':dismissal,'@/lib/cardcom-debtor-evidence':evidence,
 };
 const exported:{default?:()=>unknown}={};
 runInNewContext(`(function(exports,require){${code}\n})`,{fetch:async(url:string,options?:{method?:string})=>{requests.push({url,method:options?.method??'GET'});return {ok:true,json:async()=>({terminalDebtors:[],settledDebtors:[],dismissedDebtors:[],inactiveOrders:[],problemCharges:[],snapshotUpdatedAt:'2020-01-01T00:00:00Z'})};},Date,console})(exported,(id:string)=>{if(id in modules)return modules[id];throw Error(`Unexpected dependency ${id}`);});
 assert.ok(exported.default);exported.default();for(const effect of effects)await effect();
 for(let i=0;i<6;i++)await Promise.resolve();
 assert.deepEqual(requests,[{url:'/api/finance/debtors',method:'GET'}]);
});
