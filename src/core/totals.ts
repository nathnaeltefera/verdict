import { roundHalfUp, sum } from './money';
import { inferServiceCharge, manualServiceCharge, serviceChargeOnTaxable, type ServiceCharge } from './serviceCharge';
import type { Receipt } from './types';

const COMMON_TAX_RATES = [0.15, 0.1, 0.05, 0.02];

export type BillTotals = {
  itemsSubtotal: number;
  taxableItems: number;
  nonTaxableItems: number;
  service: ServiceCharge;
  serviceOnTaxable: number;
  serviceOnNonTaxable: number;
  taxableBase: number;
  taxRate: number;
  taxAmount: number;
  /** Everything the restaurant is owed. Tip is added on top, per person. */
  total: number;
  reconciliation: {
    printedTotal?: number;
    computedTotal: number;
    /** computed - printed, in minor units. Zero means we tie out to the paper. */
    delta: number;
    ok: boolean;
    message: string;
  };
};

/** Derive the VAT rate from the printed figures when the receipt did not name it. */
function resolveTaxRate(receipt: Receipt, taxableBase: number): number {
  const printed = receipt.printed.taxRate;
  if (printed !== undefined && printed > 0) return printed;

  const amount = receipt.printed.taxAmount;
  if (amount === undefined || taxableBase <= 0) return 0;

  for (const rate of COMMON_TAX_RATES) {
    if (roundHalfUp(taxableBase * rate) === amount) return rate;
  }
  return amount / taxableBase;
}

/**
 * Rebuild the bill from its line items and check the result against the paper.
 *
 * Order of operations matches how the fiscal printers actually do it:
 *   items -> service charge -> taxable base -> VAT -> total.
 * Non-taxable items ride along outside the VAT base entirely.
 */
export function computeTotals(receipt: Receipt, serviceChargeRateOverride?: number): BillTotals {
  const items = receipt.items;
  const itemsSubtotal = sum(items.map((i) => i.amount));
  const taxableItems = sum(items.filter((i) => i.taxable).map((i) => i.amount));
  const nonTaxableItems = itemsSubtotal - taxableItems;

  const service =
    serviceChargeRateOverride === undefined
      ? inferServiceCharge(items, receipt.printed.serviceCharge, receipt.printed.serviceChargeRate)
      : manualServiceCharge(items, serviceChargeRateOverride);

  const serviceOnTaxable = serviceChargeOnTaxable(service, items);
  const serviceOnNonTaxable = service.amount - serviceOnTaxable;

  const taxableBase = taxableItems + serviceOnTaxable;
  const taxRate = resolveTaxRate(receipt, taxableBase);
  const taxAmount = roundHalfUp(taxableBase * taxRate);

  const total = itemsSubtotal + service.amount + taxAmount;
  const printedTotal = receipt.printed.total;
  const delta = printedTotal === undefined ? 0 : total - printedTotal;

  return {
    itemsSubtotal,
    taxableItems,
    nonTaxableItems,
    service,
    serviceOnTaxable,
    serviceOnNonTaxable,
    taxableBase,
    taxRate,
    taxAmount,
    total,
    reconciliation: {
      printedTotal,
      computedTotal: total,
      delta,
      ok: printedTotal === undefined ? false : delta === 0,
      message:
        printedTotal === undefined
          ? "Couldn't read a printed total — check the lines against the paper."
          : delta === 0
            ? 'Matches the printed total exactly.'
            : `Off the printed total by ${delta > 0 ? '+' : ''}${delta} cents — a line was probably misread.`,
    },
  };
}

/** Tip in minor units, from the config and the pre-tax base. */
export function computeTip(mode: 'percent' | 'amount' | 'none', percent: number, amount: number, base: number): number {
  if (mode === 'none') return 0;
  if (mode === 'amount') return Math.max(0, amount);
  return Math.max(0, roundHalfUp(base * percent));
}
