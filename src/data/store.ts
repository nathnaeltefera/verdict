import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Assignments, Bill, LineItem, Person, Receipt, TipConfig } from '../core/types';
import { NO_TIP } from '../core/types';

const BILLS_KEY = 'verdict.bills.v1';
const ROSTER_KEY = 'verdict.roster.v1';

/**
 * Bills are kept on the phone, indefinitely, until you delete them. A receipt
 * is a record of money you spent — the split is worth being able to look back
 * at when someone says "wait, what did I owe you for?" three weeks later.
 * Nothing leaves the device except the receipt photo sent for reading.
 */

export function newId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export type Roster = Person[];

type Ctx = {
  ready: boolean;
  bills: Bill[];
  roster: Roster;
  getBill: (id: string) => Bill | undefined;
  createBill: (receipt: Receipt, photoUri?: string) => Bill;
  updateBill: (id: string, patch: (bill: Bill) => Bill) => void;
  deleteBill: (id: string) => void;
  addPerson: (billId: string, name: string) => Person | undefined;
  removePerson: (billId: string, personId: string) => void;
  renamePerson: (billId: string, personId: string, name: string) => void;
  toggleClaim: (billId: string, itemId: string, personId: string) => void;
  setShare: (billId: string, itemId: string, personId: string, share: number) => void;
  claimForEveryone: (billId: string, itemId: string) => void;
  clearClaims: (billId: string, itemId: string) => void;
  splitEverythingEvenly: (billId: string) => void;
  setTip: (billId: string, tip: TipConfig) => void;
  setServiceChargeOverride: (billId: string, rate: number | undefined) => void;
  updateItem: (billId: string, itemId: string, patch: Partial<LineItem>) => void;
  addItem: (billId: string) => void;
  removeItem: (billId: string, itemId: string) => void;
  toggleSettled: (billId: string, personId: string) => void;
  forgetFromRoster: (personId: string) => void;
};

const BillsContext = createContext<Ctx | null>(null);

