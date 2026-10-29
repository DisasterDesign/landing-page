/** Owner-only supplier evidence. Usage is never silently treated as a paid invoice. */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
type BillingRow = { id?: string; amount?: number; currency?: string; occurred_at?: string; status?: string; type?: string; invoice_id?: string };
export interface BillingEvidence {
  providerId: string; invoiceId: string | null; amountMinor: number; currency: string;
  ilsAmountMinor: number | null; occurredAt: string; status: string; type: string;
}
function integerMinor(value: number): number {
  const minor = Math.round((value + Math.sign(value) * Number.EPSILON) * 100);
  if (!Number.isFinite(value) || !Number.isSafeInteger(minor)) throw new Error("Invalid provider amount");
  return minor;
}
export function normalizeCloudflareBilling(rows: BillingRow[]): BillingEvidence[] {
  const result = new Map<string,BillingEvidence>();
  for (const row of rows) {
    if (!row.id || typeof row.amount !== "number" || !/^[a-z]{3}$/i.test(row.currency ?? "") || !row.occurred_at || !Number.isFinite(Date.parse(row.occurred_at))) throw new Error("Incomplete Cloudflare billing evidence");
    const currency=row.currency!.toUpperCase();
    const amountMinor=integerMinor(row.amount);
    const evidence={providerId:row.id,invoiceId:row.invoice_id??null,amountMinor,currency,ilsAmountMinor:currency==="ILS"?amountMinor:null,occurredAt:new Date(row.occurred_at).toISOString(),status:row.status??"UNKNOWN",type:row.type??"UNKNOWN"};
    const old=result.get(row.id);
    if(old && JSON.stringify(old)!==JSON.stringify(evidence)) throw new Error("Conflicting Cloudflare billing evidence");
    result.set(row.id,evidence);
  }
  return [...result.values()];
}
export function failedSourceRefresh<T extends object>(previous:T, now:Date) {
  return {...previous,status:"ERROR",lastAttemptAt:now,error:"עדכון הספק נכשל; הנתונים האחרונים נשמרו"};
}
export function neonUsageEvidence(projects: unknown[]) {
  return {kind:"USAGE" as const,estimate:true,amountMinor:null,currency:null,projects};
}
export async function fetchCloudflareBilling(input:{accountId:string;token:string;from:Date;to:Date},fetcher:Fetcher=fetch):Promise<BillingEvidence[]> {
  const rows:BillingRow[]=[];
  const pages=new Set<string>();
  for(let page=1;page<=20;page++){
    const url=new URL(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(input.accountId)}/billing/history`);
    url.searchParams.set("page",String(page));url.searchParams.set("per_page","100");
    const res=await fetcher(url.toString(),{headers:{Authorization:`Bearer ${input.token}`},cache:"no-store",signal:AbortSignal.timeout(15000)});
    if(!res.ok)throw new Error(`Cloudflare HTTP ${res.status}`);
    const body=await res.json() as {success:boolean;result?:BillingRow[];result_info?:{total_pages?:number}};
    if(body.success!==true||!Array.isArray(body.result))throw new Error("Invalid Cloudflare response");
    const fingerprint=body.result.map(r=>r.id).join("|");
    if(fingerprint&&pages.has(fingerprint))throw new Error("Cloudflare pagination repeated");
    pages.add(fingerprint);rows.push(...body.result);
    const total=body.result_info?.total_pages;
    if((total!==undefined&&page>=total)||(total===undefined&&body.result.length<100)){
      return normalizeCloudflareBilling(rows).filter(r=>Date.parse(r.occurredAt)>=input.from.getTime()&&Date.parse(r.occurredAt)<=input.to.getTime());
    }
  }
  throw new Error("Cloudflare pagination incomplete");
}
export async function fetchNeonConsumption(input:{orgId:string;token:string;from:Date;to:Date},fetcher:Fetcher=fetch){
  const projects:unknown[]=[];let cursor:string|undefined;
  const cursors=new Set<string>();
  for(let page=0;page<20;page++){
    const url=new URL("https://console.neon.tech/api/v2/consumption_history/v2/projects");
    url.searchParams.set("org_id",input.orgId);url.searchParams.set("from",input.from.toISOString());url.searchParams.set("to",input.to.toISOString());url.searchParams.set("granularity","daily");url.searchParams.set("metrics","compute_unit_seconds,root_branch_bytes_month,public_network_transfer_bytes");url.searchParams.set("limit","100");if(cursor)url.searchParams.set("cursor",cursor);
    const res=await fetcher(url.toString(),{headers:{Authorization:`Bearer ${input.token}`},cache:"no-store",signal:AbortSignal.timeout(15000)});
    if(!res.ok)throw new Error(`Neon HTTP ${res.status}`);
    const body=await res.json() as {projects?:unknown[];pagination?:{cursor?:string}};
    if(!Array.isArray(body.projects))throw new Error("Invalid Neon response");
    projects.push(...body.projects);cursor=body.pagination?.cursor;
    if(!cursor)return neonUsageEvidence(projects);
    if(cursors.has(cursor))throw new Error("Neon pagination repeated");cursors.add(cursor);
  }
  throw new Error("Neon pagination incomplete");
}
export function financeSourceConfiguration(env:NodeJS.ProcessEnv=process.env){
  return [
    {key:"provider:cloudflare",name:"Cloudflare",configured:!!(env.CLOUDFLARE_FINANCE_API_TOKEN&&env.CLOUDFLARE_FINANCE_ACCOUNT_ID),kind:"BILLING_HISTORY"},
    {key:"provider:neon",name:"Neon",configured:!!(env.NEON_FINANCE_API_KEY&&env.NEON_FINANCE_ORG_ID),kind:"USAGE"},
    ...["Hetzner","Vercel","Resend"].map(name=>({key:`provider:${name.toLowerCase()}`,name,configured:false,kind:"MANUAL_INVOICE"})),
  ];
}
