# Verdict

Split a restaurant bill by photographing the receipt, tapping who had what, and
handing everyone their number — service charge and VAT included, worked out per
person rather than divided by the number of heads at the table.

Built for Ethiopian fiscal receipts (Datecs, i-POS, CNET Systems printers), but
the arithmetic is general.

---

## The two things this gets right

### 1. The service charge rate is derived, never assumed

Receipts print a surcharge *amount*, almost never a rate — and the rate differs
from shop to shop. Verdict divides the printed amount back out against each
plausible base and reports the rate it can actually prove:

| Receipt | Printed | What Verdict works out |
|---|---|---|
| Messanta Coffee | `Surcharge *29.09` on a `*581.89` subtotal | **5%** of the item subtotal — and 5% × 581.89 = 29.09 to the cent |
| Lomyad | no surcharge line | **None** |

If a shop charges 2%, 10%, or 12.5%, that is what you get. If the rate is
something odd like 4.87%, Verdict says 4.87% rather than rounding it to a tidy
lie. It also detects when the charge was levied on the taxable items only rather
than the whole subtotal, because that changes who pays what.

You can override the rate by hand; the reconciliation badge will then tell you
you no longer match the paper.

### 2. Taxable and non-taxable lines are tracked per item

Ethiopian receipts mark VAT-exempt lines with `(N)` and total them separately
under `NOTXBL`. Verdict keeps that per line, and VAT is allocated by each
person's **taxable** spend only.

On the Lomyad receipt that means: order only the untaxed milk and you pay
**Br 0.00** VAT. Order the nuts and you carry the VAT on the nuts. Splitting the
15% evenly across the table would overcharge the milk drinker every time.

### Reconciliation

Every bill is rebuilt from its line items — items → service charge → taxable
base → VAT → total — and checked against the printed total. Both sample receipts
tie out to the cent. If a line was misread, the total won't match and the app
says so instead of quietly splitting a wrong number.

---

## Assigning items

The assign screen is the point of the app. Each line is a card with a row of
faces beneath it:

- **Tap a face** to put that friend on the dish.
- **Tap two or more faces** and the dish is shared — that is all sharing is.
  There is no separate mode to find. The card updates live to
  *"Shared 3 ways · Br 91.09 each"*.
- **Uneven shares** — long-press a face, or tap *Uneven shares*, to get −/+
  steppers. Two of the three beers is `2` against `1`.
- **Everyone** puts the whole table on one dish; **Split everything evenly**
  does it for the entire bill in one tap.
- Anything unclaimed sits in its own bucket with an amber warning. It is never
  quietly loaded onto the people who *have* claimed something.

Every division goes through one largest-remainder allocator, so each stage sums
back to the exact printed figure. There is never a stray cent for someone to
absorb — the summary screen asserts this and will tell you loudly if it ever
fails.

---

## Settling up

Verdict tells everyone their number and remembers who has paid. It does not move
money — no payment requests, no linked accounts. Tap *Mark as settled* per
person; send the transfer however you normally would.

**Past bills are kept**, on the phone, until you delete them (press and hold on
the home screen). Nothing is uploaded except the receipt photo you send to be
read.

Three ways to hand out the numbers:

- **Send to the group** — plain text through the iOS share sheet, survives being
  pasted into WhatsApp or Telegram.
- **Copy their number** — one person's breakdown, for a single nudge.
- **Copy a web link** — opens in any browser with nothing to install. The whole
  split rides in the URL fragment (the part after `#`), which browsers never
  send to a server, so `web/claim.html` can sit on any static host and the bill
  still stays between you and whoever you sent it to.

---

## Running it on your iPhone

**Expo Go does not work with this project.** It is on Expo SDK 57, and the App
Store build of Expo Go supports whatever SDK Expo has shipped it for — if that
is older, you get *"Project is incompatible with this version of Expo Go."*
Use a development build instead; it does not depend on Expo Go at all.

You need a Mac, Xcode, and a cable.

```bash
npm install
npx expo run:ios --device      # pick your iPhone when prompted
```

That builds and installs a **development build** (`expo-dev-client` is already a
dependency). After the first install you only need:

```bash
npx expo start --dev-client
```

The app works end to end straight away using the two sample receipts on the home
screen — no backend needed to try it.

---

## Reading real receipts

Photo → line items runs through a Supabase Edge Function so the model API key
never ships inside the app.

The function is deployed to the `verdict` Supabase project and its URL and anon
key are already in `app.json`. One step remains:

