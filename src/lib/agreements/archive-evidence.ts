import type { ArchiveDependencies, ArchiveRecord } from './archive-policy';
const signatureFields=['signedAt','signatureData','signedIp','signedUserAgent'];
const paymentFields=['paidAt','paidAmount','invoiceNumber','paymentId','paymentUrl','cardcomDealId','cardcomVerifiedLowProfileId','cardcomVerifiedReturnValue','cardcomVerifiedTransactionId','cardcomVerifiedAmount','cardcomPaymentVerifiedAt'];
const recurringFields=['cardcomToken','cardcomRecurringId','cardcomLowProfileId','cardcomAccountId','cardcomIsActive','cardcomNextBillDate','cardcomSyncedAt'];
function trace(row: Record<string, unknown>, fields: string[]): boolean | null {
  // A zero amount, false provider flag, blank/incomplete identifier or absent
  // schema column is not affirmative proof that cleanup is safe.
  if(fields.some(key=>row[key]===undefined)) return null;
  return fields.some(key=>row[key]!==null);
}
export function fromArchiveRow(row: Record<string,unknown>, dependencies: ArchiveDependencies): ArchiveRecord {
 return {
  id:String(row.id),customerName:String(row.customerName),kind:String(row.kind),status:String(row.status),paymentStatus:String(row.paymentStatus),
  createdAt:row.createdAt as Date,updatedAt:row.updatedAt as Date,archivedAt:row.archivedAt as Date|null,archiveVersion:row.archiveVersion as number,
  signature:trace(row,signatureFields),payment:trace(row,paymentFields),recurring:trace(row,recurringFields),linkedClient:row.clientId!==null,
  dependencies,
 };
}
