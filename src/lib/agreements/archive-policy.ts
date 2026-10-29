/** Archive is visibility metadata. Never use this policy in financial readers. */
export type ArchiveAction = 'ARCHIVE' | 'RESTORE';
export type ArchiveView = 'active' | 'archived' | 'all';
export interface ArchivePolicy {
  ready: boolean;
  protectedIds: readonly string[];
  before: Date;
}
export interface ArchiveDependencies {
  charges: number | null;
  receipts: number | null;
  commissions: number | null;
  products: number | null;
}
export interface ArchiveRecord {
  id: string;
  customerName: string;
  kind: string;
  status: string;
  paymentStatus: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  archiveVersion: number;
  signature: boolean | null;
  payment: boolean | null;
  recurring: boolean | null;
  linkedClient: boolean;
  dependencies: ArchiveDependencies;
}
export const ARCHIVE_REASONS: Record<string,string> = {
  POLICY_NOT_CONFIGURED:'תצורת הניקוי הפרטית אינה מוכנה',
  PROTECTED:'הסכם מוגן בתצורת הניקוי',
  TOO_RECENT:'ההסכם חדש מתאריך הסף',
  ALREADY_ARCHIVED:'ההסכם כבר בארכיון',
  SIGNATURE:'קיימת חתימה או ראיית חתימה',
  PAYMENT:'קיים תשלום, ניסיון תשלום או מצב תשלום לא ודאי',
  RECURRING:'קיים קשר לגבייה חוזרת או לספק תשלום',
  FINANCIAL_LINK:'קיימת היסטוריה כספית או זיקה למוצר/לקוח',
  UNKNOWN:'מידע חסר או סותר',
};
export function classifyArchive(a: ArchiveRecord, policy: ArchivePolicy): string[] {
  const reasons: string[]=[];
  if(!policy.ready) reasons.push('POLICY_NOT_CONFIGURED');
  if(policy.protectedIds.includes(a.id)) reasons.push('PROTECTED');
  if(!Number.isFinite(a.createdAt.getTime()) || !Number.isFinite(policy.before.getTime())) reasons.push('UNKNOWN');
  else if(a.createdAt >= policy.before) reasons.push('TOO_RECENT');
  if(a.archivedAt) reasons.push('ALREADY_ARCHIVED');
  if(a.signature || a.status==='SIGNED') reasons.push('SIGNATURE');
  if(a.payment || a.paymentStatus!=='PENDING') reasons.push('PAYMENT');
  if(a.recurring) reasons.push('RECURRING');
  const counts=Object.values(a.dependencies);
  if(a.linkedClient || counts.some(n=>n!=null&&n>0)) reasons.push('FINANCIAL_LINK');
  if(a.signature===null || a.payment===null || a.recurring===null || !['DRAFT','SENT','SIGNED','CANCELLED'].includes(a.status) || !['SUBSCRIPTION','ONE_TIME'].includes(a.kind) || counts.some(n=>n===null||!Number.isInteger(n)||n<0)) reasons.push('UNKNOWN');
  return [...new Set(reasons)];
}
/** Late payment/signature evidence must never disappear from the working list. */
export function workingArchiveVisible(a: Pick<ArchiveRecord,'archivedAt'|'signature'|'payment'|'recurring'|'status'|'paymentStatus'>): boolean {
  return !a.archivedAt || a.signature!==false || a.payment!==false || a.recurring!==false || a.status==='SIGNED' || a.paymentStatus!=='PENDING';
}
export function parseArchiveView(value: string | null): ArchiveView {
  return value==='archived'||value==='all' ? value : 'active';
}
