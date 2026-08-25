import { ETB, type Receipt } from './types';

/**
 * The two real receipts this app was built against. They are deliberately
 * different in the two ways that matter:
 *
 *   Messanta Coffee  — 5% service charge, everything taxable.
 *   Lomyad           — no service charge, mixed taxable / non-taxable "(N)" lines.
 *
 * Both are exercised in the tests so the maths can never silently drift.
 */

export const MESSANTA_COFFEE: Receipt = {
  id: 'fixture-messanta',
  merchant: 'MESSANTA COFFEE',
  tin: '0002442778',
  fsNo: '00240963',
  ref: 'RCS-149180-26',
  operator: 'YAYNE',
  printedAt: '22/08/2026 18:23',
  currency: ETB,
  items: [
    { id: 'm1', description: 'STRAWBERY SMOOTHIE 350ML', qty: 1, unitPrice: 20300, amount: 20300, taxable: true, taxMarker: 'TXBL1' },
    { id: 'm2', description: 'CHOCOLATE CAKE NEW', qty: 1, unitPrice: 37888, amount: 37889, taxable: true, taxMarker: 'TXBL1' },
  ],
  printed: {
    subtotal: 58189,
    serviceCharge: 2909,
    taxableBase: 61098,
    taxRate: 0.15,
    taxAmount: 9165,
    total: 70263,
    cash: 70263,
  },
};

export const LOMYAD: Receipt = {
  id: 'fixture-lomyad',
  merchant: 'LOMYAD GENERAL BUSINESS AND INDUSTRIES PLC',
  tin: '0003161311',
  fsNo: '00338015',
  ref: 'CS_CPOS3_MT7KW8W3',
  operator: 'ASTEDE',
  printedAt: '24/08/2026 21:4',
  currency: ETB,
  items: [
    { id: 'l1', description: 'MAMO KACHA MILK 500ML', qty: 2, unitPrice: 8000, amount: 16000, taxable: false, taxMarker: '(N)' },
    { id: 'l2', description: 'SHOLLA MILK 0.5LT', qty: 4, unitPrice: 7490, amount: 29960, taxable: false, taxMarker: '(N)' },
    { id: 'l3', description: 'JUMBO NUTS(PCS)', qty: 7, unitPrice: 3904, amount: 27328, taxable: true, taxMarker: 'TXBL1' },
  ],
  printed: {
    subtotal: 73288,
    taxableBase: 27328,
    taxRate: 0.15,
    taxAmount: 4099,
    nonTaxableTotal: 45960,
    total: 77387,
    cash: 80000,
    change: 2613,
  },
};