```bash
supabase secrets set GEMINI_API_KEY=... --project-ref ueaprnuipvmhkjezaajo
```

or Supabase dashboard → Edge Functions → Secrets. Until that is set, the
function answers every request with *"GEMINI_API_KEY is not set on this
function."*

After changing `app.json`, rebuild with `--clear` — Metro caches the resolved
app config, and a warm cache will keep serving the old one:

```bash
npx expo start --clear
```

`webBaseUrl` in `extra` is optional — without it the *Copy a web link* action is
hidden and everything else still works.

### Photos are shrunk before they are sent

`src/data/prepareImage.ts` resizes every photo to 1600px on the long edge at
JPEG quality 0.7 — around 200–300 KB, roughly a tenth of what the camera
produces. This is not an optimisation, it is the difference between working and
not: a full-resolution iPhone photo is 3–5 MB once base64-encoded, and the Edge
Function sits waiting on a body that slow uplink never finishes delivering until
Supabase kills the worker on wall-clock time. The caller sees no response at
all, which the app could only report as "could not reach the receipt reader".

Both ends now refuse anything over 2 MB of base64 rather than starting an upload
that cannot finish, the client gives up after 60s with a message that says so,
and the function abandons the model call at 45s so it returns an error instead of
being killed silently.

The function logs `body.read`, `model.start` and `model.done` with sizes and
timings, so the next failure can be read straight out of the Supabase logs.

### The model

One `gemini-3.7-flash` call per receipt, thinking level high, temperature 0 —
transcription should give the same digits every time, not variety. Structured
output is enforced with `responseJsonSchema`, so the reply is always valid JSON
in the shape `src/data/ocr.ts` expects.

Override the model without redeploying by setting a second secret:

```bash
supabase secrets set GEMINI_MODEL=gemini-2.5-pro --project-ref ueaprnuipvmhkjezaajo
```

Models confirmed available on this key: `gemini-3.7-flash`, `gemini-3.6-flash`,
`gemini-3.5-flash`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-3.1-flash-lite`.

Note that anyone holding the app or this repo can invoke the function and spend
against that key, so keep an eye on its quota.

The function's prompt is deliberately built around one rule: **transcribe, never
compute.** The model reports the printed surcharge *amount* and is explicitly
told not to work the rate out — that is the app's job, and the app can show its
working.

---

## On your phone without Xcode: install the web build

The web build is a real installable app on iOS — an icon on the home screen, no
Safari chrome, bills stored on the device. Good enough for a meal out; the
native build is still better (haptics, no server needed).

Locally, over your Wi-Fi:

```bash
npx expo start --web
```

Open `http://<your-mac's-ip>:8081` in Safari on the iPhone, then Share →
**Add to Home Screen**. Needs the Mac awake and on the same network.

Permanently, so it works anywhere:

```bash
npm run build:web        # writes ./dist
```

Drop `dist/` on Netlify or Vercel, open the URL in Safari, Add to Home Screen.
`public/_redirects` and `vercel.json` are already set up so that dynamic routes
like `/bill/<id>/assign` survive a reload — on a host with no rewrite support
(GitHub Pages) they will 404 when reloaded mid-bill.

Bills live in the browser's local storage, which is per-device and not shared
with the native app.

## Layout

```
app/                       screens (expo-router)
  index.tsx                past bills + scan
  scan.tsx                 camera / library → parsed receipt
  bill/[id]/review.tsx     service charge, taxability, reconciliation
  bill/[id]/people.tsx     who's at the table
  bill/[id]/assign.tsx     tap faces onto dishes
  bill/[id]/summary.tsx    everyone's number, tip, settle up
src/core/                  the arithmetic — no React, fully tested
  money.ts                 integer minor units + largest-remainder allocation
  serviceCharge.ts         rate inference
  totals.ts                bill rebuild + reconciliation
  split.ts                 per-person shares
  fixtures.ts              the two real receipts
src/data/                  storage, receipt reading, share text, share links
src/ui/                    theme and components
supabase/functions/        the receipt reader
web/claim.html             the no-install page for friends
```

## Tests

```bash
npm test        # 28 tests over the arithmetic
npm run typecheck
```

The suite pins both real receipts end to end, plus the cases that are easy to get
wrong: an odd service-charge rate, a charge levied on taxable items only, a
three-way split of an odd amount, a VAT-free order, unclaimed items, removing a
person mid-split, and an even tip that doesn't divide cleanly. Every one of them
asserts that the shares sum back to the exact total.
