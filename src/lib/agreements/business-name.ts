import { z } from 'zod';
import { LeadDomainError } from '@/lib/leads/errors';
export const correctionSchema = z.object({
 businessName: z.string().trim().min(1).max(200).refine(v => !/[<>\u0000-\u001f\u007f]/.test(v)),
 expectedUpdatedAt: z.iso.datetime(),
}).strict();
export function assertAgreementSnapshot(updatedAt: Date, expected: unknown) {
 if (expected !== updatedAt.toISOString()) throw new LeadDomainError('CONFLICT', 'ההסכם השתנה. יש לטעון מחדש לפני שמירה או חתימה.');
}
const escape = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
/** Preserve the exact legal document, including its original terms and date. */
export function correctedBusinessNameContent(content: string, before: string | null, after: string) {
 const rows = ['שם עסק', 'Business Name'].map(label => `<tr><th>${label}</th><td>${escape(before || '-')}</td></tr>`);
 const matches = rows.filter(row => content.includes(row));
 if(matches.length !== 1 || content.split(matches[0]).length !== 2) throw new LeadDomainError('CONFLICT', 'מבנה המסמך אינו מוכר. נדרשת בדיקה לפני תיקון.');
 return content.replace(matches[0], matches[0].replace(`<td>${escape(before || '-')}</td>`, `<td>${escape(after)}</td>`));
}
