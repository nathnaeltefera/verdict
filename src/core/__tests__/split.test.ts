import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LOMYAD, MESSANTA_COFFEE } from '../fixtures';
import { splitBill, UNASSIGNED } from '../split';
import { NO_TIP, type Bill } from '../types';

function bill(over: Partial<Bill> = {}): Bill {
  return {
    id: 'b1',
    createdAt: 0,
    updatedAt: 0,
    title: 'Test',
    receipt: MESSANTA_COFFEE,
    people: [
      { id: 'p1', name: 'Nathnael', colorIndex: 0 },
      { id: 'p2', name: 'Sara', colorIndex: 1 },
    ],
    assignments: {},
    tip: NO_TIP,
    settled: {},
    ...over,
  };
}

test('one person per item: each carries their own line plus a fair slice of service and VAT', () => {
  const result = splitBill(bill({ assignments: { m1: { p1: 1 }, m2: { p2: 1 } } }));
  const [a, b] = result.people;

  assert.equal(a.itemsSubtotal, 20300);
  assert.equal(b.itemsSubtotal, 37889);
  assert.equal(a.serviceCharge + b.serviceCharge, 2909);
  assert.equal(a.tax + b.tax, 9165);
  assert.equal(a.total + b.total, 70263);
  assert.equal(result.balanced, true);
  assert.equal(result.fullyAssigned, true);
});

test('a shared plate splits across everyone who ate it', () => {
  const result = splitBill(
    bill({
      people: [
        { id: 'p1', name: 'A', colorIndex: 0 },
        { id: 'p2', name: 'B', colorIndex: 1 },
        { id: 'p3', name: 'C', colorIndex: 2 },
      ],
      assignments: { m1: { p1: 1 }, m2: { p1: 1, p2: 1, p3: 1 } },
    }),
  );
  const cake = result.people.map((p) => p.lines.find((l) => l.itemId === 'm2')?.amount ?? 0);
  assert.equal(cake.reduce((x, y) => x + y, 0), 37889);
  assert.deepEqual(cake, [12630, 12630, 12629]); // the stray cent lands once, deterministically
  assert.equal(result.people.reduce((s, p) => s + p.total, 0), 70263);
  assert.equal(result.balanced, true);
});

test('unequal shares of one plate', () => {
  const result = splitBill(bill({ assignments: { m1: { p1: 1 }, m2: { p1: 3, p2: 1 } } }));
  const [a, b] = result.people;
  assert.equal(a.lines.find((l) => l.itemId === 'm2')!.amount, 28417);
  assert.equal(b.lines.find((l) => l.itemId === 'm2')!.amount, 9472);
  assert.equal(28417 + 9472, 37889);
  assert.equal(a.total + b.total, 70263);
});

test('someone who only ordered untaxed milk pays no VAT', () => {
  const result = splitBill(
    bill({
      receipt: LOMYAD,
      assignments: { l1: { p1: 1 }, l2: { p1: 1 }, l3: { p2: 1 } },
    }),
  );
  const [milkOnly, nutsOnly] = result.people;

  assert.equal(milkOnly.itemsSubtotal, 45960);
  assert.equal(milkOnly.tax, 0);
  assert.equal(milkOnly.total, 45960);

  assert.equal(nutsOnly.itemsSubtotal, 27328);
  assert.equal(nutsOnly.tax, 4099);
  assert.equal(nutsOnly.total, 31427);

  assert.equal(milkOnly.total + nutsOnly.total, 77387);
  assert.equal(result.balanced, true);
});

test('a mixed order pays VAT only on its taxable part', () => {
  const result = splitBill(
    bill({ receipt: LOMYAD, assignments: { l1: { p1: 1 }, l2: { p2: 1 }, l3: { p1: 1, p2: 1 } } }),
  );
  const [a, b] = result.people;
  assert.equal(a.taxableSubtotal, 13664);
  assert.equal(b.taxableSubtotal, 13664);
  assert.equal(a.tax + b.tax, 4099);
  assert.equal(a.total + b.total, 77387);
});

test('unclaimed items sit in their own bucket instead of being loaded onto the others', () => {
  const result = splitBill(bill({ assignments: { m1: { p1: 1 } } }));
  assert.equal(result.fullyAssigned, false);
  assert.equal(result.unassignedItems.length, 1);
  assert.equal(result.unassigned.personId, UNASSIGNED);
  assert.equal(result.unassigned.itemsSubtotal, 37889);
  assert.equal(result.people[0].itemsSubtotal, 20300);
  assert.equal(result.people[1].itemsSubtotal, 0);
  const everything = result.people.reduce((s, p) => s + p.total, 0) + result.unassigned.total;
  assert.equal(everything, 70263);
  assert.equal(result.balanced, true);
});

test('proportional tip tracks what each person ordered', () => {
  const result = splitBill(
    bill({
      assignments: { m1: { p1: 1 }, m2: { p2: 1 } },
      tip: { mode: 'percent', percent: 0.1, amount: 0, split: 'proportional' },
    }),
  );
  assert.equal(result.tipTotal, 5819);
  const [a, b] = result.people;
  assert.equal(a.tip + b.tip, 5819);
  assert.ok(b.tip > a.tip);
  assert.equal(a.total + b.total, 70263 + 5819);
  assert.equal(result.grandTotal, 76082);
});

test('an even tip ignores who ordered what', () => {
  const result = splitBill(
    bill({
      assignments: { m1: { p1: 1 }, m2: { p2: 1 } },
      tip: { mode: 'amount', percent: 0, amount: 10001, split: 'even' },
    }),
  );
  const [a, b] = result.people;
  assert.deepEqual([a.tip, b.tip], [5001, 5000]);
});

test('the whole bill split evenly across the table still ties out', () => {
  const people = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'].map((id, i) => ({ id, name: id, colorIndex: i }));
  const everyone = Object.fromEntries(people.map((p) => [p.id, 1]));
  const result = splitBill(
    bill({ people, assignments: { m1: { ...everyone }, m2: { ...everyone } } }),
  );
  assert.equal(result.people.reduce((s, p) => s + p.total, 0), 70263);
  assert.equal(result.balanced, true);
});

test('removing a person un-claims their items rather than corrupting the split', () => {
  const result = splitBill(
    bill({ people: [{ id: 'p1', name: 'A', colorIndex: 0 }], assignments: { m1: { p1: 1 }, m2: { p2: 1 } } }),
  );
  assert.equal(result.unassignedItems.length, 1);
  assert.equal(result.people[0].total + result.unassigned.total, 70263);
});

test('nothing assigned at all: everything lands in the unassigned bucket', () => {
  const result = splitBill(bill());
  assert.equal(result.people.every((p) => p.total === 0), true);
  assert.equal(result.unassigned.total, 70263);
  assert.equal(result.balanced, true);
});
