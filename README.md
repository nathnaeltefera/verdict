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

```bash
supabase functions deploy parse-receipt
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Then fill in `app.json`:

```json
"extra": {
  "supabaseUrl": "https://<project>.supabase.co",
  "supabaseAnonKey": "<anon key>",
  "webBaseUrl": "https://<wherever you host claim.html>"
}
```

`webBaseUrl` is optional — without it the *Copy a web link* action is hidden and
everything else still works.

The function (`supabase/functions/parse-receipt/index.ts`) uses `claude-opus-5`
with a strict tool schema, so the response is always valid structured JSON. Its
prompt is deliberately built around one rule: **transcribe, never compute.** The
model reports the printed surcharge *amount* and is explicitly told not to work
the rate out — that is the app's job, and the app can show its working.

---

## Poking at it without a phone

```bash
npm install
npx expo start --web
```

Runs the whole app in a browser via react-native-web — every screen, the sample
receipts, assignment, the split. Useful while Xcode downloads. The share sheet
falls back to copying, since browsers without `navigator.share` have nothing to
open.

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
