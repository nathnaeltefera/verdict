// Supabase Edge Function: turn a receipt photo into structured line items.
//
// Deploy:  supabase functions deploy parse-receipt
// Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// The Anthropic key lives here and only here — the phone app authenticates with
// the Supabase anon key and never holds a model credential.

import Anthropic from 'npm:@anthropic-ai/sdk@^0.70.0';

const MODEL = 'claude-opus-5';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM = `You read Ethiopian fiscal receipts (Datecs, i-POS, CNET Systems printers) and return exactly what is printed.

Rules, in order of importance:

1. Transcribe, never compute. Every number you emit must be a number you can see
   on the paper. If the amount column is cut off or unreadable, leave that field
   out rather than multiplying qty by unit price yourself.
2. Line items are the rows between the "Description / Qty / Price / Amount" header
   and the first total line (SUBTOTAL, TXBL, TOTAL). Each row's rightmost figure is
   its amount. A row printed as "7 x *39.04   *273.28" has qty 7, unit_price 39.04,
   amount 273.28.
3. Taxability is per line and matters. A line suffixed "(N)", or one covered by a
   NOTXBL / non-taxable total, is taxable: false. Lines under TXBL1 (or with no
   marker at all on an all-taxable receipt) are taxable: true. Record the printed
   marker verbatim in tax_marker.
4. A service charge is any line labelled Surcharge, Service, Service Charge, or
   S/C. Report its printed amount in service_charge. Only fill service_charge_rate
   if the receipt literally prints a percentage next to it — do NOT work the rate
   out yourself; the app derives it. If there is no such line, omit both fields.
5. Report tax_rate only when printed (e.g. "TAX1 15%"). Report taxable_base from
   TXBL1 and non_taxable_total from NOTXBL when present.
6. Money as plain decimal numbers, no currency symbols, no asterisks, no thousands
   separators. 773.87, not *773.87 or "773,87".
7. If the photo is rotated, read it rotated. If a digit is genuinely ambiguous,
   prefer the reading that makes the printed totals consistent, and say which line
   you were unsure about in notes.`;

const RECEIPT_TOOL = {
  name: 'emit_receipt',
  description: 'Return the transcribed receipt.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      merchant: { type: 'string', description: 'Trading name as printed.' },
      tin: { type: ['string', 'null'] },
      fs_no: { type: ['string', 'null'], description: 'Fiscal / FS number.' },
      ref: { type: ['string', 'null'] },
      operator: { type: ['string', 'null'] },
      printed_at: { type: ['string', 'null'], description: 'Date and time exactly as printed.' },
      currency_code: { type: ['string', 'null'], description: 'ISO code, ETB for Ethiopian receipts.' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            qty: { type: 'number' },
            unit_price: { type: ['number', 'null'] },
            amount: { type: ['number', 'null'], description: 'Line total as printed.' },
            taxable: { type: 'boolean' },
            tax_marker: { type: ['string', 'null'], description: 'Printed marker, e.g. "(N)", "TXBL1".' },
          },
          required: ['description', 'qty', 'unit_price', 'amount', 'taxable', 'tax_marker'],
          additionalProperties: false,
        },
      },
      subtotal: { type: ['number', 'null'] },
      service_charge: { type: ['number', 'null'], description: 'Printed surcharge / service amount.' },
      service_charge_rate: {
        type: ['number', 'null'],
        description: 'Only if a percentage is literally printed. Otherwise null.',
      },
      taxable_base: { type: ['number', 'null'] },
      tax_rate: { type: ['number', 'null'] },
      tax_amount: { type: ['number', 'null'] },
      non_taxable_total: { type: ['number', 'null'] },
      total: { type: ['number', 'null'] },
      cash: { type: ['number', 'null'] },
      change: { type: ['number', 'null'] },
      notes: { type: ['string', 'null'], description: 'Anything unreadable or uncertain.' },
    },
    required: [
      'merchant', 'tin', 'fs_no', 'ref', 'operator', 'printed_at', 'currency_code', 'items',
      'subtotal', 'service_charge', 'service_charge_rate', 'taxable_base', 'tax_rate',
      'tax_amount', 'non_taxable_total', 'total', 'cash', 'change', 'notes',
    ],
    additionalProperties: false,
  },
} as const;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BASE64_BYTES = 7_000_000; // ~5 MB of image, comfortably under the request cap.

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY is not set on this function.' }, 500);

  let image: string;
  let mimeType: string;
  try {
    const body = await req.json();
    image = String(body.image ?? '').replace(/^data:[^,]+,/, '');
    mimeType = String(body.mime_type ?? 'image/jpeg');
  } catch {
    return json({ error: 'Body must be JSON: { image: "<base64>", mime_type: "image/jpeg" }' }, 400);
  }

  if (!image) return json({ error: 'No image supplied.' }, 400);
  if (image.length > MAX_BASE64_BYTES) return json({ error: 'That photo is too large — take it again at a lower resolution.' }, 413);
  if (!ALLOWED_MIME.has(mimeType)) return json({ error: `Unsupported image type: ${mimeType}` }, 415);

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      tools: [RECEIPT_TOOL as never],
      tool_choice: { type: 'tool', name: 'emit_receipt' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType as never, data: image } },
            {
              type: 'text',
              text: 'Transcribe this receipt. Return every line item with its own amount and taxability, and the printed totals. Do not calculate anything the paper does not show.',
            },
          ],
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return json({ error: 'The model declined to read that image.' }, 422);
    }

    const block = response.content.find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') {
      return json({ error: 'The model did not return a structured receipt. Try a clearer photo.' }, 502);
    }

    // Tool inputs may carry unusual JSON escaping — always parse, never string-match.
    const receipt = typeof block.input === 'string' ? JSON.parse(block.input) : block.input;

    return json({
      receipt,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: 'The receipt reader is busy right now. Try again in a moment.' }, 429);
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return json({ error: 'The receipt reader’s API key is invalid.' }, 500);
    }
    if (error instanceof Anthropic.APIError) {
      return json({ error: `Receipt reader error (${error.status}).` }, 502);
    }
    return json({ error: 'Unexpected failure while reading the receipt.' }, 500);
  }
});
