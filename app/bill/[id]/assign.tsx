import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMoney } from '../../../src/core/money';
import { previewLineSplit, splitBill } from '../../../src/core/split';
import { useBills } from '../../../src/data/store';
import { ClaimChip } from '../../../src/ui/components/Avatar';
import { AppButton, Card, Pill, Progress, SectionLabel } from '../../../src/ui/components/base';
import { Dock, DOCK_ALLOWANCE } from '../../../src/ui/components/Dock';
import { Centered } from '../../../src/ui/components/Screen';
import { Stagger } from '../../../src/ui/components/Stagger';
import { hairline, palette, personColor, radius, space, tones, type as typo } from '../../../src/ui/theme';
import type { Bill, LineItem } from '../../../src/core/types';

/** "Nobody yet" / "Just Sara" / "Shared 3 ways · Br 126.30 each". */
function claimSummary(bill: Bill, item: LineItem, symbol: string): { text: string; tone: 'neutral' | 'good' | 'warn' } {
  const claims = bill.assignments[item.id] ?? {};
  const ids = Object.keys(claims).filter((pid) => bill.people.some((p) => p.id === pid));
  if (ids.length === 0) return { text: 'Nobody yet — tap whoever ordered it', tone: 'warn' };

  if (ids.length === 1) {
    const person = bill.people.find((p) => p.id === ids[0])!;
    return { text: `${person.name} — ${formatMoney(item.amount, symbol)}`, tone: 'good' };
  }

  // "Uneven" is about the shares people were given, not the leftover cent. An
  // amount like 273.28 across three never divides exactly, and calling that
  // "uneven" would be alarming nonsense — show the range instead.
  const unevenShares = ids.some((pid) => claims[pid] !== claims[ids[0]]);
  if (unevenShares) return { text: `Shared ${ids.length} ways, unevenly`, tone: 'good' };

  const amounts = previewLineSplit(bill, item).map((p) => p.amount);
  const low = Math.min(...amounts);
  const high = Math.max(...amounts);
  const each =
    low === high
      ? `${formatMoney(low, symbol)} each`
      : `${formatMoney(low, symbol)}–${formatMoney(high, '').trim()}`;
  return { text: `Shared ${ids.length} ways · ${each}`, tone: 'good' };
}

