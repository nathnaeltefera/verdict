import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMoney, formatRate, toMinor } from '../../../src/core/money';
import { computeTotals } from '../../../src/core/totals';
import { useBills } from '../../../src/data/store';
import { AppButton, Card, Pill, Row, SectionLabel } from '../../../src/ui/components/base';
import { palette, radius, space, type as typo } from '../../../src/ui/theme';
import type { LineItem } from '../../../src/core/types';

const RATE_PRESETS = [0, 0.02, 0.05, 0.1, 0.15];

function ItemEditor({
  item,
  symbol,
  onChange,
  onRemove,
}: {
  item: LineItem;
  symbol: string;
  onChange: (patch: Partial<LineItem>) => void;
  onRemove: () => void;
}) {
  const [amountText, setAmountText] = useState(String(item.amount / 100));

  return (
    <View style={styles.item}>
      <View style={styles.itemTop}>
        <TextInput
          value={item.description}
          onChangeText={(description) => onChange({ description })}
          style={[typo.body, styles.itemName]}
          placeholder="Item name"
          placeholderTextColor={palette.textFaint}
        />
        <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel={`Remove ${item.description}`}>
          <Text style={{ color: palette.textFaint, fontSize: 18, paddingHorizontal: 4 }}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.itemBottom}>
        <Text style={[typo.small, { color: palette.textFaint }]}>
          {item.qty} × {formatMoney(item.unitPrice, symbol)}
        </Text>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={() => onChange({ taxable: !item.taxable })}
          accessibilityRole="switch"
          accessibilityState={{ checked: item.taxable }}
          accessibilityLabel={`${item.description} is ${item.taxable ? 'taxable' : 'not taxable'}`}
        >
          <Pill label={item.taxable ? 'VAT' : 'No VAT'} tone={item.taxable ? 'accent' : 'neutral'} />
        </Pressable>

        <TextInput
          value={amountText}
          onChangeText={setAmountText}
          onBlur={() => {
            // Keep the unit price coherent with a hand-edited line total.
            const amount = toMinor(amountText);
            onChange({ amount, unitPrice: item.qty > 0 ? Math.round(amount / item.qty) : amount });
          }}
          keyboardType="decimal-pad"
          style={[typo.body, typo.mono, styles.itemAmount]}
        />
      </View>
    </View>
  );
}

