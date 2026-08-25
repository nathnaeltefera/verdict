import Constants from 'expo-constants';
import { formatRate } from '../core/money';
import type { SplitResult } from '../core/split';
import type { Bill } from '../core/types';

/**
 * A share link carries the whole split in the URL fragment — the part after
 * "#", which browsers never send to the server. So the page can be hosted on
 * any dumb static host and the bill still never touches anyone's database.
 *
 * Set `webBaseUrl` in app.json > expo.extra to wherever you host web/claim.html.
 */

export type SharePayload = {
  v: 1;
  m: string;
  d?: string;
  c: string;
  /** Service charge: [label, total]. */
  s?: [string, number];
  tr: number;
  tt: number;
  tip: number;
  g: number;
  p: Array<{
    n: string;
    c: number;
    t: number;
    paid?: 1;
    /** x: 1 marks a line the receipt did not tax. */
    l: Array<{ d: string; a: number; w: number; x?: 1 }>;
    sc: number;
    tx: number;
    tp: number;
  }>;
  u?: { t: number; l: Array<{ d: string; a: number }> };
};

export function buildPayload(bill: Bill, result: SplitResult): SharePayload {
  const { totals } = result;
  return {
    v: 1,
    m: bill.receipt.merchant,
    d: bill.receipt.printedAt,
    c: bill.receipt.currency.symbol,
    s: totals.service.amount > 0 ? [totals.service.label, totals.service.amount] : undefined,
    tr: totals.taxRate,
    tt: totals.taxAmount,
    tip: result.tipTotal,
    g: result.grandTotal,
    p: result.people.map((share) => {
      const person = bill.people.find((x) => x.id === share.personId)!;
      return {
        n: person.name,
        c: person.colorIndex,
        t: share.total,
        paid: bill.settled[person.id] ? (1 as const) : undefined,
        l: share.lines.map((line) => ({
          d: line.description,
          a: line.amount,
          w: line.ways,
          x: line.taxable ? undefined : (1 as const),
        })),
        sc: share.serviceCharge,
        tx: share.tax,
        tp: share.tip,
      };
    }),
    u:
      result.unassignedItems.length > 0
        ? {
            t: result.unassigned.total,
            l: result.unassignedItems.map((item) => ({ d: item.description, a: item.amount })),
          }
        : undefined,
  };
}

/** URL-safe base64 without padding, so the link survives being pasted anywhere. */
function encode(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return globalThis
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function webBaseUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as { webBaseUrl?: string };
  return extra.webBaseUrl ?? process.env.EXPO_PUBLIC_WEB_BASE_URL ?? '';
}

export function shareLink(bill: Bill, result: SplitResult): string | null {
  const base = webBaseUrl();
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}#${encode(buildPayload(bill, result))}`;
}

/** Human-readable one-liner for the VAT row on the web page. */
export function taxLabel(rate: number): string {
  return `VAT ${formatRate(rate)}`;
}
