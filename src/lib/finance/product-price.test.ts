import assert from 'node:assert/strict';
import test from 'node:test';
import * as price from './product-price';

const legacy = { monthlyAmount: 250, monthlyOriginalAmount: null, monthlyOriginalCurrency: null };

test('foreign monthly price preserves original currency without manufacturing an ILS value', () => {
  const result = price.planPriceCorrection(legacy, { amount: 75, currency: 'USD', reason: 'Owner confirmed current price', source: 'Owner confirmation' });
  assert.deepEqual(result.after, { monthlyAmount: null, monthlyOriginalAmount: 75, monthlyOriginalCurrency: 'USD' });
  assert.deepEqual(result.before, legacy);
});

test('ILS original price can be valued exactly without FX', () => {
  assert.equal(price.planPriceCorrection(legacy, { amount: 118.25, currency: 'ILS', reason: 'Reviewed', source: 'Owner confirmation' }).after.monthlyAmount, 118.25);
});

test('prices reject unsupported currencies, coercion, negatives, nonfinite or fractional minor units', () => {
  for (const amount of [-1, NaN, Infinity, '75', '', null, 1.234]) {
    assert.throws(() => price.planPriceCorrection(legacy, { amount, currency: 'USD', reason: 'Reviewed', source: 'Owner' }));
  }
  for (const currency of ['usd', 'EUR', '', null]) {
    assert.throws(() => price.planPriceCorrection(legacy, { amount: 75, currency, reason: 'Reviewed', source: 'Owner' }));
  }
  assert.throws(() => price.planPriceCorrection(legacy, { amount: 75, currency: 'USD', reason: '', source: 'Owner' }));
  assert.throws(() => price.planPriceCorrection(legacy, { amount: 75, currency: 'USD', reason: 'Reviewed', source: '' }));
});

test('undo reconstructs the previous ILS valuation and null original fields exactly', () => {
  const revision = price.planPriceCorrection(legacy, { amount: 75, currency: 'USD', reason: 'Reviewed', source: 'Owner' });
  assert.deepEqual(price.readPriceSnapshot(JSON.parse(JSON.stringify(revision.before))), legacy);
  assert.throws(() => price.readPriceSnapshot({ monthlyAmount: 250, monthlyOriginalAmount: 75, monthlyOriginalCurrency: 'USD' }));
});

test('legacy fractional ILS values can be corrected and reconstructed without rounding history', () => {
  const existing = { ...legacy, monthlyAmount: 118.1234 };
  const result = price.planPriceCorrection(existing, { amount: 75, currency: 'USD', reason: 'Reviewed', source: 'Owner' });
  assert.deepEqual(result.before, existing);
  assert.deepEqual(price.readPriceSnapshot(result.before), existing);
});
