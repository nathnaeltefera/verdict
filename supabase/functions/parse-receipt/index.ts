// Supabase Edge Function: turn a receipt photo into structured line items.
//
// Deploy:  supabase functions deploy parse-receipt
// Secrets: supabase secrets set GEMINI_API_KEY=...
//          supabase secrets set GEMINI_MODEL=gemini-3.7-flash   (optional override)
//
// The model key lives here and only here — the phone app authenticates with the
// Supabase anon key and never holds a model credential.
//
// This calls the Gemini REST endpoint with plain fetch rather than @google/genai
// on purpose. Supabase Edge Functions get a small CPU budget per request, and
// evaluating a large npm module graph inside it is a real way to spend that
// budget on nothing. The request here is one JSON POST; a dependency buys
// nothing and risks a WORKER_RESOURCE_LIMIT.

const DEFAULT_MODEL = 'gemini-3.7-flash';
const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Comfortably inside the Edge Function wall-clock limit, with room to reply. */
const MODEL_TIMEOUT_MS = 45_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM = `You read Ethiopian fiscal receipts (Datecs, i-POS, CNET Systems printers) and return exactly what is printed.

Rules, in order of importance:

1. Transcribe, never compute. Every number you emit must be a number you can see
   on the paper. If the amount column is cut off or unreadable, return null for
   that field rather than multiplying qty by unit price yourself.
2. Line items are the rows between the "Description / Qty / Price / Amount" header
   and the first total line (SUBTOTAL, TXBL, TOTAL). Each row's rightmost figure is
   its amount. A row printed as "7 x *39.04   *273.28" has qty 7, unit_price 39.04,
   amount 273.28. A long description may wrap, pushing its qty and figures onto the
   next line — that is still one item, not two.
3. Taxability is per line and matters. A line suffixed "(N)", or one covered by a
   NOTXBL / non-taxable total, is taxable: false. Lines under TXBL1 (or with no
   marker at all on an all-taxable receipt) are taxable: true. Record the printed
   marker verbatim in tax_marker.
4. A service charge is any line labelled Surcharge, Service, Service Charge, or
   S/C. Report its printed amount in service_charge. Only fill service_charge_rate
   if the receipt literally prints a percentage next to it — do NOT work the rate
   out yourself; the app derives it. If there is no such line, return null for both.
5. Report tax_rate only when printed (e.g. "TAX1 15%"). Report taxable_base from
   TXBL1 and non_taxable_total from NOTXBL when present.
6. Money as plain decimal numbers, no currency symbols, no asterisks, no thousands
   separators. 773.87, not *773.87 or "773,87".
7. If the photo is rotated, read it rotated. If a digit is genuinely ambiguous,
   prefer the reading that makes the printed totals consistent, and say which line
   you were unsure about in notes.`;

/**
 * Gemini's responseJsonSchema takes a JSON Schema subset. Union types written as
 * `type: ["number", "null"]` are not in that subset; `anyOf` is, so nullables go
 * through this helper.
 */
const nullable = (type: string) => ({ anyOf: [{ type }, { type: 'null' }] });

