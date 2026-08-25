export type Currency = {
  code: string;
  symbol: string;
  decimals: number;
};

export const ETB: Currency = { code: 'ETB', symbol: 'Br', decimals: 2 };

/**
 * One printed line on the receipt. `amount` is authoritative — tills round
 * qty * unitPrice themselves, so we never recompute it.
 */
export type LineItem = {
  id: string;
  description: string;
  qty: number;
  unitPrice: number; // minor units
  amount: number; // minor units
  taxable: boolean;
  /** Raw marker the printer used, e.g. "TXBL1", "NOTXBL", "(N)". Kept for the audit trail. */
  taxMarker?: string;
};

/** Totals exactly as printed on the paper. Anything the OCR could not read stays undefined. */
export type PrintedTotals = {
  subtotal?: number;
  serviceCharge?: number;
  /** If the printer spelled the rate out, e.g. 0.05 for "Service 5%". */
  serviceChargeRate?: number;
  taxableBase?: number;
  taxRate?: number;
  taxAmount?: number;
  nonTaxableTotal?: number;
  total?: number;
  cash?: number;
  change?: number;
};

export type Receipt = {
  id: string;
  merchant: string;
  tin?: string;
  fsNo?: string;
  ref?: string;
  operator?: string;
  /** As printed, e.g. "22/08/2026 18:23". Free text — receipts are inconsistent. */
  printedAt?: string;
  currency: Currency;
  items: LineItem[];
  printed: PrintedTotals;
  /** Local file URI of the photo, so the bill can be re-checked against the paper. */
  photoUri?: string;
};

export type Person = {
  id: string;
  name: string;
  colorIndex: number;
};

/**
 * itemId -> personId -> share weight.
 * Weight 1 each is an even split; weights let "I had 2 of the 3 beers" work.
 */
export type Assignments = Record<string, Record<string, number>>;

export type TipConfig = {
  mode: 'percent' | 'amount' | 'none';
  /** Fraction, e.g. 0.1 for 10%. Applied to the pre-tax, post-service subtotal. */
  percent: number;
  /** Minor units, used when mode === 'amount'. */
  amount: number;
  split: 'proportional' | 'even';
};

export const NO_TIP: TipConfig = { mode: 'none', percent: 0, amount: 0, split: 'proportional' };

export type Bill = {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  receipt: Receipt;
  people: Person[];
  assignments: Assignments;
  tip: TipConfig;
  /** Manual override of the detected service-charge rate, when the user disagrees. */
  serviceChargeRateOverride?: number;
  settled: Record<string, boolean>;
  archived?: boolean;
};
