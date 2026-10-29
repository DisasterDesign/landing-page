import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correctedBusinessNameContent, correctionSchema, assertAgreementSnapshot } from './business-name';
test('only business cell changes, escaped safely; terms and contact remain identical', () => {
 const html = '<p>Old</p><tr><th>שם עסק</th><td>Old</td></tr><p>99; terms; contact</p>';
 assert.equal(correctedBusinessNameContent(html, 'Old', '<New>'), '<p>Old</p><tr><th>שם עסק</th><td>&lt;New&gt;</td></tr><p>99; terms; contact</p>');
 assert.throws(() => correctedBusinessNameContent(html, 'Mismatch', 'New'));
});
test('reject invalid input and mixed financial changes', () => {
 for(const businessName of ['', ' ', 'x'.repeat(201), '<script>', 'a\nB']) assert.equal(correctionSchema.safeParse({businessName, expectedUpdatedAt:'2026-10-29T10:00:00.000Z'}).success,false);
 assert.equal(correctionSchema.safeParse({businessName:'New', expectedUpdatedAt:'2026-10-29T10:00:00.000Z', monthlyPrice:1}).success,false);
});
test('stale or missing snapshots cannot overwrite a document', () => {
 const date = new Date('2026-10-29T10:00:00Z');
 assert.doesNotThrow(()=>assertAgreementSnapshot(date,date.toISOString()));
 assert.throws(()=>assertAgreementSnapshot(date,undefined));
 assert.throws(()=>assertAgreementSnapshot(date,'2026-10-28T10:00:00.000Z'));
});
