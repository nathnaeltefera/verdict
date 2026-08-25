import { formatMoney, formatRate } from '../core/money';
import type { SplitResult } from '../core/split';
import type { Bill } from '../core/types';

/**
 * The message you paste into the group chat. Deliberately plain text: it has to
 * survive being copied into WhatsApp, Telegram or SMS without turning to soup.
 *
 * Verdict does not move money. It tells everyone their number and remembers who
 * has settled — the transfer itself happens wherever you normally send it.
 */
export function shareText(bill: Bill, result: SplitResult): string {
  const symbol = bill.receipt.currency.symbol;
  const lines: string[] = [];

  lines.push(bill.receipt.merchant);
  if (bill.receipt.printedAt) lines.push(bill.receipt.printedAt);
  lines.push('');

  for (const person of bill.people) {
    const share = result.people.find((p) => p.personId === person.id);
    if (!share) continue;
    const paid = bill.settled[person.id] ? ' ✓ paid' : '';
    lines.push(`${person.name}: ${formatMoney(share.total, symbol)}${paid}`);
    for (const line of share.lines) {
      const shared = line.ways > 1 ? ` (${line.ways}-way split)` : '';
      lines.push(`   ${line.description}${shared} — ${formatMoney(line.amount, symbol)}`);
    }
    const extras: string[] = [];
    if (share.serviceCharge > 0) extras.push(`service ${formatMoney(share.serviceCharge, symbol)}`);
    if (share.tax > 0) extras.push(`VAT ${formatMoney(share.tax, symbol)}`);
    if (share.tip > 0) extras.push(`tip ${formatMoney(share.tip, symbol)}`);
    if (extras.length) lines.push(`   + ${extras.join(', ')}`);
    lines.push('');
  }

  if (result.unassignedItems.length > 0) {
    lines.push(`Unclaimed: ${formatMoney(result.unassigned.total, symbol)}`);
    for (const item of result.unassignedItems) {
      lines.push(`   ${item.description} — ${formatMoney(item.amount, symbol)}`);
    }
    lines.push('');
  }

  const { totals } = result;
  lines.push('—');
  lines.push(`Items ${formatMoney(totals.itemsSubtotal, symbol)}`);
  if (totals.nonTaxableItems > 0) {
    lines.push(`  taxable ${formatMoney(totals.taxableItems, symbol)} · not taxable ${formatMoney(totals.nonTaxableItems, symbol)}`);
  }
  if (totals.service.amount > 0) {
    lines.push(`${totals.service.label} ${formatMoney(totals.service.amount, symbol)}`);
  }
  lines.push(`VAT ${formatRate(totals.taxRate)} ${formatMoney(totals.taxAmount, symbol)}`);
  if (result.tipTotal > 0) lines.push(`Tip ${formatMoney(result.tipTotal, symbol)}`);
  lines.push(`Total ${formatMoney(result.grandTotal, symbol)}`);

  return lines.join('\n');
}

/** One person's line, for nudging a single friend. */
export function personText(bill: Bill, result: SplitResult, personId: string): string {
  const person = bill.people.find((p) => p.id === personId);
  const share = result.people.find((p) => p.personId === personId);
  if (!person || !share) return '';
  const symbol = bill.receipt.currency.symbol;

  const lines = [`${person.name} — ${formatMoney(share.total, symbol)} for ${bill.receipt.merchant}`, ''];
  for (const line of share.lines) {
    const shared = line.ways > 1 ? ` (split ${line.ways} ways)` : '';
    lines.push(`${line.description}${shared} — ${formatMoney(line.amount, symbol)}`);
  }
  if (share.serviceCharge > 0) lines.push(`${result.totals.service.label} — ${formatMoney(share.serviceCharge, symbol)}`);
  if (share.tax > 0) lines.push(`VAT — ${formatMoney(share.tax, symbol)}`);
  else if (share.itemsSubtotal > 0) lines.push('VAT — none (nothing taxable ordered)');
  if (share.tip > 0) lines.push(`Tip — ${formatMoney(share.tip, symbol)}`);
  return lines.join('\n');
}
