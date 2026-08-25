import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMoney, formatRate } from '../../../src/core/money';
import { splitBill, type PersonShare } from '../../../src/core/split';
import { shareLink } from '../../../src/data/link';
import { personText, shareText } from '../../../src/data/share';
import { useBills } from '../../../src/data/store';
import { Avatar } from '../../../src/ui/components/Avatar';
import { AppButton, Card, Pill, Row, SectionLabel } from '../../../src/ui/components/base';
import { palette, personColor, radius, space, type as typo } from '../../../src/ui/theme';
import type { Bill, TipConfig } from '../../../src/core/types';

const TIP_PRESETS: Array<{ label: string; tip: Partial<TipConfig> }> = [
  { label: 'No tip', tip: { mode: 'none', percent: 0 } },
  { label: '5%', tip: { mode: 'percent', percent: 0.05 } },
  { label: '10%', tip: { mode: 'percent', percent: 0.1 } },
  { label: '15%', tip: { mode: 'percent', percent: 0.15 } },
];

/** "split 3 ways · no VAT" — whichever of those actually apply. */
function lineHint(line: PersonShare['lines'][number]): string | undefined {
  const notes: string[] = [];
  if (line.ways > 1) {
    notes.push(`split ${line.ways} ways${line.share !== 1 ? ` · ${line.share}/${line.totalShares} shares` : ''}`);
  }
  if (!line.taxable) notes.push('no VAT');
  return notes.length ? notes.join(' · ') : undefined;
}

