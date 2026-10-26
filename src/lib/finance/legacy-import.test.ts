import assert from 'node:assert/strict';
import test from 'node:test';
import * as imports from './legacy-import';

const client = { id: 'legacy-example', name: 'Existing identity', partner: 'personal', monthlyAmount: 42, archivedAt: new Date('2026-01-01'), cardcomAccountIds: [730001], products: [], agreements: [] };
const evidence = { accountId: 730001, recurringId: null, name: 'Imported label', amountMinor: 4200, currency: 'ILS', financeBook: 'PRIVATE' as const };

test('legacy private product preserves archive and does not fabricate an agreement', () => {
    const [plan] = imports.planLegacyProducts([client]);
    assert.equal(plan.data.financeBook, 'PRIVATE');
    assert.equal(plan.data.agreementId, null);
    assert.equal(plan.data.archivedAt, client.archivedAt);
    assert.equal(plan.data.monthlyAmount, 42);
});
test('existing products make repeated import idempotent', () => {
    assert.equal(imports.planLegacyProducts([{ ...client, products: [{ id: 'existing' }] }]).length, 0);
});
test('explicit foreign currency evidence prevents an invented ILS forecast', () => {
    const [plan] = imports.planLegacyProducts([client], [{ ...evidence, currency: 'EUR', amountMinor: 2700 }]);
    assert.equal(plan.data.monthlyAmount, null);
    assert.match(plan.data.notes, /EUR/);
    assert.doesNotMatch(plan.data.notes, /2700/);
});
test('a personal manifest does not clear unrelated shared ILS forecasts', () => {
    const [plan] = imports.planLegacyProducts([{ ...client, partner: 'fuzion', cardcomAccountIds: [730099] }], [evidence]);
    assert.equal(plan.data.financeBook, 'SHARED');
    assert.equal(plan.data.monthlyAmount, 42);
});
test('mixed legacy financial attribution remains unassigned', () => {
    const [plan] = imports.planLegacyProducts([{ ...client, agreements: [{ id: 'private', financeBook: 'PRIVATE' }, { id: 'shared', financeBook: 'SHARED' }] }]);
    assert.equal(plan.data.financeBook, 'UNASSIGNED');
    assert.equal(plan.data.agreementId, null);
});
test('a manifest is validated without exposing its private values in errors', () => {
    assert.equal(typeof imports.parseLegacyImportManifest, 'function');
    assert.deepEqual(imports.parseLegacyImportManifest([evidence]), [{ ...evidence, createIfMissing: false }]);
    for (const input of [null, [], [{ ...evidence, accountId: -1 }], [{ ...evidence, currency: 'unknown' }], [{ ...evidence, amountMinor: 1.5 }], [{ ...evidence, financeBook: 'UNASSIGNED' }], [evidence, { ...evidence, currency: 'USD' }]]) {
        assert.throws(() => imports.parseLegacyImportManifest(input), /^Error: Invalid private import manifest$/);
    }
});
test('a missing account requires explicit owner approval before creation', () => {
    assert.equal(typeof imports.planPersonalImport, 'function');
    assert.deepEqual(imports.planPersonalImport([], [evidence]), [{ type: 'REVIEW_NO_WRITE', accountId: evidence.accountId }]);
    const [plan] = imports.planPersonalImport([], [{ ...evidence, createIfMissing: true }]);
    assert.equal(plan.type, 'CREATE_APPROVED');
    if (plan.type === 'CREATE_APPROVED') {
        assert.equal(plan.clientId, `legacy-cardcom-account-${evidence.accountId}`);
        assert.equal(plan.evidence.name, evidence.name);
    }
});
test('exact linked import preserves the existing client identity', () => {
    assert.equal(typeof imports.planPersonalImport, 'function');
    const [plan] = imports.planPersonalImport([client], [evidence]);
    assert.equal(plan.type, 'EXISTING');
    if (plan.type === 'EXISTING') {
        assert.equal(plan.clientId, client.id);
        assert.equal(plan.products[0].data.name, client.name);
        assert.equal(plan.products[0].data.archivedAt, client.archivedAt);
    }
});
test('import refuses ambiguous links and contradictions with an existing financial book', () => {
    assert.equal(typeof imports.planPersonalImport, 'function');
    assert.throws(() => imports.planPersonalImport([client, { ...client, id: 'duplicate' }], [evidence]), /conflicting exact client mappings/);
    assert.throws(() => imports.planPersonalImport([{ ...client, partner: 'fuzion' }], [evidence]), /contradicts stored book/);
});
