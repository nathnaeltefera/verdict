import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { formatMoney, formatRate } from '../../../src/core/money';
import { splitBill, type PersonShare } from '../../../src/core/split';
import { shareLink } from '../../../src/data/link';
import { personText, shareText } from '../../../src/data/share';
import { useBills } from '../../../src/data/store';
import { Avatar } from '../../../src/ui/components/Avatar';
import { AppButton, Card, DottedRule, Pill, Row, SectionLabel } from '../../../src/ui/components/base';
import { Collapse } from '../../../src/ui/components/Collapse';
import { PresetRow } from '../../../src/ui/components/PresetRow';
import { ReceiptEdge } from '../../../src/ui/components/ReceiptEdge';
import { Centered, Screen } from '../../../src/ui/components/Screen';
import { SettledStamp } from '../../../src/ui/components/SettledStamp';
import { Stagger } from '../../../src/ui/components/Stagger';
import { useToast } from '../../../src/ui/components/Toast';
import { hairline, palette, personColor, radius, shadow, space, tones, type as typo } from '../../../src/ui/theme';
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
  const chevron = useRef(new Animated.Value(0)).current;
  const person = bill.people.find((p) => p.id === share.personId);
  if (!person) return null;

  const paid = Boolean(bill.settled[person.id]);
  const color = personColor(person.colorIndex);

  const toggleOpen = () => {
    Animated.spring(chevron, { toValue: open ? 0 : 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
    setOpen((v) => !v);
  };

  const settle = () => {
    if (Platform.OS !== 'web') {
      (paid
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      ).catch(() => {});
    }
    toggleSettled(bill.id, person.id);
  };

  const rotate = chevron.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <Card style={[styles.personCard, paid && styles.personCardPaid]}>
      <Pressable
        onPress={toggleOpen}
        style={styles.personHead}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${person.name}, owes ${formatMoney(share.total, symbol)}`}
      >
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
            typo.monoBold,
            {
              fontSize: 18,
              color: paid ? palette.textFaint : color,
              textDecorationLine: paid ? 'line-through' : 'none',
            },
          ]}
        >
          {formatMoney(share.total, symbol)}
        </Text>
        <Animated.Text style={[typo.small, { color: palette.textFaint, transform: [{ rotate }] }]}>⌄</Animated.Text>
      </Pressable>

      <Collapse open={open}>
        <View style={styles.breakdown}>
          {share.lines.map((line) => (
            <Row
              key={`${line.itemId}-${share.personId}`}
              label={line.description}
              hint={lineHint(line)}
              value={formatMoney(line.amount, symbol)}
            />
          ))}
          {share.lines.length > 0 ? <DottedRule /> : null}
          {share.serviceCharge > 0 ? <Row label={serviceLabel} value={formatMoney(share.serviceCharge, symbol)} /> : null}
          <Row
            label="VAT"
            hint={share.tax === 0 && share.itemsSubtotal > 0 ? 'nothing taxable ordered' : undefined}
            value={formatMoney(share.tax, symbol)}
          />
          {share.tip > 0 ? <Row label="Tip" value={formatMoney(share.tip, symbol)} /> : null}
          <DottedRule />
          <Row label="Owes" value={formatMoney(share.total, symbol)} emphasis />

          <View style={styles.personActions}>
            <Pressable onPress={onCopy} hitSlop={6} accessibilityRole="button">
              <Text style={[typo.small, { color: palette.accent }]}>Copy their number</Text>
            </Pressable>
          </View>
        </View>
      </Collapse>

      <Pressable
        onPress={settle}
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
  const { getBill, setTip } = useBills();
  const toast = useToast();
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
  const { totals } = result;
  const link = shareLink(bill, result);
  const allSettled = bill.people.length > 0 && bill.people.every((p) => bill.settled[p.id]);

  const activeTipKey = TIP_PRESETS.find(
    (preset) =>
      preset.tip.mode === bill.tip.mode && (preset.tip.mode === 'none' || preset.tip.percent === bill.tip.percent),
  )?.label;

  const copy = async (text: string, note: string) => {
    await Clipboard.setStringAsync(text);
    toast.show(`${note} to the clipboard`);
  };

  return (
    <Screen
      dock={
        <>
          {link ? (
            <Pressable
              onPress={() => copy(link, 'Copied a web link')}
              hitSlop={6}
              style={{ marginBottom: space.sm }}
              accessibilityRole="button"
            >
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
              onPress={() => {
                const text = shareText(bill, result);
                // Browsers without a native share sheet reject — fall back to the clipboard
                // rather than leaving the button feeling broken.
                Share.share({ message: text }).catch(() => copy(text, 'Copied the whole split'));
              }}
            />
          </View>
        </>
      }
    >
      <Stagger>
        {!result.fullyAssigned ? (
          <Card tone="warn">
            <Text style={[typo.heading, { color: palette.warn }]}>
              {result.unassignedItems.length} item{result.unassignedItems.length === 1 ? '' : 's'} unclaimed
            </Text>
            <Text style={[typo.body, { color: palette.text, marginTop: 6, lineHeight: 21 }]}>
              {formatMoney(result.unassigned.total, symbol)} isn’t on anybody yet — including its share of service and
              VAT. Nobody below is being charged for it.
            </Text>
            <Pressable onPress={() => router.back()} hitSlop={6} style={{ marginTop: space.md }} accessibilityRole="button">
              <Text style={[typo.small, { color: palette.accent }]}>Go back and claim them →</Text>
            </Pressable>
          </Card>
        ) : null}

        {/* Tip */}
        <Card>
          <SectionLabel>Tip</SectionLabel>
          <PresetRow
            options={TIP_PRESETS.map((preset) => ({ key: preset.label, label: preset.label }))}
            activeKey={activeTipKey}
            onSelect={(label) => {
              const preset = TIP_PRESETS.find((p) => p.label === label)!;
              setTip(bill.id, { ...bill.tip, ...preset.tip, amount: 0 } as TipConfig);
            }}
          />

          {bill.tip.mode !== 'none' ? (
            <>
              <View style={{ marginTop: space.md }}>
                <PresetRow
                  options={[
                    { key: 'proportional' as const, label: 'By what you ordered' },
                    { key: 'even' as const, label: 'Evenly' },
                  ]}
                  activeKey={bill.tip.split}
                  onSelect={(mode) => setTip(bill.id, { ...bill.tip, split: mode })}
                />
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

        {/* The bill itself — the receipt artifact. */}
        <View style={shadow.card}>
          <ReceiptEdge edge="top" color={palette.surface} />
          <View style={styles.receipt}>
            <Text style={[typo.title, { color: palette.text, textAlign: 'center' }]} numberOfLines={2}>
              {bill.receipt.merchant}
            </Text>
            <Text style={[typo.tiny, { color: palette.textFaint, textAlign: 'center', marginTop: 4 }]}>
              THE BILL
            </Text>
            <DottedRule style={{ marginVertical: space.md }} />
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
            <DottedRule />
            <Row label="Grand total" value={formatMoney(result.grandTotal, symbol)} emphasis />
            <View style={styles.badgeRow}>
              {result.balanced ? (
                <Pill label="✓ Everyone's shares add back to the total" tone="good" />
              ) : (
                <Pill label="Shares do not add up — please report this" tone="bad" />
              )}
              {totals.reconciliation.ok ? <Pill label="✓ Matches the printed receipt" tone="good" /> : null}
            </View>
            {allSettled ? <SettledStamp style={styles.stamp} /> : null}
          </View>
          <ReceiptEdge edge="bottom" color={palette.surface} />
        </View>

        <Text style={[typo.small, { color: palette.textFaint, textAlign: 'center', lineHeight: 18 }]}>
          Verdict works out the numbers and remembers who has paid. Sending the money happens wherever you normally
          send it.
        </Text>
      </Stagger>
    </Screen>
  );
}

const styles = StyleSheet.create({
  personCard: { padding: space.lg, gap: space.md },
  personCardPaid: { backgroundColor: palette.surfaceAlt },
  personHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  breakdown: { borderTopWidth: hairline, borderTopColor: palette.line, paddingTop: space.sm },
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
  settlePaid: { backgroundColor: palette.goodSoft, borderColor: tones.good.line },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  receipt: {
    backgroundColor: palette.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  stamp: { position: 'absolute', top: space.md, right: space.md },
});