function PersonCard({
  bill,
  share,
  symbol,
  serviceLabel,
  onCopy,
}: {
  bill: Bill;
  share: PersonShare;
  symbol: string;
  serviceLabel: string;
  onCopy: () => void;
}) {
  const { toggleSettled } = useBills();
  const [open, setOpen] = useState(false);
  const person = bill.people.find((p) => p.id === share.personId);
  if (!person) return null;

  const paid = Boolean(bill.settled[person.id]);
  const color = personColor(person.colorIndex);

  return (
    <Card style={[styles.personCard, paid && styles.personCardPaid]}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.personHead}>
        <Avatar person={person} size={44} dimmed={paid} />
        <View style={{ flex: 1 }}>
          <Text style={[typo.heading, { color: paid ? palette.textSoft : palette.text }]} numberOfLines={1}>
            {person.name}
          </Text>
          <Text style={[typo.small, { color: palette.textFaint, marginTop: 2 }]}>
            {share.lines.length === 0
              ? 'Nothing claimed'
              : `${share.lines.length} item${share.lines.length === 1 ? '' : 's'} · tap for the breakdown`}
          </Text>
        </View>
        <Text
          style={[
            typo.title,
            typo.mono,
            { color: paid ? palette.textFaint : color, textDecorationLine: paid ? 'line-through' : 'none' },
          ]}
        >
          {formatMoney(share.total, symbol)}
        </Text>
      </Pressable>

      {open ? (
        <View style={styles.breakdown}>
          {share.lines.map((line) => (
            <Row
              key={`${line.itemId}-${share.personId}`}
              label={line.description}
              hint={lineHint(line)}
              value={formatMoney(line.amount, symbol)}
            />
          ))}
          {share.lines.length > 0 ? <View style={styles.hr} /> : null}
          {share.serviceCharge > 0 ? <Row label={serviceLabel} value={formatMoney(share.serviceCharge, symbol)} /> : null}
          <Row
            label="VAT"
            hint={share.tax === 0 && share.itemsSubtotal > 0 ? 'nothing taxable ordered' : undefined}
            value={formatMoney(share.tax, symbol)}
          />
          {share.tip > 0 ? <Row label="Tip" value={formatMoney(share.tip, symbol)} /> : null}
          <View style={styles.hr} />
          <Row label="Owes" value={formatMoney(share.total, symbol)} emphasis />

          <View style={styles.personActions}>
            <Pressable onPress={onCopy} hitSlop={6}>
              <Text style={[typo.small, { color: palette.accent }]}>Copy their number</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Pressable
        onPress={() => toggleSettled(bill.id, person.id)}
        style={[styles.settle, paid && styles.settlePaid]}
        accessibilityRole="switch"
        accessibilityState={{ checked: paid }}
      >
        <Text style={[typo.small, { color: paid ? palette.good : palette.textSoft }]}>
          {paid ? '✓ Settled up' : 'Mark as settled'}
        </Text>
      </Pressable>
    </Card>
  );
}

export default function Summary() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getBill, setTip } = useBills();
  const [copied, setCopied] = useState<string | null>(null);
  const bill = getBill(String(id));

  const result = useMemo(() => (bill ? splitBill(bill) : null), [bill]);

  if (!bill || !result) {
    return (
      <View style={styles.centered}>
        <Text style={[typo.body, { color: palette.textSoft }]}>That bill is no longer here.</Text>
      </View>
    );
  }

  const symbol = bill.receipt.currency.symbol;
  const { totals } = result;
  const link = shareLink(bill, result);

  const copy = async (text: string, note: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(note);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}>
        {!result.fullyAssigned ? (
          <Card tone="warn">
            <Text style={[typo.heading, { color: palette.warn }]}>
              {result.unassignedItems.length} item{result.unassignedItems.length === 1 ? '' : 's'} unclaimed
            </Text>
            <Text style={[typo.body, { color: palette.text, marginTop: 6, lineHeight: 21 }]}>
              {formatMoney(result.unassigned.total, symbol)} isn’t on anybody yet — including its share of service and
              VAT. Nobody below is being charged for it.
            </Text>
            <Pressable onPress={() => router.push(`/bill/${bill.id}/assign`)} hitSlop={6} style={{ marginTop: space.md }}>
              <Text style={[typo.small, { color: palette.accent }]}>Go back and claim them →</Text>
            </Pressable>
          </Card>
        ) : null}

        {/* Tip */}
        <Card>
          <SectionLabel>Tip</SectionLabel>
          <View style={styles.presetRow}>
            {TIP_PRESETS.map((preset) => {
              const active =
                preset.tip.mode === bill.tip.mode &&
                (preset.tip.mode === 'none' || preset.tip.percent === bill.tip.percent);
              return (
                <Pressable
                  key={preset.label}
                  onPress={() => setTip(bill.id, { ...bill.tip, ...preset.tip, amount: 0 } as TipConfig)}
                  style={[styles.preset, active && styles.presetActive]}
                >
                  <Text style={[typo.small, { color: active ? '#FFFFFF' : palette.textSoft }]}>{preset.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {bill.tip.mode !== 'none' ? (
            <>
              <View style={[styles.presetRow, { marginTop: space.md }]}>
                {(['proportional', 'even'] as const).map((mode) => {
                  const active = bill.tip.split === mode;
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => setTip(bill.id, { ...bill.tip, split: mode })}
                      style={[styles.preset, active && styles.presetActive]}
                    >
                      <Text style={[typo.small, { color: active ? '#FFFFFF' : palette.textSoft }]}>
                        {mode === 'proportional' ? 'By what you ordered' : 'Evenly'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[typo.small, { color: palette.textFaint, marginTop: space.sm }]}>
                {formatMoney(result.tipTotal, symbol)} on top, {formatRate(bill.tip.percent)} of the item subtotal.
              </Text>
            </>
          ) : null}
        </Card>

        {/* Everyone's number */}
        <View>
          <SectionLabel>What everyone owes</SectionLabel>
          <View style={{ gap: space.md }}>
            {result.people.map((share) => (
              <PersonCard
                key={share.personId}
                bill={bill}
                share={share}
                symbol={symbol}
                serviceLabel={totals.service.label}
                onCopy={() => copy(personText(bill, result, share.personId), 'Copied')}
              />
            ))}
          </View>
        </View>

        {/* The bill itself */}
        <Card>
          <SectionLabel>The bill</SectionLabel>
          <Row label="Items" value={formatMoney(totals.itemsSubtotal, symbol)} />
          {totals.nonTaxableItems > 0 ? (
            <Row
              label="  not taxable"
              hint="lines the printer marked (N)"
              value={formatMoney(totals.nonTaxableItems, symbol)}
            />
          ) : null}
          {totals.service.amount > 0 ? (
            <Row label={totals.service.label} value={formatMoney(totals.service.amount, symbol)} />
          ) : (
            <Row label="Service charge" value="None" />
          )}
          <Row label={`VAT ${formatRate(totals.taxRate)}`} value={formatMoney(totals.taxAmount, symbol)} />
          {result.tipTotal > 0 ? <Row label="Tip" value={formatMoney(result.tipTotal, symbol)} /> : null}
          <View style={styles.hr} />
          <Row label="Grand total" value={formatMoney(result.grandTotal, symbol)} emphasis />
          <View style={styles.badgeRow}>
            {result.balanced ? (
              <Pill label="✓ Everyone's shares add back to the total" tone="good" />
            ) : (
              <Pill label="Shares do not add up — please report this" tone="bad" />
            )}
            {totals.reconciliation.ok ? <Pill label="✓ Matches the printed receipt" tone="good" /> : null}
          </View>
        </Card>

        <Text style={[typo.small, { color: palette.textFaint, textAlign: 'center', lineHeight: 18 }]}>
          Verdict works out the numbers and remembers who has paid. Sending the money happens wherever you normally
          send it.
        </Text>
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.md }]}>
        {copied ? (
          <Text style={[typo.small, { color: palette.good, textAlign: 'center', marginBottom: space.sm }]}>
            {copied} to the clipboard
          </Text>
        ) : null}
        {link ? (
          <Pressable onPress={() => copy(link, 'Copied a web link')} hitSlop={6} style={{ marginBottom: space.sm }}>
            <Text style={[typo.small, { color: palette.accent, textAlign: 'center' }]}>
              Copy a web link instead — opens in any browser, nothing to install
            </Text>
          </Pressable>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <AppButton
            label="Copy"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => copy(shareText(bill, result), 'Copied the whole split')}
          />
          <AppButton
            label="Send to the group"
            style={{ flex: 2 }}
            onPress={() => Share.share({ message: shareText(bill, result) }).catch(() => {})}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: space.lg, gap: space.lg },
  personCard: { padding: space.lg, gap: space.md },
  personCardPaid: { backgroundColor: palette.surfaceAlt },
  personHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  breakdown: { borderTopWidth: 1, borderTopColor: palette.line, paddingTop: space.sm },
  personActions: { flexDirection: 'row', marginTop: space.sm },
  settle: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.line,
  },
  settlePaid: { backgroundColor: palette.goodSoft, borderColor: '#BFE3C9' },
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
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
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
