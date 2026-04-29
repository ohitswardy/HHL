import { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Modal } from '../../../components/ui/Modal';
import { Spinner } from '../../../components/ui/Spinner';
import api from '../../../lib/api';
import type { JournalEntry, JournalLine } from '../../../types';
import dayjs from 'dayjs';

// ── Types for fetched source data ────────────────────────────────────────────

interface SaleItem {
  id: number;
  product: { id: number; name: string; sku: string } | null;
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
}

interface SalePayment {
  id: number;
  payment_method: string;
  amount: number;
  status: string;
}

interface SaleSource {
  id: number;
  transaction_number: string;
  client?: { business_name: string } | null;
  subtotal: number;
  discount_amount: number;
  delivery_fee: number;
  tax_amount: number;
  total_amount: number;
  items: SaleItem[];
  payments: SalePayment[];
}

interface PurchaseItem {
  id: number;
  product?: { name: string; sku: string } | null;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
}

interface PurchaseSource {
  id: number;
  po_number: string;
  supplier?: { name: string } | null;
  total_amount: number;
  items: PurchaseItem[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash:          'Cash',
  card:          'Card',
  business_bank: 'Business Bank Transfer',
  bank_transfer: 'Bank Transfer',
  credit:        'Credit (AR)',
  cheque:        'Cheque',
};

const SOURCE_LABELS: Record<string, string> = {
  sale:             'Point of Sale',
  sale_reversal:    'Sale Reversal',
  purchase:         'Purchase Order',
  purchase_partial: 'Partial Purchase',
  payment:          'Payment',
  expense:          'Expense',
};

function fmtCurrency(n: number) {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function referenceLabel(type: string | null, id: number | null) {
  if (!type || !id) return 'Manual Entry';
  return `${SOURCE_LABELS[type] ?? type} #${id}`;
}

// ── Breakdown derivation ─────────────────────────────────────────────────────
// Given a journal line and the raw source document, return human-readable rows
// explaining where the number came from.

interface BreakdownRow {
  label: string;
  sublabel?: string;
  amount: number;
}

function deriveBreakdown(
  line: JournalLine,
  refType: string | null,
  sale: SaleSource | null,
  purchase: PurchaseSource | null,
): BreakdownRow[] | null {
  const code = line.account?.code ?? '';
  const amount = line.debit > 0 ? line.debit : line.credit;

  // ── SALE entries ──────────────────────────────────────────────────────────
  if ((refType === 'sale' || refType === 'sale_reversal') && sale) {
    // 1010 Cash on Hand — cash/card payments
    if (code === '1010') {
      const rows = sale.payments
        .filter(p => p.status === 'confirmed' && ['cash', 'card'].includes(p.payment_method))
        .map(p => ({
          label: PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method,
          sublabel: `Payment #${p.id}`,
          amount: p.amount,
        }));
      return rows.length ? rows : [{ label: 'Cash / Card received', amount }];
    }

    // 1020 Cash in Bank — business bank payments
    if (code === '1020') {
      const rows = sale.payments
        .filter(p => p.status === 'confirmed' && ['business_bank', 'bank_transfer'].includes(p.payment_method))
        .map(p => ({
          label: PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method,
          sublabel: `Payment #${p.id}`,
          amount: p.amount,
        }));
      return rows.length ? rows : [{ label: 'Bank payment received', amount }];
    }

    // 1100 Accounts Receivable — credit portion
    if (code === '1100') {
      const cashPaid = sale.payments
        .filter(p => p.status === 'confirmed' && p.payment_method !== 'credit')
        .reduce((s, p) => s + p.amount, 0);
      const creditAmount = sale.total_amount - Math.min(cashPaid, sale.total_amount);
      return [
        { label: 'Invoice total', amount: sale.total_amount },
        { label: 'Less: cash/bank collected', amount: -Math.min(cashPaid, sale.total_amount) },
        { label: 'Balance on account (AR)', amount: creditAmount },
      ];
    }

    // 4010 / 4020 Sales Revenue
    if (code === '4010' || code === '4020') {
      const rows: BreakdownRow[] = sale.items.map(item => ({
        label: item.product?.name ?? `Product #${item.product_id}`,
        sublabel: `${item.quantity} × ₱${fmtCurrency(item.unit_price)}${item.discount > 0 ? ` − ₱${fmtCurrency(item.discount)} disc` : ''}`,
        amount: item.line_total,
      }));
      if (sale.discount_amount > 0)
        rows.push({ label: 'Transaction discount', amount: -sale.discount_amount });
      if (sale.delivery_fee > 0)
        rows.push({ label: 'Delivery fee', amount: sale.delivery_fee });
      // If VATable, strip VAT from revenue
      if (code === '4020' && sale.tax_amount > 0) {
        rows.push({ label: 'Less: Output VAT (12%)', amount: -sale.tax_amount });
      }
      return rows;
    }

    // 2100 VAT Payable — explicit tax amount
    if (code === '2100') {
      return [
        { label: 'Sale total (VAT-inclusive)', amount: sale.total_amount },
        { label: 'Net revenue (÷ 1.12)', amount: sale.total_amount - sale.tax_amount },
        { label: 'Output VAT (12%)', amount: sale.tax_amount },
      ];
    }

    // 5010 / 5011 COGS
    if (code === '5010' || code === '5011') {
      return sale.items.map(item => ({
        label: item.product?.name ?? `Product #${item.product_id}`,
        sublabel: `${item.quantity} units × cost price`,
        amount: item.line_total, // approximation shown; actual = cost_price × qty which we don't have here
      }));
    }

    // 1200 Inventory — mirrors COGS credit
    if (code === '1200') {
      return [
        {
          label: `${sale.items.length} product(s) sold — inventory reduced`,
          sublabel: 'Cost of goods transferred to COGS',
          amount,
        },
        ...sale.items.map(item => ({
          label: item.product?.name ?? `Product #${item.product_id}`,
          sublabel: `${item.quantity} unit(s) removed`,
          amount: 0,
        })),
      ];
    }
  }

  // ── PURCHASE entries ──────────────────────────────────────────────────────
  if ((refType === 'purchase' || refType === 'purchase_partial') && purchase) {
    // 1200 Inventory DR
    if (code === '1200') {
      return purchase.items
        .filter(i => (refType === 'purchase' ? i.quantity_ordered : i.quantity_received) > 0)
        .map(i => {
          const qty = refType === 'purchase' ? i.quantity_ordered : i.quantity_received;
          return {
            label: i.product?.name ?? 'Unknown product',
            sublabel: `${qty} units × ₱${fmtCurrency(i.unit_cost)}`,
            amount: qty * i.unit_cost,
          };
        });
    }

    // 2010 Accounts Payable CR
    if (code === '2010') {
      return [
        { label: `PO ${purchase.po_number}`, sublabel: purchase.supplier?.name, amount: purchase.total_amount },
      ];
    }

    // 1400 / 1310 Input VAT
    if (code === '1400' || code === '1310') {
      return [
        { label: 'Input VAT on purchase (12%)', sublabel: `Supplier: ${purchase.supplier?.name ?? '—'}`, amount },
      ];
    }
  }

  return null; // no breakdown available for this account/type combo
}

// ── Line breakdown modal ─────────────────────────────────────────────────────

function LineBreakdownModal({
  entry,
  line,
  onClose,
}: {
  entry: JournalEntry;
  line: JournalLine;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [sale, setSale]       = useState<SaleSource | null>(null);
  const [purchase, setPurchase] = useState<PurchaseSource | null>(null);

  useEffect(() => {
    if (!entry.reference_type || !entry.reference_id) return;
    setLoading(true);

    const type = entry.reference_type;
    const id   = entry.reference_id;

    if (type === 'sale' || type === 'sale_reversal') {
      api.get(`/pos/sales/${id}`)
        .then(r => setSale(r.data.data))
        .finally(() => setLoading(false));
    } else if (type === 'purchase' || type === 'purchase_partial') {
      api.get(`/purchase-orders/${id}`)
        .then(r => setPurchase(r.data.data))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [entry.reference_type, entry.reference_id]);

  const direction = line.debit > 0 ? 'DR' : 'CR';
  const amount    = line.debit > 0 ? line.debit : line.credit;
  const rows      = deriveBreakdown(line, entry.reference_type, sale, purchase);

  const rowTotal = rows?.filter(r => r.amount !== 0).reduce((s, r) => s + r.amount, 0) ?? 0;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Account Line Breakdown"
      width="lg"
    >
      {/* Line identity */}
      <div className="flex items-start gap-3 mb-4 p-3 rounded-lg" style={{ background: 'var(--n-bg-subtle, rgba(0,0,0,0.04))' }}>
        <div
          className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold"
          style={{ background: direction === 'DR' ? '#dbeafe' : '#dcfce7', color: direction === 'DR' ? '#1d4ed8' : '#15803d' }}
        >
          {direction}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-[var(--n-text)]">
            {line.account?.code} — {line.account?.name}
          </p>
          <p className="text-sm text-[var(--n-text-secondary)]">
            {referenceLabel(entry.reference_type, entry.reference_id)} · {dayjs(entry.date).format('MMM D, YYYY')}
          </p>
          <p className="text-lg font-mono font-bold mt-1" style={{ color: direction === 'DR' ? '#1d4ed8' : '#15803d' }}>
            ₱{fmtCurrency(amount)}
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-8"><Spinner size="md" /></div>
      )}

      {!loading && rows && rows.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--n-text-secondary)] mb-2">
            Where this amount comes from
          </p>
          <div className="space-y-1">
            {rows.map((row, i) => (
              row.amount === 0 ? (
                // Zero-amount rows are informational only (e.g. inventory items list)
                <div key={i} className="flex items-center gap-2 px-2 py-1">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--n-text-secondary)' }} />
                  <div className="min-w-0">
                    <span className="text-sm text-[var(--n-text)]">{row.label}</span>
                    {row.sublabel && <span className="text-xs text-[var(--n-text-secondary)] ml-2">{row.sublabel}</span>}
                  </div>
                </div>
              ) : (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ background: 'var(--n-bg-subtle, rgba(0,0,0,0.03))', border: '1px solid var(--n-divider)' }}
                >
                  <div className="min-w-0 mr-4">
                    <p className="text-sm font-medium text-[var(--n-text)]">{row.label}</p>
                    {row.sublabel && <p className="text-xs text-[var(--n-text-secondary)]">{row.sublabel}</p>}
                  </div>
                  <span
                    className="font-mono text-sm font-semibold shrink-0"
                    style={{ color: row.amount < 0 ? '#dc2626' : 'var(--n-text)' }}
                  >
                    {row.amount < 0 ? '−' : ''}₱{fmtCurrency(Math.abs(row.amount))}
                  </span>
                </div>
              )
            ))}
          </div>

          {/* Running total — show only when rows have multiple amounts */}
          {rows.filter(r => r.amount !== 0).length > 1 && (
            <div
              className="flex items-center justify-between px-3 py-2 mt-2 rounded-lg font-bold"
              style={{ background: 'var(--n-card-bg)', border: '1.5px solid var(--n-divider)' }}
            >
              <span className="text-sm text-[var(--n-text-secondary)]">Computed total</span>
              <span className="font-mono text-sm">₱{fmtCurrency(Math.abs(rowTotal))}</span>
            </div>
          )}
        </>
      )}

      {!loading && !rows && (
        <div className="py-6 text-center text-sm text-[var(--n-text-secondary)]">
          No detailed breakdown available for this account line.
        </div>
      )}
    </Modal>
  );
}

