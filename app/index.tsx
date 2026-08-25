import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMoney } from '../src/core/money';
import { splitBill } from '../src/core/split';
import { LOMYAD, MESSANTA_COFFEE } from '../src/core/fixtures';
import { useBills } from '../src/data/store';
import { AppButton, Card, EmptyState, Pill, SectionLabel } from '../src/ui/components/base';
import { AvatarStack } from '../src/ui/components/Avatar';
import { palette, radius, space, type as typo } from '../src/ui/theme';
import type { Bill } from '../src/core/types';

function relativeDate(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function BillRow({ bill, onPress, onLongPress }: { bill: Bill; onPress: () => void; onLongPress: () => void }) {
  const result = useMemo(() => splitBill(bill), [bill]);
  const settledCount = bill.people.filter((p) => bill.settled[p.id]).length;
  const allSettled = bill.people.length > 0 && settledCount === bill.people.length;

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
      <Card style={styles.billCard}>
        <View style={styles.billHead}>
          <View style={{ flex: 1 }}>
            <Text style={[typo.heading, { color: palette.text }]} numberOfLines={1}>
              {bill.title}
            </Text>
            <Text style={[typo.small, { color: palette.textFaint, marginTop: 3 }]}>
              {relativeDate(bill.createdAt)} · {result.itemCount} item{result.itemCount === 1 ? '' : 's'}
            </Text>
          </View>
          <Text style={[typo.title, typo.mono, { color: palette.text }]}>
            {formatMoney(result.grandTotal, bill.receipt.currency.symbol)}
          </Text>
        </View>

        <View style={styles.billFoot}>
          {bill.people.length > 0 ? (
            <AvatarStack people={bill.people} />
          ) : (
            <Text style={[typo.small, { color: palette.textFaint }]}>Nobody added yet</Text>
          )}
          <View style={{ flex: 1 }} />
          {allSettled ? (
            <Pill label="Settled" tone="good" />
          ) : !result.fullyAssigned ? (
            <Pill label={`${result.itemCount - result.assignedItemCount} unclaimed`} tone="warn" />
          ) : (
            <Pill label={`${settledCount}/${bill.people.length} paid`} tone="accent" />
          )}
        </View>
      </Card>
    </Pressable>
  );
}

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bills, ready, createBill, deleteBill } = useBills();

  const openSample = (which: 'messanta' | 'lomyad') => {
    const receipt = which === 'messanta' ? MESSANTA_COFFEE : LOMYAD;
    const bill = createBill({ ...receipt, id: `${receipt.id}-${Date.now()}` });
    router.push(`/bill/${bill.id}/review`);
  };

  const confirmDelete = (bill: Bill) => {
    Alert.alert('Delete this bill?', `"${bill.title}" and its split will be removed from this phone.`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteBill(bill.id) },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}>
        <Text style={[typo.display, { color: palette.text }]}>Split the bill</Text>
        <Text style={[typo.body, { color: palette.textSoft, marginTop: 6, lineHeight: 22 }]}>
          Photograph the receipt, tap who had what, and everyone gets their number — service charge and VAT
          included, worked out per person.
        </Text>

        {!ready ? null : bills.length === 0 ? (
          <>
            <EmptyState
              emoji="🧾"
              title="No bills yet"
              body="Scan your first receipt, or open one of the two sample receipts to see how the maths comes out."
            />
            <SectionLabel style={{ marginTop: space.sm }}>Try a sample</SectionLabel>
            <View style={{ gap: space.sm }}>
              <AppButton label="Messanta Coffee · 5% service" variant="secondary" onPress={() => openSample('messanta')} />
              <AppButton label="Lomyad · mixed VAT lines" variant="secondary" onPress={() => openSample('lomyad')} />
            </View>
          </>
        ) : (
          <>
            <SectionLabel style={{ marginTop: space.xl }}>Past bills</SectionLabel>
            <View style={{ gap: space.md }}>
              {bills.map((bill) => (
                <BillRow
                  key={bill.id}
                  bill={bill}
                  onPress={() => router.push(`/bill/${bill.id}/${bill.people.length ? 'assign' : 'review'}`)}
                  onLongPress={() => confirmDelete(bill)}
                />
              ))}
            </View>
            <Text style={[typo.small, { color: palette.textFaint, marginTop: space.md, textAlign: 'center' }]}>
              Bills stay on this phone until you delete them. Press and hold one to remove it.
            </Text>
          </>
        )}
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.md }]}>
        <AppButton label="Scan a receipt" icon="📷" onPress={() => router.push('/scan')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { padding: space.lg, gap: space.sm },
  billCard: { padding: space.lg, gap: space.md },
  billHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  billFoot: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: palette.bg,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
});
