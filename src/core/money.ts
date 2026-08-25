/**
 * All money in Verdict is handled as integer minor units ("cents") — never floats.
 *
 * Receipts are rounded to the cent by the till, so the only way for a split to
 * be provably fair is to do every division in integers and hand out the leftover
 * remainder deterministically. `allocate` is the single place that happens.
 */

/** Round half away from zero — the behaviour Ethiopian fiscal printers use. */
export function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** "203.00" / 203 / "*203.00" -> 20300 minor units. */
export function toMinor(value: number | string, decimals = 2): number {
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return roundHalfUp(n * Math.pow(10, decimals));
}

/** 20300 -> 203 (major units, for display maths only). */
export function toMajor(minor: number, decimals = 2): number {
  return minor / Math.pow(10, decimals);
}

/**
 * Split `total` minor units across `weights`, exactly.
 *
 * Uses the largest-remainder method: everyone gets their floor, then the
 * leftover cents go to the biggest fractional parts first. Guarantees
 * `allocate(t, w).reduce(sum) === t` for any weights, including all-zero
 * (falls back to an even split) and empty (returns []).
 */
export function allocate(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const out = new Array<number>(n).fill(0);
  if (total === 0) return out;

  const sign = total < 0 ? -1 : 1;
  const magnitude = Math.abs(total);

  const safe = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  let sum = safe.reduce((a, b) => a + b, 0);
  const effective = sum > 0 ? safe : safe.map(() => 1);
  if (sum <= 0) sum = n;

  const exact = effective.map((w) => (magnitude * w) / sum);
  const shares = exact.map((e) => Math.floor(e));
  const assigned = shares.reduce((a, b) => a + b, 0);
  let remainder = magnitude - assigned;
  if (remainder < 0) remainder = 0;
  if (remainder > n) remainder = n; // float-safety clamp

  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e), weight: effective[i] }))
    .sort((a, b) => b.frac - a.frac || b.weight - a.weight || a.i - b.i);

  for (let k = 0; k < remainder; k += 1) shares[order[k].i] += 1;
  return shares.map((v) => v * sign);
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Percent for display: 0.05 -> "5%", 0.125 -> "12.5%", 0.0499 -> "4.99%". */
export function formatRate(rate: number): string {
  const pct = rate * 100;
  const rounded = Math.abs(pct - Math.round(pct)) < 1e-9 ? Math.round(pct) : Math.round(pct * 100) / 100;
  return `${rounded}%`;
}

export function formatMoney(minor: number, symbol = 'Br', decimals = 2): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / Math.pow(10, decimals));
  const frac = String(abs % Math.pow(10, decimals)).padStart(decimals, '0');
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${symbol} ${grouped}.${frac}`;
}