const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    merchant: { type: 'string', description: 'Trading name as printed.' },
    tin: nullable('string'),
    fs_no: nullable('string'),
    ref: nullable('string'),
    operator: nullable('string'),
    printed_at: nullable('string'),
    currency_code: nullable('string'),
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          qty: { type: 'number' },
          unit_price: nullable('number'),
          amount: nullable('number'),
          taxable: { type: 'boolean' },
          tax_marker: nullable('string'),
        },
        required: ['description', 'qty', 'unit_price', 'amount', 'taxable', 'tax_marker'],
      },
    },
    subtotal: nullable('number'),
    service_charge: nullable('number'),
    service_charge_rate: nullable('number'),
    taxable_base: nullable('number'),
    tax_rate: nullable('number'),
    tax_amount: nullable('number'),
    non_taxable_total: nullable('number'),
    total: nullable('number'),
    cash: nullable('number'),
    change: nullable('number'),
    notes: nullable('string'),
  },
  required: [
    'merchant', 'items', 'subtotal', 'service_charge', 'service_charge_rate',
    'taxable_base', 'tax_rate', 'tax_amount', 'non_taxable_total', 'total',
    'cash', 'change', 'notes',
  ],
};

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
// The app shrinks photos to a few hundred KB. Anything near this cap means the
// client-side resize did not run, and accepting it only ends in a timeout.
const MAX_BASE64_BYTES = 2_000_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { code?: number; message?: string; status?: string };
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'GEMINI_API_KEY is not set on this function.' }, 500);
  const model = Deno.env.get('GEMINI_MODEL') || DEFAULT_MODEL;

  let image: string;
  let mimeType: string;
  try {
    const body = await req.json();
    image = String(body.image ?? '').replace(/^data:[^,]+,/, '');
    mimeType = String(body.mime_type ?? 'image/jpeg');
  } catch {
    return json({ error: 'Body must be JSON: { image: "<base64>", mime_type: "image/jpeg" }' }, 400);
  }
  console.log(JSON.stringify({ at: 'body.read', image_b64_len: image.length, mimeType }));

  if (!image) return json({ error: 'No image supplied.' }, 400);
  if (image.length > MAX_BASE64_BYTES) {
    return json(
      {
        error: `That photo is ${Math.round(image.length / 1024)} KB encoded — too large. Update the app so it shrinks photos before sending.`,
      },
      413,
    );
  }
  if (!ALLOWED_MIME.has(mimeType)) return json({ error: `Unsupported image type: ${mimeType}` }, 415);

  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: image } },
          {
            text: 'Transcribe this receipt. Return every line item with its own amount and taxability, and the printed totals. Do not calculate anything the paper does not show.',
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: RECEIPT_SCHEMA,
      // Deterministic transcription: we want the same digits every time, not variety.
      temperature: 0,
    },
  };

  const startedAt = Date.now();
  let upstream: Response;
  try {
    console.log(JSON.stringify({ at: 'model.start', model }));
    upstream = await fetch(`${API_ROOT}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Stop ourselves before Supabase kills the worker on wall-clock time, so
      // the caller gets an explanation rather than no response at all.
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
    console.error(JSON.stringify({ at: 'model.fetch_failed', timedOut, message: String(error).slice(0, 200) }));
    return json(
      {
        error: timedOut
          ? 'The receipt reader timed out on that photo. Try a straighter, brighter shot.'
          : 'The receipt reader could not reach the model.',
      },
      504,
    );
  }

  const raw = await upstream.text();
  console.log(JSON.stringify({ at: 'model.done', status: upstream.status, ms: Date.now() - startedAt, bytes: raw.length }));

  if (!upstream.ok) {
    // Surface the upstream reason — a rejected key, an unknown model and an
    // unsupported schema field all look identical without it.
    console.error(JSON.stringify({ at: 'model.http_error', status: upstream.status, body: raw.slice(0, 500) }));
    if (upstream.status === 429) {
      return json({ error: 'The receipt reader is over its rate limit. Try again in a moment.' }, 429);
    }
    if (upstream.status === 401 || upstream.status === 403) {
      return json({ error: 'The receipt reader’s API key was rejected.' }, 500);
    }
    if (upstream.status === 404) {
      return json({ error: `The model "${model}" is not available to this key.` }, 500);
    }
    let detail = '';
    try {
      detail = (JSON.parse(raw) as GeminiResponse).error?.message ?? '';
    } catch {
      detail = raw.slice(0, 160);
    }
    return json({ error: `Receipt reader error (${upstream.status}). ${detail}`.trim() }, 502);
  }

  let parsed: GeminiResponse;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ error: 'The model returned something unreadable. Try again.' }, 502);
  }

  if (parsed.promptFeedback?.blockReason) {
    return json({ error: `The model declined to read that image (${parsed.promptFeedback.blockReason}).` }, 422);
  }

  const candidate = parsed.candidates?.[0];
  const finish = candidate?.finishReason;
  if (finish && finish !== 'STOP') {
    return json(
      {
        error:
          finish === 'MAX_TOKENS'
            ? 'That receipt was too long to read in one go.'
            : `The model stopped early (${finish}). Try a clearer photo.`,
      },
      502,
    );
  }

  const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  if (!text) return json({ error: 'The model returned nothing. Try a clearer photo.' }, 502);

  let receipt: unknown;
  try {
    receipt = JSON.parse(text);
  } catch {
    console.error(JSON.stringify({ at: 'model.unparseable', sample: text.slice(0, 200) }));
    return json({ error: 'The model did not return a structured receipt. Try a clearer photo.' }, 502);
  }

  return json({
    receipt,
    usage: {
      input_tokens: parsed.usageMetadata?.promptTokenCount,
      output_tokens: parsed.usageMetadata?.candidatesTokenCount,
      model,
    },
  });
});
