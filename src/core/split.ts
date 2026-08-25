import { allocate, sum } from './money';
import { computeTip, computeTotals, type BillTotals } from './totals';
import type { Bill, LineItem } from './types';

export const UNASSIGNED = '__unassigned__';

export type PersonLine = {
  itemId: string;
  description: string;
  /** Minor units this person carries for this line. */
  amount: number;
  /** How many ways the line was split. 1 means they had it to themselves. */
  ways: number;
  share: number;
  totalShares: number;
  taxable: boolean;
};

export type PersonShare = {
  personId: string;
  lines: PersonLine[];
  itemsSubtotal: number;
  taxableSubtotal: number;
  nonTaxableSubtotal: number;
  serviceCharge: number;
  tax: number;
  tip: number;
  total: number;
};

export type SplitResult = {
  totals: BillTotals;
  people: PersonShare[];
  /** What nobody has claimed yet, carried as its own bucket so real people are never overcharged. */
  unassigned: PersonShare;
  unassignedItems: LineItem[];
  tipTotal: number;
  /** Bill total plus tip. */
  grandTotal: number;
  /** True when every person's share sums back to the grand total, to the cent. */
  balanced: boolean;
  fullyAssigned: boolean;
  assignedItemCount: number;
  itemCount: number;
};

function emptyShare(personId: string): PersonShare {
  return {
    personId,
    lines: [],
    itemsSubtotal: 0,
    taxableSubtotal: 0,
    nonTaxableSubtotal: 0,
    serviceCharge: 0,
    tax: 0,
    tip: 0,
    total: 0,
  };
}

/** Claimants of an item, dropping zero/negative weights and anyone no longer in the party. */
function claimantsOf(bill: Bill, itemId: string): Array<{ personId: string; weight: number }> {
  const row = bill.assignments[itemId] ?? {};
  const known = new Set(bill.people.map((p) => p.id));
  return Object.entries(row)
    .filter(([personId, weight]) => known.has(personId) && Number.isFinite(weight) && weight > 0)
    .map(([personId, weight]) => ({ personId, weight }));
}

/**
 * Work out what everybody owes.
 *
 * Every division goes through `allocate`, so each stage sums back to the exact
 * printed figure — no drifting half-cents, and no "someone has to cover the
 * extra 1 cent" at the table.
 *
 *   1. Each line is split across its claimants by share weight.
 *   2. Service charge follows the pile the till actually charged it on.
 *   3. VAT follows each person's taxable spend only — order only untaxed milk
 *      and you pay no VAT, which is the whole point of tracking (N) lines.
 *   4. Tip goes on top, proportionally or evenly, as chosen.
 */
export function splitBill(bill: Bill): SplitResult {
  const totals = computeTotals(bill.receipt, bill.serviceChargeRateOverride);
  const items = bill.receipt.items;

  const shares = new Map<string, PersonShare>();
  for (const person of bill.people) shares.set(person.id, emptyShare(person.id));
  const unassigned = emptyShare(UNASSIGNED);
  const unassignedItems: LineItem[] = [];

  // 1. Line items.
  for (const item of items) {
    const claimants = claimantsOf(bill, item.id);
    if (claimants.length === 0) {
      unassignedItems.push(item);
      unassigned.lines.push({
        itemId: item.id,
        description: item.description,
        amount: item.amount,
        ways: 0,
        share: 0,
        totalShares: 0,
        taxable: item.taxable,
      });
      unassigned.itemsSubtotal += item.amount;
      if (item.taxable) unassigned.taxableSubtotal += item.amount;
      else unassigned.nonTaxableSubtotal += item.amount;
      continue;
    }

    const weights = claimants.map((c) => c.weight);
    const totalShares = sum(weights);
    const cents = allocate(item.amount, weights);

    claimants.forEach((claimant, index) => {
      const share = shares.get(claimant.personId);
      if (!share) return;
      const amount = cents[index];
      share.lines.push({
        itemId: item.id,
        description: item.description,
        amount,
        ways: claimants.length,
        share: claimant.weight,
        totalShares,
        taxable: item.taxable,
      });
      share.itemsSubtotal += amount;
      if (item.taxable) share.taxableSubtotal += amount;
      else share.nonTaxableSubtotal += amount;
    });
  }

  const buckets: PersonShare[] = [...bill.people.map((p) => shares.get(p.id)!), unassigned];

  // 2. Service charge, weighted by whichever pile the till charged it on.
  const serviceWeights = buckets.map((b) => {
    if (totals.service.basis === 'taxable-items') return b.taxableSubtotal;
    if (totals.service.basis === 'non-taxable-items') return b.nonTaxableSubtotal;
    return b.itemsSubtotal;
  });
  const serviceShares = allocate(totals.service.amount, serviceWeights);
  buckets.forEach((b, i) => {
    b.serviceCharge = serviceShares[i];
  });

  // 3. VAT, weighted by taxable spend only.
  //    A person's taxable base is their taxable items plus the service charge
  //    riding on them — and that is a constant multiple of their taxable items,
  //    so weighting by taxable items alone gives the same, exact answer.
  const taxShares = allocate(totals.taxAmount, buckets.map((b) => b.taxableSubtotal));
  buckets.forEach((b, i) => {
    b.tax = taxShares[i];
  });

  // 4. Tip, on top, among actual people only.
  const tipTotal = computeTip(bill.tip.mode, bill.tip.percent, bill.tip.amount, totals.itemsSubtotal);
  const people = bill.people.map((p) => shares.get(p.id)!);
  const tipWeights =
    bill.tip.split === 'even' ? people.map(() => 1) : people.map((p) => p.itemsSubtotal);
  const tipShares = allocate(tipTotal, tipWeights);
  people.forEach((p, i) => {
    p.tip = tipShares[i] ?? 0;
  });

  for (const bucket of buckets) {
    bucket.total = bucket.itemsSubtotal + bucket.serviceCharge + bucket.tax + bucket.tip;
  }

  const grandTotal = totals.total + tipTotal;
  const balanced = sum(buckets.map((b) => b.total)) === grandTotal;

  return {
    totals,
    people,
    unassigned,
    unassignedItems,
    tipTotal,
    grandTotal,
    balanced,
    fullyAssigned: unassignedItems.length === 0,
    assignedItemCount: items.length - unassignedItems.length,
    itemCount: items.length,
  };
}

/** Convenience for the assign screen: what one line costs each of its claimants right now. */
export function previewLineSplit(bill: Bill, item: LineItem): Array<{ personId: string; amount: number }> {
  const claimants = claimantsOf(bill, item.id);
  if (claimants.length === 0) return [];
  const cents = allocate(item.amount, claimants.map((c) => c.weight));
  return claimants.map((c, i) => ({ personId: c.personId, amount: cents[i] }));
}
