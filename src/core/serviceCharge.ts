import { allocate, formatRate, roundHalfUp, sum } from './money';
import type { LineItem } from './types';

/**
 * Which pile of items the till multiplied to get the service charge.
 * Receipts almost never say, so we work it out by trying each and seeing
 * which one reproduces the printed figure to the cent.
 */
export type ServiceChargeBasis = 'all-items' | 'taxable-items' | 'non-taxable-items' | 'unknown';

export type ServiceCharge = {
  /** Minor units actually charged. */
  amount: number;
  /** Fraction, e.g. 0.05. */
  rate: number;
  basis: ServiceChargeBasis;
  /** Minor units the rate was applied to. */
  base: number;
  source: 'none' | 'printed-rate' | 'matched-common-rate' | 'derived-exact' | 'manual';
  /** True when rate x base reproduces the printed amount to within a cent. */
  verified: boolean;
  label: string;
  note: string;
};

/**
 * Rates we see in the wild on Addis restaurant and cafe bills. We only snap to
 * one of these when it reproduces the printed amount exactly, so snapping can
 * never invent a number the paper does not support.
 */
const COMMON_RATES = [0.02, 0.05, 0.1, 0.125, 0.15, 0.18, 0.2];

export const NO_SERVICE_CHARGE: ServiceCharge = {
  amount: 0,
  rate: 0,
  basis: 'unknown',
  base: 0,
  source: 'none',
  verified: true,
  label: 'No service charge',
  note: 'This receipt has no service charge or surcharge line.',
};

function basesFor(items: LineItem[]): Array<{ basis: ServiceChargeBasis; base: number }> {
  const all = sum(items.map((i) => i.amount));
  const taxable = sum(items.filter((i) => i.taxable).map((i) => i.amount));
  const nonTaxable = all - taxable;
  const candidates: Array<{ basis: ServiceChargeBasis; base: number }> = [
    { basis: 'all-items', base: all },
  ];
  // Only worth testing the narrower piles when they actually differ.
  if (taxable !== all) candidates.push({ basis: 'taxable-items', base: taxable });
  if (nonTaxable !== all) candidates.push({ basis: 'non-taxable-items', base: nonTaxable });
  return candidates.filter((c) => c.base > 0);
}

/**
 * Work out the service charge from what the receipt actually printed.
 *
 * The rate is never assumed: given a surcharge amount we divide it back out
 * against each plausible base and report the rate we can prove. Two receipts
 * from two shops on two nights can and do differ.
 */
export function inferServiceCharge(items: LineItem[], printedAmount?: number, printedRate?: number): ServiceCharge {
  const candidates = basesFor(items);

  // Case 1: the printer spelled the rate out and we can trust it directly.
  if (printedRate !== undefined && printedRate > 0) {
    const chosen = candidates.find((c) => printedAmount !== undefined && roundHalfUp(c.base * printedRate) === printedAmount)
      ?? candidates[0];
    const base = chosen?.base ?? 0;
    const amount = printedAmount ?? roundHalfUp(base * printedRate);
    return {
      amount,
      rate: printedRate,
      basis: chosen?.basis ?? 'unknown',
      base,
      source: 'printed-rate',
      verified: roundHalfUp(base * printedRate) === amount,
      label: `${formatRate(printedRate)} service charge`,
      note: `Printed on the receipt as ${formatRate(printedRate)}.`,
    };
  }

  if (!printedAmount || printedAmount <= 0 || candidates.length === 0) {
    return NO_SERVICE_CHARGE;
  }

  // Case 2: only an amount. Try every (base, common rate) pair and keep the
  // first that lands on the printed figure to the cent.
  for (const candidate of candidates) {
    for (const rate of COMMON_RATES) {
      if (roundHalfUp(candidate.base * rate) === printedAmount) {
        return {
          amount: printedAmount,
          rate,
          basis: candidate.basis,
          base: candidate.base,
          source: 'matched-common-rate',
          verified: true,
          label: `${formatRate(rate)} service charge`,
          note: describeBasis(rate, candidate.basis),
        };
      }
    }
  }

  // Case 3: an unusual rate. Derive it exactly rather than forcing it to a
  // round number — better a truthful 4.87% than a tidy lie.
  const fallback = candidates[0];
  const exactRate = printedAmount / fallback.base;
  const verified = roundHalfUp(fallback.base * exactRate) === printedAmount;
  return {
    amount: printedAmount,
    rate: exactRate,
    basis: fallback.basis,
    base: fallback.base,
    source: 'derived-exact',
    verified,
    label: `${formatRate(exactRate)} service charge`,
    note: `Not a round rate — worked back from the printed amount over the ${basisWords(fallback.basis)}.`,
  };
}

function basisWords(basis: ServiceChargeBasis): string {
  if (basis === 'taxable-items') return 'taxable items only';
  if (basis === 'non-taxable-items') return 'non-taxable items only';
  if (basis === 'all-items') return 'whole item subtotal';
  return 'item subtotal';
}

function describeBasis(rate: number, basis: ServiceChargeBasis): string {
  return `Detected: ${formatRate(rate)} of the ${basisWords(basis)}.`;
}

/** Re-run the maths for a rate the user typed in themselves. */
export function manualServiceCharge(items: LineItem[], rate: number, basis: ServiceChargeBasis = 'all-items'): ServiceCharge {
  const candidate = basesFor(items).find((c) => c.basis === basis) ?? basesFor(items)[0];
  const base = candidate?.base ?? 0;
  const amount = roundHalfUp(base * rate);
  return {
    amount,
    rate,
    basis: candidate?.basis ?? 'unknown',
    base,
    source: 'manual',
    verified: true,
    label: rate > 0 ? `${formatRate(rate)} service charge` : 'No service charge',
    note: rate > 0 ? `Set by hand to ${formatRate(rate)}.` : 'Turned off by hand.',
  };
}

/**
 * How much of the service charge sits on the taxable side of the bill.
 * When the till charged it over everything, the taxable portion is the part
 * that rode on taxable items — which is what the tax was actually levied on.
 */
export function serviceChargeOnTaxable(service: ServiceCharge, items: LineItem[]): number {
  if (service.amount === 0) return 0;
  if (service.basis === 'taxable-items') return service.amount;
  if (service.basis === 'non-taxable-items') return 0;
  const taxable = sum(items.filter((i) => i.taxable).map((i) => i.amount));
  const nonTaxable = sum(items.filter((i) => !i.taxable).map((i) => i.amount));
  const [onTaxable] = allocate(service.amount, [taxable, nonTaxable]);
  return onTaxable;
}
