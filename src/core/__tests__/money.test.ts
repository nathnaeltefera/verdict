import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allocate, formatMoney, formatRate, roundHalfUp, toMinor } from '../money';

test('allocate always sums back to the total', () => {
  const cases: Array<[number, number[]]> = [
    [10000, [1, 1, 1]],
    [1, [1, 1, 1]],
    [2, [1, 1, 1]],
    [27328, [1, 1, 1, 1, 1, 1, 1]],
    [70263, [20300, 37889, 0]],
    [999, [3, 1]],
    [100, [0, 0, 0]],
    [0, [1, 2, 3]],
  ];
  for (const [total, weights] of cases) {
    const parts = allocate(total, weights);
    assert.equal(parts.reduce((a, b) => a + b, 0), total, `weights ${weights.join(',')}`);
    assert.equal(parts.length, weights.length);
  }
});

test('allocate splits an odd amount three ways without losing a cent', () => {
  assert.deepEqual(allocate(1000, [1, 1, 1]), [334, 333, 333]);
});

test('allocate falls back to an even split when every weight is zero', () => {
  assert.deepEqual(allocate(300, [0, 0, 0]), [100, 100, 100]);
});

test('allocate handles an empty party', () => {
  assert.deepEqual(allocate(500, []), []);
});

test('allocate respects unequal shares', () => {
  assert.deepEqual(allocate(30000, [2, 1]), [20000, 10000]);
});

test('roundHalfUp rounds away from zero', () => {
  assert.equal(roundHalfUp(9164.7), 9165);
  assert.equal(roundHalfUp(4099.2), 4099);
  assert.equal(roundHalfUp(0.5), 1);
  assert.equal(roundHalfUp(-0.5), -1);
});

test('toMinor strips currency noise', () => {
  assert.equal(toMinor('*203.00'), 20300);
  assert.equal(toMinor('378.89'), 37889);
  assert.equal(toMinor(773.87), 77387);
});

test('formatting', () => {
  assert.equal(formatRate(0.05), '5%');
  assert.equal(formatRate(0.125), '12.5%');
  assert.equal(formatMoney(70263), 'Br 702.63');
  assert.equal(formatMoney(123456789), 'Br 1,234,567.89');
});