export default function Review() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getBill, updateItem, addItem, removeItem, setServiceChargeOverride } = useBills();
  const bill = getBill(String(id));

  const totals = useMemo(() => (bill ? computeTotals(bill.receipt, bill.serviceChargeRateOverride) : null), [bill]);

  if (!bill || !totals) {
    return (
      <View style={styles.centered}>
        <Text style={[typo.body, { color: palette.textSoft }]}>That bill is no longer here.</Text>
      </View>
    );
  }

  const symbol = bill.receipt.currency.symbol;
  const { service, reconciliation } = totals;
  const overridden = bill.serviceChargeRateOverride !== undefined;
  const hasNonTaxable = totals.nonTaxableItems > 0;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}>
        <Card tone={reconciliation.ok ? 'good' : 'warn'}>
          <View style={styles.headRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typo.heading, { color: palette.text }]} numberOfLines={2}>
                {bill.receipt.merchant}
              </Text>
              <Text style={[typo.small, { color: palette.textSoft, marginTop: 3 }]}>
                {[bill.receipt.printedAt, bill.receipt.fsNo ? `FS ${bill.receipt.fsNo}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <Pill label={reconciliation.ok ? '✓ Ties out' : '⚠ Check it'} tone={reconciliation.ok ? 'good' : 'warn'} />
          </View>
          <Text style={[typo.small, { color: palette.textSoft, marginTop: space.sm, lineHeight: 19 }]}>
            {reconciliation.message}
          </Text>
        </Card>

        {/* Service charge — worked out from the paper, not assumed. */}
        <Card>
          <SectionLabel>Service charge</SectionLabel>
          <View style={styles.serviceRow}>
            <Text style={[typo.display, { color: service.amount > 0 ? palette.accent : palette.textFaint }]}>
              {service.amount > 0 ? formatRate(service.rate) : 'None'}
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={[typo.title, typo.mono, { color: palette.text }]}>{formatMoney(service.amount, symbol)}</Text>
          </View>

          <Text style={[typo.small, { color: palette.textSoft, marginTop: 4, lineHeight: 19 }]}>
            {overridden ? service.note : service.note}
            {service.amount > 0 ? ` Base ${formatMoney(service.base, symbol)}.` : ''}
          </Text>

          <View style={styles.badgeRow}>
            {service.verified && service.amount > 0 ? <Pill label="✓ Reproduces the printed amount" tone="good" /> : null}
            {overridden ? <Pill label="Set by hand" tone="warn" /> : null}
            {service.source === 'derived-exact' ? <Pill label="Unusual rate" tone="warn" /> : null}
          </View>

          <SectionLabel style={{ marginTop: space.lg }}>Not right? Set it yourself</SectionLabel>
          <View style={styles.presetRow}>
            {RATE_PRESETS.map((rate) => {
              const active = overridden && bill.serviceChargeRateOverride === rate;
              return (
                <Pressable
                  key={rate}
                  onPress={() => setServiceChargeOverride(bill.id, rate)}
                  style={[styles.preset, active && styles.presetActive]}
                >
                  <Text style={[typo.small, { color: active ? '#FFFFFF' : palette.textSoft }]}>
                    {rate === 0 ? 'None' : formatRate(rate)}
                  </Text>
                </Pressable>
              );
            })}
            {overridden ? (
              <Pressable onPress={() => setServiceChargeOverride(bill.id, undefined)} style={styles.preset}>
                <Text style={[typo.small, { color: palette.accent }]}>Use printed</Text>
              </Pressable>
            ) : null}
          </View>
        </Card>

        {/* Items */}
        <View>
          <View style={styles.itemsHead}>
            <SectionLabel style={{ marginBottom: 0 }}>
              {`${bill.receipt.items.length} line${bill.receipt.items.length === 1 ? '' : 's'}`}
            </SectionLabel>
            <Pressable onPress={() => addItem(bill.id)} hitSlop={8}>
              <Text style={[typo.small, { color: palette.accent }]}>+ Add a line</Text>
            </Pressable>
          </View>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {bill.receipt.items.map((item, index) => (
              <View key={item.id} style={index > 0 ? styles.itemDivider : undefined}>
                <ItemEditor
                  item={item}
                  symbol={symbol}
                  onChange={(patch) => updateItem(bill.id, item.id, patch)}
                  onRemove={() => removeItem(bill.id, item.id)}
                />
              </View>
            ))}
          </Card>
          <Text style={[typo.small, { color: palette.textFaint, marginTop: space.sm, lineHeight: 18 }]}>
            Tap VAT / No VAT to change whether a line is taxed. Lines the printer marked “(N)” come in as No VAT —
            they stay out of the tax base, so whoever ordered them isn’t charged VAT on them.
          </Text>
        </View>

        {/* The arithmetic, laid out the way the till does it. */}
        <Card>
          <SectionLabel>How it adds up</SectionLabel>
          <Row label="Items" value={formatMoney(totals.itemsSubtotal, symbol)} />
          {hasNonTaxable ? (
            <>
              <Row label="  of which taxable" value={formatMoney(totals.taxableItems, symbol)} />
              <Row label="  of which not taxable" value={formatMoney(totals.nonTaxableItems, symbol)} />
            </>
          ) : null}
          {service.amount > 0 ? (
            <Row label={service.label} value={formatMoney(service.amount, symbol)} hint={`on ${formatMoney(service.base, symbol)}`} />
          ) : null}
          <View style={styles.hr} />
          <Row label="Taxable base" value={formatMoney(totals.taxableBase, symbol)} />
          <Row label={`VAT ${formatRate(totals.taxRate)}`} value={formatMoney(totals.taxAmount, symbol)} />
          <View style={styles.hr} />
          <Row label="Total" value={formatMoney(totals.total, symbol)} emphasis />
          {reconciliation.printedTotal !== undefined ? (
            <Row
              label="Printed on the receipt"
              value={formatMoney(reconciliation.printedTotal, symbol)}
              tone={reconciliation.ok ? 'good' : 'bad'}
            />
          ) : null}
        </Card>
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.md }]}>
        <AppButton label="Looks right — add people" onPress={() => router.push(`/bill/${bill.id}/people`)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: space.lg, gap: space.lg },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  serviceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  preset: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.line,
  },
  presetActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  itemsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  item: { padding: space.md, gap: space.sm },
  itemDivider: { borderTopWidth: 1, borderTopColor: palette.line },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  itemName: { flex: 1, color: palette.text, paddingVertical: 2 },
  itemBottom: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  itemAmount: {
    color: palette.text,
    minWidth: 84,
    textAlign: 'right',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    backgroundColor: palette.surfaceAlt,
  },
  hr: { height: 1, backgroundColor: palette.line, marginVertical: space.sm },
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
  },
});