// ── Entry detail modal (click entry → see all lines, click a line → breakdown) ─

function JournalDetailModal({
  entry,
  onClose,
}: {
  entry: JournalEntry;
  onClose: () => void;
}) {
  const [selectedLine, setSelectedLine] = useState<JournalLine | null>(null);

  const totalDebit  = entry.lines?.reduce((s, l) => s + l.debit,  0) ?? 0;
  const totalCredit = entry.lines?.reduce((s, l) => s + l.credit, 0) ?? 0;
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <>
      <Modal isOpen onClose={onClose} title="Journal Entry" width="lg">
        {/* Header */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-4 text-sm">
          <div>
            <span className="text-[var(--n-text-secondary)]">Date</span>
            <p className="font-semibold text-[var(--n-text)]">{dayjs(entry.date).format('MMMM D, YYYY')}</p>
          </div>
          <div>
            <span className="text-[var(--n-text-secondary)]">Source</span>
            <p className="font-semibold text-[var(--n-text)]">{referenceLabel(entry.reference_type, entry.reference_id)}</p>
          </div>
          <div className="col-span-2">
            <span className="text-[var(--n-text-secondary)]">Description</span>
            <p className="font-semibold text-[var(--n-text)]">{entry.description}</p>
          </div>
          {entry.user && (
            <div>
              <span className="text-[var(--n-text-secondary)]">Recorded by</span>
              <p className="font-semibold text-[var(--n-text)]">{entry.user.name}</p>
            </div>
          )}
        </div>

        <hr style={{ borderColor: 'var(--n-divider)', marginBottom: '0.75rem' }} />

        <p className="text-xs text-[var(--n-text-secondary)] mb-2">
          Click any line to see where the amount comes from.
        </p>

        {/* Lines table */}
        <div className="space-y-1">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--n-text-secondary)]">
            <span>Account</span>
            <span className="w-24 text-right">Debit</span>
            <span className="w-24 text-right">Credit</span>
          </div>

          {entry.lines?.map((line) => (
            <button
              key={line.id}
              onClick={() => setSelectedLine(line)}
              className="w-full text-left grid grid-cols-[1fr_auto_auto] gap-x-6 items-center px-3 py-2.5 rounded-lg transition-colors hover:bg-[var(--n-hover,rgba(0,0,0,0.06))] group"
              style={{ border: '1px solid var(--n-divider)' }}
            >
              <span className="text-sm text-[var(--n-text)]">
                <span className="font-mono text-xs font-bold mr-2 text-[var(--n-text-secondary)]">{line.account?.code}</span>
                {line.account?.name}
              </span>
              <span className="w-24 text-right font-mono text-sm text-blue-600">
                {line.debit  > 0 ? fmtCurrency(line.debit)  : ''}
              </span>
              <span className="w-24 text-right font-mono text-sm text-green-600">
                {line.credit > 0 ? fmtCurrency(line.credit) : ''}
              </span>
            </button>
          ))}

          {/* Totals */}
          <div
            className="grid grid-cols-[1fr_auto_auto] gap-x-6 items-center px-3 py-2 rounded-lg font-bold text-sm mt-1"
            style={{ background: 'var(--n-card-bg)', border: '1.5px solid var(--n-divider)' }}
          >
            <span className="flex items-center gap-2 text-[var(--n-text-secondary)]">
              Totals
              {balanced
                ? <span className="text-xs text-green-600 font-bold">✓ Balanced</span>
                : <span className="text-xs text-red-600 font-bold">⚠ Unbalanced</span>}
            </span>
            <span className="w-24 text-right font-mono text-blue-600">{fmtCurrency(totalDebit)}</span>
            <span className="w-24 text-right font-mono text-green-600">{fmtCurrency(totalCredit)}</span>
          </div>
        </div>
      </Modal>

      {selectedLine && (
        <LineBreakdownModal
          entry={entry}
          line={selectedLine}
          onClose={() => setSelectedLine(null)}
        />
      )}
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export function JournalEntriesPage() {
  const [entries, setEntries]   = useState<JournalEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<JournalEntry | null>(null);

  useEffect(() => {
    api.get('/accounting/journal-entries', { params: { per_page: 50 } })
      .then((res) => setEntries(res.data.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner size="lg" />;

  return (
    <div>
      <h1 className="neu-page-title" style={{ marginBottom: '1.5rem' }}>Journal Entries</h1>
      <div className="space-y-4">
        {entries.map((entry) => (
          <Card
            key={entry.id}
            className="p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelected(entry)}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-[var(--n-text)]">{entry.description}</p>
                <p className="text-xs" style={{ color: 'var(--n-text-secondary)' }}>
                  {dayjs(entry.date).format('MMM D, YYYY')}
                  {entry.reference_type && <> | {referenceLabel(entry.reference_type, entry.reference_id)}</>}
                </p>
              </div>
              <span className="text-xs text-[var(--n-text-secondary)] mt-0.5">Click to expand</span>
            </div>
            <table className="neu-table">
              <thead>
                <tr className="text-[var(--n-text-secondary)] text-xs">
                  <th className="text-left py-1">Account</th>
                  <th className="text-right py-1">Debit</th>
                  <th className="text-right py-1">Credit</th>
                </tr>
              </thead>
              <tbody>
                {entry.lines?.map((line) => (
                  <tr key={line.id} className="border-t" style={{ borderColor: 'var(--n-divider)' }}>
                    <td className="py-1.5">{line.account?.code} - {line.account?.name}</td>
                    <td className="py-1.5 text-right font-mono">{line.debit  > 0 ? fmtCurrency(line.debit)  : ''}</td>
                    <td className="py-1.5 text-right font-mono">{line.credit > 0 ? fmtCurrency(line.credit) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
        {entries.length === 0 && (
          <p className="text-center text-[var(--n-text-dim)] py-8">No journal entries yet</p>
        )}
      </div>

      {selected && (
        <JournalDetailModal entry={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