export function BillsProvider({ children }: { children: React.ReactNode }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [roster, setRoster] = useState<Roster>([]);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [rawBills, rawRoster] = await AsyncStorage.multiGet([BILLS_KEY, ROSTER_KEY]);
        if (rawBills[1]) setBills(JSON.parse(rawBills[1]));
        if (rawRoster[1]) setRoster(JSON.parse(rawRoster[1]));
      } catch {
        // A corrupt store should not brick the app — start clean instead.
      } finally {
        hydrated.current = true;
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(BILLS_KEY, JSON.stringify(bills)).catch(() => {});
  }, [bills]);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(ROSTER_KEY, JSON.stringify(roster)).catch(() => {});
  }, [roster]);

  const updateBill = useCallback((id: string, patch: (bill: Bill) => Bill) => {
    setBills((current) =>
      current.map((bill) => (bill.id === id ? { ...patch(bill), updatedAt: Date.now() } : bill)),
    );
  }, []);

  const createBill = useCallback((receipt: Receipt, photoUri?: string) => {
    const bill: Bill = {
      id: newId('bill'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      title: receipt.merchant || 'Receipt',
      receipt: { ...receipt, photoUri },
      people: [],
      assignments: {},
      tip: NO_TIP,
      settled: {},
    };
    setBills((current) => [bill, ...current]);
    return bill;
  }, []);

  const deleteBill = useCallback((id: string) => {
    setBills((current) => current.filter((b) => b.id !== id));
  }, []);

  const addPerson = useCallback(
    (billId: string, rawName: string) => {
      const name = rawName.trim();
      if (!name) return undefined;

      // Reuse the colour this friend already has, so they look the same every meal.
      const known = roster.find((p) => p.name.toLowerCase() === name.toLowerCase());
      let created: Person | undefined;

      setBills((current) =>
        current.map((bill) => {
          if (bill.id !== billId) return bill;
          if (bill.people.some((p) => p.name.toLowerCase() === name.toLowerCase())) return bill;
          const used = new Set(bill.people.map((p) => p.colorIndex));
          let colorIndex = known?.colorIndex ?? bill.people.length;
          while (used.has(colorIndex)) colorIndex += 1;
          created = { id: known?.id ?? newId('p'), name, colorIndex };
          return { ...bill, people: [...bill.people, created], updatedAt: Date.now() };
        }),
      );

      if (created) {
        const person = created as Person;
        setRoster((current) =>
          current.some((p) => p.id === person.id) ? current : [...current, person],
        );
      }
      return created;
    },
    [roster],
  );

  const removePerson = useCallback(
    (billId: string, personId: string) => {
      updateBill(billId, (bill) => {
        const assignments: Assignments = {};
        for (const [itemId, claims] of Object.entries(bill.assignments)) {
          const { [personId]: _removed, ...rest } = claims;
          if (Object.keys(rest).length > 0) assignments[itemId] = rest;
        }
        const { [personId]: _settled, ...settled } = bill.settled;
        return { ...bill, people: bill.people.filter((p) => p.id !== personId), assignments, settled };
      });
    },
    [updateBill],
  );

  const renamePerson = useCallback(
    (billId: string, personId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      updateBill(billId, (bill) => ({
        ...bill,
        people: bill.people.map((p) => (p.id === personId ? { ...p, name: trimmed } : p)),
      }));
      setRoster((current) => current.map((p) => (p.id === personId ? { ...p, name: trimmed } : p)));
    },
    [updateBill],
  );

  const toggleClaim = useCallback(
    (billId: string, itemId: string, personId: string) => {
      updateBill(billId, (bill) => {
        const claims = { ...(bill.assignments[itemId] ?? {}) };
        if (claims[personId]) delete claims[personId];
        else claims[personId] = 1;
        const assignments = { ...bill.assignments };
        if (Object.keys(claims).length === 0) delete assignments[itemId];
        else assignments[itemId] = claims;
        return { ...bill, assignments };
      });
    },
    [updateBill],
  );

  const setShare = useCallback(
    (billId: string, itemId: string, personId: string, share: number) => {
      updateBill(billId, (bill) => {
        const claims = { ...(bill.assignments[itemId] ?? {}) };
        if (share <= 0) delete claims[personId];
        else claims[personId] = share;
        const assignments = { ...bill.assignments };
        if (Object.keys(claims).length === 0) delete assignments[itemId];
        else assignments[itemId] = claims;
        return { ...bill, assignments };
      });
    },
    [updateBill],
  );

  const claimForEveryone = useCallback(
    (billId: string, itemId: string) => {
      updateBill(billId, (bill) => ({
        ...bill,
        assignments: {
          ...bill.assignments,
          [itemId]: Object.fromEntries(bill.people.map((p) => [p.id, 1])),
        },
      }));
    },
    [updateBill],
  );

  const clearClaims = useCallback(
    (billId: string, itemId: string) => {
      updateBill(billId, (bill) => {
        const assignments = { ...bill.assignments };
        delete assignments[itemId];
        return { ...bill, assignments };
      });
    },
    [updateBill],
  );

  const splitEverythingEvenly = useCallback(
    (billId: string) => {
      updateBill(billId, (bill) => ({
        ...bill,
        assignments: Object.fromEntries(
          bill.receipt.items.map((item) => [item.id, Object.fromEntries(bill.people.map((p) => [p.id, 1]))]),
        ),
      }));
    },
    [updateBill],
  );

  const setTip = useCallback(
    (billId: string, tip: TipConfig) => updateBill(billId, (bill) => ({ ...bill, tip })),
    [updateBill],
  );

  const setServiceChargeOverride = useCallback(
    (billId: string, rate: number | undefined) =>
      updateBill(billId, (bill) => ({ ...bill, serviceChargeRateOverride: rate })),
    [updateBill],
  );

  const updateItem = useCallback(
    (billId: string, itemId: string, patch: Partial<LineItem>) => {
      updateBill(billId, (bill) => ({
        ...bill,
        receipt: {
          ...bill.receipt,
          items: bill.receipt.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
        },
      }));
    },
    [updateBill],
  );

  const addItem = useCallback(
    (billId: string) => {
      updateBill(billId, (bill) => ({
        ...bill,
        receipt: {
          ...bill.receipt,
          items: [
            ...bill.receipt.items,
            { id: newId('item'), description: 'New item', qty: 1, unitPrice: 0, amount: 0, taxable: true },
          ],
        },
      }));
    },
    [updateBill],
  );

  const removeItem = useCallback(
    (billId: string, itemId: string) => {
      updateBill(billId, (bill) => {
        const assignments = { ...bill.assignments };
        delete assignments[itemId];
        return {
          ...bill,
          assignments,
          receipt: { ...bill.receipt, items: bill.receipt.items.filter((i) => i.id !== itemId) },
        };
      });
    },
    [updateBill],
  );

  const toggleSettled = useCallback(
    (billId: string, personId: string) => {
      updateBill(billId, (bill) => ({
        ...bill,
        settled: { ...bill.settled, [personId]: !bill.settled[personId] },
      }));
    },
    [updateBill],
  );

  const forgetFromRoster = useCallback((personId: string) => {
    setRoster((current) => current.filter((p) => p.id !== personId));
  }, []);

  const getBill = useCallback((id: string) => bills.find((b) => b.id === id), [bills]);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      bills,
      roster,
      getBill,
      createBill,
      updateBill,
      deleteBill,
      addPerson,
      removePerson,
      renamePerson,
      toggleClaim,
      setShare,
      claimForEveryone,
      clearClaims,
      splitEverythingEvenly,
      setTip,
      setServiceChargeOverride,
      updateItem,
      addItem,
      removeItem,
      toggleSettled,
      forgetFromRoster,
    }),
    [
      ready, bills, roster, getBill, createBill, updateBill, deleteBill, addPerson, removePerson,
      renamePerson, toggleClaim, setShare, claimForEveryone, clearClaims, splitEverythingEvenly,
      setTip, setServiceChargeOverride, updateItem, addItem, removeItem, toggleSettled, forgetFromRoster,
    ],
  );

  return React.createElement(BillsContext.Provider, { value }, children);
}

export function useBills(): Ctx {
  const ctx = useContext(BillsContext);
  if (!ctx) throw new Error('useBills must be used inside <BillsProvider>');
  return ctx;
}
