import Constants from 'expo-constants';
import { newId } from './store';
import { ETB, type LineItem, type Receipt } from '../core/types';
import { toMinor } from '../core/money';

/**
 * Talks to the `parse-receipt` Supabase Edge Function, which is the only thing
 * holding the model API key. The phone never sees it.
 */

type Extra = { supabaseUrl?: string; supabaseAnonKey?: string };

/** An unset value in app.json is an empty string, not undefined — `??` would keep it. */
function firstSet(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (value !== undefined && value.trim() !== '') return value.trim();
  }
  return '';
}

function config(): Required<Extra> {
  const extra = (Constants.expoConfig?.extra ?? {}) as Extra;
  return {
    supabaseUrl: firstSet(extra.supabaseUrl, process.env.EXPO_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: firstSet(extra.supabaseAnonKey, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  };
}

export function isConfigured(): boolean {
  const { supabaseUrl, supabaseAnonKey } = config();
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/** Shape the Edge Function returns. Money arrives as decimal strings/numbers. */
type RawItem = {
  description?: string;
  qty?: number;
  unit_price?: number | string;
  amount?: number | string;
  taxable?: boolean;
  tax_marker?: string;
};

type RawReceipt = {
  merchant?: string;
  tin?: string;
  fs_no?: string;
  ref?: string;
  operator?: string;
  printed_at?: string;
  currency_code?: string;
  items?: RawItem[];
  subtotal?: number | string;
  service_charge?: number | string;
  service_charge_rate?: number | string;
  taxable_base?: number | string;
  tax_rate?: number | string;
  tax_amount?: number | string;
  non_taxable_total?: number | string;
  total?: number | string;
  cash?: number | string;
  change?: number | string;
  notes?: string;
};

function optionalMinor(value: number | string | undefined): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return toMinor(value);
}

function optionalRate(value: number | string | undefined): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(String(value).replace('%', ''));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  // Accept both "15" and "0.15".
  return n > 1 ? n / 100 : n;
}

export function toReceipt(raw: RawReceipt): Receipt {
  const items: LineItem[] = (raw.items ?? []).map((item) => {
    const qty = Number.isFinite(item.qty) ? Number(item.qty) : 1;
    const unitPrice = optionalMinor(item.unit_price) ?? 0;
    const amount = optionalMinor(item.amount) ?? Math.round(unitPrice * qty);
    return {
      id: newId('item'),
      description: (item.description ?? 'Item').trim(),
      qty,
      unitPrice,
      amount,
      // Fiscal printers mark exempt lines; anything unmarked is taxable by default.
      taxable: item.taxable !== false,
      taxMarker: item.tax_marker,
    };
  });

  return {
    id: newId('rcpt'),
    merchant: (raw.merchant ?? 'Receipt').trim(),
    tin: raw.tin,
    fsNo: raw.fs_no,
    ref: raw.ref,
    operator: raw.operator,
    printedAt: raw.printed_at,
    currency: ETB,
    items,
    printed: {
      subtotal: optionalMinor(raw.subtotal),
      serviceCharge: optionalMinor(raw.service_charge),
      serviceChargeRate: optionalRate(raw.service_charge_rate),
      taxableBase: optionalMinor(raw.taxable_base),
      taxRate: optionalRate(raw.tax_rate),
      taxAmount: optionalMinor(raw.tax_amount),
      nonTaxableTotal: optionalMinor(raw.non_taxable_total),
      total: optionalMinor(raw.total),
      cash: optionalMinor(raw.cash),
      change: optionalMinor(raw.change),
    },
  };
}

export class ReceiptReadError extends Error {}

/**
 * Give up before the Edge Function's own wall-clock limit does. A request that
 * has not come back by now is not going to, and the user deserves to be told
 * that rather than watch a spinner.
 */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Refuse to start an upload that cannot finish. The reader shrinks photos to a
 * few hundred KB; anything at this size means the resize did not happen, and
 * pushing it would just stall until something times out.
 */
const MAX_BASE64_LENGTH = 2_000_000;

export async function readReceipt(base64Image: string, mimeType = 'image/jpeg'): Promise<Receipt> {
  const { supabaseUrl, supabaseAnonKey } = config();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new ReceiptReadError(
      'Receipt reading is not configured yet. Add supabaseUrl and supabaseAnonKey to app.json > expo.extra.',
    );
  }

  if (base64Image.length > MAX_BASE64_LENGTH) {
    throw new ReceiptReadError(
      `That photo is ${Math.round(base64Image.length / 1024)} KB after encoding — too big to send. Retake it a little further back.`,
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/parse-receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ image: base64Image, mime_type: mimeType }),
      signal: controller.signal,
    });
  } catch (err) {
    throw new ReceiptReadError(
      err instanceof Error && err.name === 'AbortError'
        ? 'The receipt reader took too long to answer. Try again, or use a sample receipt.'
        : 'Could not reach the receipt reader. Check your connection and try again.',
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ReceiptReadError(
      response.status === 401 || response.status === 403
        ? 'The receipt reader rejected this app’s key.'
        : `The receipt reader failed (${response.status}). ${detail.slice(0, 160)}`.trim(),
    );
  }

  const payload = (await response.json()) as { receipt?: RawReceipt; error?: string };
  if (payload.error) throw new ReceiptReadError(payload.error);
  if (!payload.receipt || !payload.receipt.items?.length) {
    throw new ReceiptReadError('No line items were found on that photo. Try a straighter, brighter shot.');
  }
  return toReceipt(payload.receipt);
}
