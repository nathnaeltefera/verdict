import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LOMYAD, MESSANTA_COFFEE } from '../fixtures';
import { inferServiceCharge, manualServiceCharge } from '../serviceCharge';
import { computeTotals } from '../totals';

test('Messanta: 5% service charge is derived, not assumed', () => {
  const t = computeTotals(MESSANTA_COFFEE);
  assert.equal(t.itemsSubtotal, 58189);
  assert.equal(t.service.amount, 2909);
  assert.equal(t.service.rate, 0.05);
  assert.equal(t.service.source, 'matched-common-rate');
  assert.equal(t.service.verified, true);
  assert.equal(t.service.label, '5% service charge');
  assert.equal(t.taxableBase, 61098);
  assert.equal(t.taxAmount, 9165);
  assert.equal(t.total, 70263);
  assert.equal(t.reconciliation.ok, true);
  assert.equal(t.reconciliation.delta, 0);
});

test('Lomyad: no service charge, and the (N) lines stay out of the VAT base', () => {
  const t = computeTotals(LOMYAD);
  assert.equal(t.itemsSubtotal, 73288);
  assert.equal(t.nonTaxableItems, 45960);
  assert.equal(t.taxableItems, 27328);
  assert.equal(t.service.amount, 0);
  assert.equal(t.service.source, 'none');
  assert.equal(t.taxableBase, 27328);
  assert.equal(t.taxAmount, 4099);
  assert.equal(t.total, 77387);
  assert.equal(t.reconciliation.ok, true);
});

test('a different shop, a different rate — 10% and 2% are read straight off the paper', () => {
  const ten = inferServiceCharge(MESSANTA_COFFEE.items, 5819);
  assert.equal(ten.rate, 0.1);
  assert.equal(ten.label, '10% service charge');

  const two = inferServiceCharge(MESSANTA_COFFEE.items, 1164);
  assert.equal(two.rate, 0.02);
  assert.equal(two.label, '2% service charge');
});

test('an odd rate is reported honestly rather than snapped to something tidy', () => {
  const odd = inferServiceCharge(MESSANTA_COFFEE.items, 4000);
  assert.equal(odd.source, 'derived-exact');
  assert.ok(Math.abs(odd.rate - 4000 / 58189) < 1e-12);
  assert.equal(odd.amount, 4000);
});

test('service charge levied on the taxable items only is detected as such', () => {
  // 5% of Lomyad's taxable pile (27328) is 1366; 5% of everything would be 3664.
  const s = inferServiceCharge(LOMYAD.items, 1366);
  assert.equal(s.basis, 'taxable-items');
  assert.equal(s.rate, 0.05);
  assert.equal(s.base, 27328);
});

test('a printed rate wins over inference', () => {
  const s = inferServiceCharge(MESSANTA_COFFEE.items, 2909, 0.05);
  assert.equal(s.source, 'printed-rate');
  assert.equal(s.rate, 0.05);
});

test('overriding the rate by hand re-does the whole bill', () => {
  const t = computeTotals(MESSANTA_COFFEE, 0.1);
  assert.equal(t.service.amount, 5819);
  assert.equal(t.taxableBase, 64008);
  assert.equal(t.taxAmount, 9601);
  assert.equal(t.total, 58189 + 5819 + 9601);
  assert.equal(t.reconciliation.ok, false); // no longer matches the paper, and says so
});

test('turning the service charge off by hand zeroes it', () => {
  const s = manualServiceCharge(MESSANTA_COFFEE.items, 0);
  assert.equal(s.amount, 0);
  assert.equal(s.label, 'No service charge');
});

test('a misread line is caught by reconciliation', () => {
  const broken = {
    ...MESSANTA_COFFEE,
    items: [MESSANTA_COFFEE.items[0], { ...MESSANTA_COFFEE.items[1], amount: 37000 }],
  };
  const t = computeTotals(broken);
  assert.equal(t.reconciliation.ok, false);
  assert.ok(t.reconciliation.delta !== 0);
});