function ItemCard({ bill, item, symbol }: { bill: Bill; item: LineItem; symbol: string }) {
  const { toggleClaim, setShare, claimForEveryone, clearClaims } = useBills();
  const [showShares, setShowShares] = useState(false);

  const claims = bill.assignments[item.id] ?? {};
  const amounts = useMemo(
    () => Object.fromEntries(previewLineSplit(bill, item).map((p) => [p.personId, p.amount])),
    [bill, item],
  );
  const summary = claimSummary(bill, item, symbol);
  const claimedCount = Object.keys(claims).filter((pid) => bill.people.some((p) => p.id === pid)).length;

  return (
    <Card style={[styles.itemCard, claimedCount === 0 && styles.itemCardUnclaimed]}>
      <View style={styles.itemHead}>
        <View style={{ flex: 1 }}>
          <Text style={[typo.heading, { color: palette.text }]}>{item.description}</Text>
          <Text style={[typo.small, typo.mono, { fontSize: 12, color: palette.textFaint, marginTop: 3 }]}>
            {item.qty > 1 ? `${item.qty} × ${formatMoney(item.unitPrice, symbol)}` : 'Qty 1'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={[typo.monoBold, { fontSize: 18, color: palette.text }]}>{formatMoney(item.amount, symbol)}</Text>
          {!item.taxable ? <Pill label="No VAT" tone="neutral" /> : null}
        </View>
      </View>

      <Text style={[typo.small, { color: summary.tone === 'warn' ? palette.warn : palette.good }]}>{summary.text}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {bill.people.map((person) => (
          <View key={person.id} style={{ alignItems: 'center' }}>
            <ClaimChip
              person={person}
              claimed={Boolean(claims[person.id])}
              amount={amounts[person.id] !== undefined ? formatMoney(amounts[person.id], symbol) : undefined}
              onPress={() => toggleClaim(bill.id, item.id, person.id)}
              onLongPress={() => setShowShares((v) => !v)}
            />
            {showShares && claims[person.id] ? (
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => setShare(bill.id, item.id, person.id, Math.max(1, (claims[person.id] ?? 1) - 1))}
                  hitSlop={8}
                  style={styles.stepButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Fewer shares for ${person.name}`}
                >
                  <Text style={styles.stepText}>−</Text>
                </Pressable>
                <Text
                  style={[typo.monoBold, { fontSize: 13, color: personColor(person.colorIndex), minWidth: 20, textAlign: 'center' }]}
                >
                  {claims[person.id]}
                </Text>
                <Pressable
                  onPress={() => setShare(bill.id, item.id, person.id, (claims[person.id] ?? 1) + 1)}
                  hitSlop={8}
                  style={styles.stepButton}
                  accessibilityRole="button"
                  accessibilityLabel={`More shares for ${person.name}`}
                >
                  <Text style={styles.stepText}>+</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <View style={styles.itemActions}>
        <Pressable onPress={() => claimForEveryone(bill.id, item.id)} hitSlop={6} accessibilityRole="button">
          <Text style={[typo.small, { color: palette.accent }]}>Everyone</Text>
        </Pressable>
        {claimedCount > 1 ? (
          <Pressable onPress={() => setShowShares((v) => !v)} hitSlop={6} accessibilityRole="button">
            <Text style={[typo.small, { color: palette.accent }]}>{showShares ? 'Done' : 'Uneven shares'}</Text>
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }} />
        {claimedCount > 0 ? (
          <Pressable onPress={() => clearClaims(bill.id, item.id)} hitSlop={6} accessibilityRole="button">
            <Text style={[typo.small, { color: palette.textFaint }]}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

export default function Assign() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getBill, splitEverythingEvenly } = useBills();
  const bill = getBill(String(id));

  const result = useMemo(() => (bill ? splitBill(bill) : null), [bill]);

  if (!bill || !result) {
    return (
      <Centered>
        <Text style={[typo.body, { color: palette.textSoft }]}>That bill is no longer here.</Text>
      </Centered>
    );
  }

  const symbol = bill.receipt.currency.symbol;
  const remaining = result.itemCount - result.assignedItemCount;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Progress
          value={result.itemCount === 0 ? 1 : result.assignedItemCount / result.itemCount}
          label={
            remaining === 0
              ? '✓ Everything is claimed'
              : `${result.assignedItemCount} of ${result.itemCount} claimed · ${formatMoney(result.unassigned.itemsSubtotal, symbol)} still up for grabs`
          }
        />
        <View style={styles.headerActions}>
          <Pressable onPress={() => splitEverythingEvenly(bill.id)} hitSlop={6} accessibilityRole="button">
            <Text style={[typo.small, { color: palette.accent }]}>Split everything evenly</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => router.navigate(`/bill/${bill.id}/people`)} hitSlop={6} accessibilityRole="button">
            <Text style={[typo.small, { color: palette.accent }]}>Edit people</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + DOCK_ALLOWANCE }]}>
        <Stagger>
          <SectionLabel>Tap a face to put them on a dish. Tap two or more to share it.</SectionLabel>
          {bill.receipt.items.map((item) => (
            <ItemCard key={item.id} bill={bill} item={item} symbol={symbol} />
          ))}
        </Stagger>
      </ScrollView>

      <Dock>
        <AppButton
          label={remaining === 0 ? 'See what everyone owes' : `See totals (${remaining} unclaimed)`}
          onPress={() => router.push(`/bill/${bill.id}/summary`)}
        />
      </Dock>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  header: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    backgroundColor: palette.bg,
    borderBottomWidth: hairline,
    borderBottomColor: palette.line,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', marginTop: space.md },
  content: { padding: space.lg, gap: space.md },
  itemCard: { gap: space.sm, padding: space.lg },
  itemCardUnclaimed: { borderColor: tones.warn.line, backgroundColor: palette.warnSoft },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  chipRow: { gap: space.xs, paddingVertical: space.xs, paddingRight: space.lg },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
    backgroundColor: palette.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepButton: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 16, fontWeight: '800', color: palette.textSoft, lineHeight: 18 },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: 2 },
});
