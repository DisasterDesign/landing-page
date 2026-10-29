export interface ForecastWarning {
  code: 'CLIENT_PRODUCT_DRIFT' | 'UNVALUED_PRODUCT' | 'INACTIVE_PRODUCT_AGREEMENT' | 'UNVERIFIED_COLLECTION_LINK';
  clientName: string;
  message: string;
}
interface AuditedClient {
  name: string;
  monthlyAmount: number | null;
  cardcomAccountIds?: number[];
  products: { agreementId?: string | null; monthlyAmount: number | null; financeBook: string; status: string; archivedAt: Date | null }[];
  agreements: { id: string; cardcomIsActive?: boolean | null }[];
}
/** Diagnostics only: never use an old client rollup or agreement to replace product prices. */
export function auditForecastClient(client: AuditedClient, selected: (book: string) => boolean, mayCompareFullClient: boolean): ForecastWarning[] {
  const products = client.products.filter(p => !p.archivedAt && p.status === 'בוצע');
  const visible = products.filter(p => selected(p.financeBook));
  const warnings: ForecastWarning[] = [];
  if (visible.some(p => p.monthlyAmount == null || !Number.isFinite(p.monthlyAmount))) {
    warnings.push({ code: 'UNVALUED_PRODUCT', clientName: client.name, message: 'מוצר ללא סכום חודשי ידוע בשקלים אינו נכלל בתחזית.' });
  }
  // A shared viewer cannot compare a complete client rollup containing private products.
  if (mayCompareFullClient && products.length > 0 && products.every(p => selected(p.financeBook) && p.monthlyAmount != null && Number.isFinite(p.monthlyAmount)) && client.monthlyAmount != null && Number.isFinite(client.monthlyAmount)) {
    const productMinor = products.reduce((total, p) => total + Math.round(p.monthlyAmount! * 100), 0);
    if (Math.round(client.monthlyAmount * 100) !== productMinor) {
      warnings.push({ code: 'CLIENT_PRODUCT_DRIFT', clientName: client.name, message: 'הסכום בכרטיס הלקוח שונה מסכום המוצרים הפעילים. התחזית מחושבת לפי המוצרים.' });
    }
  }
  if (mayCompareFullClient && !(client.cardcomAccountIds ?? []).some(id => Number.isSafeInteger(id) && id > 0) &&
    visible.some(p => !p.agreementId || !client.agreements.some(a => a.id === p.agreementId))) {
    warnings.push({ code: 'UNVERIFIED_COLLECTION_LINK', clientName: client.name, message: 'מוצר פעיל ללא קישור שמור להסכם וללא חשבון ספק מקושר. אמצעי הגבייה דורש בדיקה; אין בכך הוכחה לאי־תשלום.' });
  }
  if (visible.some(p => p.agreementId && client.agreements.some(a => a.id === p.agreementId && a.cardcomIsActive === false))) {
    warnings.push({ code: 'INACTIVE_PRODUCT_AGREEMENT', clientName: client.name, message: 'מוצר נספר בתחזית עם הסכם המקושר להוראת קבע לא פעילה. ייתכן שקיימת הוראה חלופית; גבייה פעילה אינה מאומתת כאן.' });
  }
  return warnings;
}
