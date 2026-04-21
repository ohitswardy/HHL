import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { HiPrinter, HiCash, HiCalendar, HiPencilAlt, HiExclamation } from 'react-icons/hi';
import dayjs from 'dayjs';
import type { SalesTransaction } from '../../../types';

/* ── shared type ────────────────────────────────────────────────────────── */

export type ConfirmAction = { type: 'complete' | 'void'; transaction: SalesTransaction } | null;

/** Returns today's date as YYYY-MM-DD using the browser's local timezone. */
function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hasPendingCredit(tx: SalesTransaction): boolean {
  return (tx.payments ?? []).some(
    (p) => p.payment_method === 'credit' && p.status === 'pending',
  );
}

/* ── TxInfoCard (also used in ViewTransactionModal) ─────────────────────── */

function TxInfoCard({
  label, value, bold, children,
}: {
  label: string; value?: string; bold?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--n-input-bg)' }}>
      <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--n-text-secondary)' }}>{label}</p>
      {children ?? (
        <p className={`text-sm ${bold ? 'font-bold' : ''}`} style={{ color: 'var(--n-text)' }}>{value}</p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  View Transaction Detail Modal                                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function ViewTransactionModal({
  tx, onClose, onPrintReceipt, onOpenEdit, onOpenRecordPayment, onOpenUpdateDueDate,
}: {
  tx: SalesTransaction | null;
  onClose: () => void;
  onPrintReceipt: (id: number) => void;
  onOpenEdit: (tx: SalesTransaction) => void;
  onOpenRecordPayment: (tx: SalesTransaction) => void;
  onOpenUpdateDueDate: (tx: SalesTransaction) => void;
}) {
  if (!tx) return null;
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Transaction — ${tx.transaction_number}`}
      width="xl"
    >
      {/* Info grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <TxInfoCard label="Client" value={tx.client?.business_name || 'Walk-in'} />
        <TxInfoCard label="Status">
          <Badge variant={tx.status === 'completed' ? 'success' : tx.status === 'pending' ? 'warning' : tx.status === 'voided' ? 'danger' : 'neutral'}>
            {tx.status}
          </Badge>
        </TxInfoCard>
        <TxInfoCard label="Total Amount" value={`₱${tx.total_amount.toFixed(2)}`} bold />
        <TxInfoCard label="Cashier" value={tx.user?.name ?? '—'} />
        <TxInfoCard label="Type">
          <Badge variant={tx.fulfillment_type === 'delivery' ? 'info' : 'success'}>
            {tx.fulfillment_type}
          </Badge>
        </TxInfoCard>
        <TxInfoCard label="Date & Time" value={dayjs(tx.created_at).format('MMM D, YYYY h:mm A')} />
      </div>

      {/* Payment rows */}
      {(tx.payments ?? []).length > 0 && (() => {
        const allPayments = tx.payments ?? [];
        const creditPayments = allPayments
          .filter(p => p.payment_method === 'credit')
          .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
        const isInstallmentSale = creditPayments.length > 1;

        const getCreditLabel = (p: typeof allPayments[0]) => {
          const idx = creditPayments.findIndex(c => c.id === p.id);
          if (isInstallmentSale) return `Installment ${idx + 1}`;
          return 'Credit (full)';
        };

        const unlinkedCollected = allPayments.filter(
          p => p.payment_method !== 'credit' && p.settles_payment_id == null
        );
        const confirmedInstallments = creditPayments.filter(c => c.status === 'confirmed');
        const positionalMap = new Map<number, typeof allPayments[0]>();
        if (unlinkedCollected.length > 0 && confirmedInstallments.length > 0) {
          const amountsSorted = [...unlinkedCollected].map(p => p.amount).sort((a, b) => a - b);
          const installAmountsSorted = [...confirmedInstallments].map(c => c.amount).sort((a, b) => a - b);
          const allMatch = amountsSorted.length === installAmountsSorted.length &&
            amountsSorted.every((a, i) => Math.abs(a - installAmountsSorted[i]) < 0.01);
          if (allMatch) {
            const sortedCollected = [...unlinkedCollected].sort((a, b) => a.amount - b.amount || a.id - b.id);
            const sortedInstallments = [...confirmedInstallments].sort((a, b) => a.amount - b.amount || (a.due_date ?? '').localeCompare(b.due_date ?? ''));
            sortedCollected.forEach((cp, i) => positionalMap.set(cp.id, sortedInstallments[i]));
          }
        }

        const getPaymentLabel = (p: typeof allPayments[0]) => {
          if (p.payment_method === 'credit') return getCreditLabel(p);
          if (p.settles_payment_id != null) {
            const settled = creditPayments.find(c => c.id === p.settles_payment_id);
            if (settled) {
              const idx = creditPayments.indexOf(settled);
              return isInstallmentSale ? `Installment ${idx + 1}` : 'Credit (full)';
            }
          }
          if (positionalMap.has(p.id)) {
            const matched = positionalMap.get(p.id)!;
            const idx = creditPayments.indexOf(matched);
            return isInstallmentSale ? `Installment ${idx + 1}` : 'Credit (full)';
          }
          const saleDate = tx.created_at?.slice(0, 10);
          const isOriginalPayment = p.paid_at?.slice(0, 10) === saleDate || p.paid_at === null;
          if (isOriginalPayment && creditPayments.length === 0) return 'Down Payment';
          return creditPayments.length > 0 ? 'Full Settlement' : 'Payment Collected';
        };

        return (
          <div className="mb-5 rounded-lg overflow-hidden border border-[var(--n-divider)]">
            <table className="neu-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>For</th>
                  <th className="text-right">Amount</th>
                  <th>Reference #</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {allPayments.map((p) => (
                  <>
                    <tr key={p.id}>
                      <td style={{ textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                        {p.payment_method.replace(/_/g, ' ')}
                      </td>
                      <td style={{ color: 'var(--n-text-secondary)', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                        {getPaymentLabel(p)}
                      </td>
                      <td className="text-right font-semibold">₱{p.amount.toFixed(2)}</td>
                      <td style={{ color: 'var(--n-text-secondary)' }}>{p.reference_number || '—'}</td>
                      <td style={{
                        color: p.due_date && p.due_date < localDateStr() && p.status === 'pending'
                          ? 'var(--n-danger)'
                          : p.due_date ? 'var(--n-accent)' : 'var(--n-text-dim)',
                        fontWeight: p.due_date ? 600 : 400,
                        whiteSpace: 'nowrap',
                      }}>
                        {p.due_date ?? '—'}
                        {p.due_date && p.due_date < localDateStr() && p.status === 'pending' && ' ⚠'}
                      </td>
                      <td>
                        <Badge variant={p.status === 'confirmed' ? 'success' : p.status === 'pending' ? 'warning' : 'danger'}>
                          {p.status}
                        </Badge>
                      </td>
                    </tr>
                    {p.notes && (
                      <tr key={`${p.id}-notes`} style={{ background: 'var(--n-input-bg)' }}>
                        <td colSpan={6} style={{ padding: '4px 12px 6px', fontSize: '0.78rem', color: 'var(--n-text-secondary)', borderTop: 'none' }}>
                          <span style={{ color: 'var(--n-text-dim)', marginRight: 6, fontStyle: 'italic' }}>Note:</span>
                          {p.notes}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Notes */}
      {tx.notes && (
        <div
          className="mb-5 px-3 py-2.5 rounded-lg text-sm"
          style={{ background: 'var(--n-input-bg)', color: 'var(--n-text-secondary)' }}
        >
          <span className="font-semibold" style={{ color: 'var(--n-text)' }}>Notes: </span>
          {tx.notes}
        </div>
      )}

      {/* Line items table */}
      <div className="border border-[var(--n-divider)] rounded-lg overflow-hidden mb-5">
        <table className="neu-table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="text-center">Qty</th>
              <th className="text-right">Unit Price</th>
              <th className="text-right">Discount</th>
              <th className="text-right">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {(tx.items ?? []).map((item) => (
              <tr key={item.id}>
                <td>
                  <span className="font-medium">{item.product?.name ?? `Product #${item.product_id}`}</span>
                  <span className="block text-xs font-mono" style={{ color: 'var(--n-text-dim)' }}>{item.product?.sku ?? ''}</span>
                </td>
                <td className="text-center" style={{ color: 'var(--n-text-secondary)' }}>{item.quantity}</td>
                <td className="text-right">₱{item.unit_price.toFixed(2)}</td>
                <td className="text-right" style={{ color: 'var(--n-danger)' }}>
                  {item.discount > 0 ? `-₱${item.discount.toFixed(2)}` : '—'}
                </td>
                <td className="text-right font-semibold">₱{item.line_total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Financial summary */}
      <div
        className="rounded-lg p-3 space-y-1.5 text-sm mb-5"
        style={{ background: 'var(--n-surface-raised, var(--n-input-bg))' }}
      >
        <div className="flex justify-between">
          <span style={{ color: 'var(--n-text-secondary)' }}>Subtotal</span>
          <span>₱{tx.subtotal.toFixed(2)}</span>
        </div>
        {tx.discount_amount > 0 && (
          <div className="flex justify-between" style={{ color: 'var(--n-danger)' }}>
            <span>Discount</span>
            <span>-₱{tx.discount_amount.toFixed(2)}</span>
          </div>
        )}
        {tx.delivery_fee > 0 && (
          <div className="flex justify-between" style={{ color: 'var(--n-text-secondary)' }}>
            <span>Delivery Fee</span>
            <span>₱{tx.delivery_fee.toFixed(2)}</span>
          </div>
        )}
        {tx.tax_amount > 0 && (
          <div className="flex justify-between" style={{ color: 'var(--n-info)' }}>
            <span>VAT / Sales Tax</span>
            <span>+₱{tx.tax_amount.toFixed(2)}</span>
          </div>
        )}
        <div
          className="flex justify-between font-bold text-base pt-1.5"
          style={{ borderTop: '1px solid var(--n-divider)', fontFamily: 'var(--n-font-display)' }}
        >
          <span>TOTAL</span>
          <span style={{ color: 'var(--n-accent)' }}>₱{tx.total_amount.toFixed(2)}</span>
        </div>
        {(tx.total_paid ?? 0) > 0 && (
          <>
            <div className="flex justify-between text-green-700 font-medium">
              <span>Paid</span>
              <span>₱{(tx.total_paid ?? 0).toFixed(2)}</span>
            </div>
            {(tx.balance_due ?? 0) > 0 && (
              <div className="flex justify-between font-semibold" style={{ color: 'var(--n-danger)' }}>
                <span>Balance Due</span>
                <span>₱{(tx.balance_due ?? 0).toFixed(2)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex justify-between items-center pt-2 border-t border-[var(--n-divider)]">
        <Button variant="secondary" onClick={() => onPrintReceipt(tx.id)}>
          <HiPrinter className="w-4 h-4 mr-2" /> Print Receipt
        </Button>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {tx.status === 'pending' && (tx.balance_due ?? 0) > 0 && (
            <>
              {hasPendingCredit(tx) && (
                <Button variant="outline" onClick={() => onOpenUpdateDueDate(tx)}>
                  <HiCalendar className="w-4 h-4 mr-2" /> Update Due Date
                </Button>
              )}
              <Button variant="primary" onClick={() => onOpenRecordPayment(tx)}>
                <HiCash className="w-4 h-4 mr-2" /> Record Payment
              </Button>
            </>
          )}
          {tx.status !== 'voided' && (
            <Button variant="amber" onClick={() => onOpenEdit(tx)}>
              <HiPencilAlt className="w-4 h-4 mr-2" /> Edit
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Edit Transaction Modal                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

type EditItem = {
  id: number; product_name: string; sku: string;
  quantity: number; unit_price: string; discount: string;
};

export function EditTransactionModal({
  tx, editItems, onItemChange, editNotes, onNotesChange, deliveryFee, saving, onClose, onSave,
}: {
  tx: SalesTransaction | null;
  editItems: EditItem[];
  onItemChange: (idx: number, field: 'unit_price' | 'discount', value: string) => void;
  editNotes: string;
  onNotesChange: (v: string) => void;
  deliveryFee: number;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!tx) return null;

  let subtotal = 0, discountTotal = 0;
  editItems.forEach((item) => {
    subtotal += (parseFloat(item.unit_price) || 0) * item.quantity;
    discountTotal += parseFloat(item.discount) || 0;
  });
  const totals = {
    subtotal,
    discountTotal,
    deliveryFee,
    total: Math.max(0, subtotal - discountTotal + deliveryFee),
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Edit Transaction — ${tx.transaction_number}`}
      width="xl"
    >
      <div className="space-y-5">
        {tx.status === 'completed' && (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
            style={{ background: 'var(--n-warning-glow, #fef9c3)', color: '#92400e' }}
          >
            <HiExclamation className="w-4 h-4 shrink-0" />
            Editing a completed transaction will automatically reverse and re-post its journal entries.
          </div>
        )}

        {/* Items table */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--n-text-secondary)' }}>Line Items</p>
          <div className="overflow-x-auto">
            <table className="neu-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-center">Qty</th>
                  <th className="text-right">Unit Price</th>
                  <th className="text-right">Discount</th>
                  <th className="text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {editItems.map((item, idx) => {
                  const up = parseFloat(item.unit_price) || 0;
                  const disc = parseFloat(item.discount) || 0;
                  const lt = Math.max(0, up * item.quantity - disc);
                  return (
                    <tr key={item.id}>
                      <td>
                        <span className="font-medium">{item.product_name}</span>
                        <span className="block text-xs font-mono" style={{ color: 'var(--n-text-dim)' }}>{item.sku}</span>
                      </td>
                      <td className="text-center" style={{ color: 'var(--n-text-secondary)' }}>{item.quantity}</td>
                      <td className="text-right">
                        <input
                          type="number" min="0" step="0.01"
                          className="neu-inline-input text-right"
                          style={{ width: '7rem' }}
                          value={item.unit_price}
                          onChange={(e) => onItemChange(idx, 'unit_price', e.target.value)}
                        />
                      </td>
                      <td className="text-right">
                        <input
                          type="number" min="0" step="0.01"
                          className="neu-inline-input text-right"
                          style={{ width: '6rem' }}
                          value={item.discount}
                          onChange={(e) => onItemChange(idx, 'discount', e.target.value)}
                        />
                      </td>
                      <td className="text-right font-semibold">{lt.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--n-text-secondary)' }}>
            Notes <span style={{ fontWeight: 400, textTransform: 'none' }}>(e.g. bank name, reference #)</span>
          </label>
          <textarea
            className="neu-inline-input w-full"
            style={{ minHeight: '3.5rem', resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="e.g. BDO Transfer — Ref# 20260407-1234"
            value={editNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            maxLength={1000}
          />
        </div>

        {/* Totals summary */}
        <div
          className="rounded-lg p-3 space-y-1 text-sm"
          style={{ background: 'var(--n-surface-raised, var(--n-surface))' }}
        >
          <div className="flex justify-between">
            <span style={{ color: 'var(--n-text-secondary)' }}>Subtotal</span>
            <span>{totals.subtotal.toFixed(2)}</span>
          </div>
          {totals.discountTotal > 0 && (
            <div className="flex justify-between" style={{ color: 'var(--n-danger)' }}>
              <span>Total Discount</span>
              <span>-{totals.discountTotal.toFixed(2)}</span>
            </div>
          )}
          {totals.deliveryFee > 0 && (
            <div className="flex justify-between" style={{ color: 'var(--n-text-secondary)' }}>
              <span>Delivery Fee</span>
              <span>{totals.deliveryFee.toFixed(2)}</span>
            </div>
          )}
          <div
            className="flex justify-between font-bold text-base pt-1"
            style={{ borderTop: '1px solid var(--n-divider)', fontFamily: 'var(--n-font-display)' }}
          >
            <span>TOTAL</span>
            <span className="text-amber-dark">{totals.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="amber" className="flex-1" onClick={onSave} loading={saving}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Confirm Action Modal (void / mark completed)                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function ConfirmActionModal({
  action, onClose, updatingId, onVoid, onMarkCompleted,
}: {
  action: ConfirmAction;
  onClose: () => void;
  updatingId: number | null;
  onVoid: (id: number) => void;
  onMarkCompleted: (id: number) => void;
}) {
  return (
    <Modal
      isOpen={action !== null}
      onClose={onClose}
      title={action?.type === 'void' ? 'Void Transaction' : 'Mark as Completed'}
      width="sm"
    >
      {action && (
        <div className="text-center space-y-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
            style={{ background: action.type === 'void' ? 'var(--n-danger-glow, #fee2e2)' : 'var(--n-success-glow)' }}
          >
            <HiExclamation className="w-7 h-7" style={{ color: action.type === 'void' ? 'var(--n-danger)' : 'var(--n-success)' }} />
          </div>
          <div>
            <p className="font-semibold text-base">{action.transaction.transaction_number}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--n-text-secondary)' }}>
              {action.type === 'void'
                ? 'This will void the transaction and reverse all inventory and journal entries. This cannot be undone.'
                : 'This will mark the transaction as completed and confirm the pending payment.'}
            </p>
          </div>
          <div className="flex gap-3 justify-center pt-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              variant={action.type === 'void' ? 'danger' : 'amber'}
              onClick={() =>
                action.type === 'void'
                  ? onVoid(action.transaction.id)
                  : onMarkCompleted(action.transaction.id)
              }
              loading={updatingId === action.transaction.id}
            >
              {action.type === 'void' ? 'Yes, Void It' : 'Yes, Mark Completed'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Record Payment Modal                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function RecordPaymentModal({
  tx, method, amount, reference, saving, notes, target,
  onMethodChange, onAmountChange, onReferenceChange, onNotesChange, onTargetChange,
  onClose, onSubmit,
}: {
  tx: SalesTransaction | null;
  method: string;
  amount: string;
  reference: string;
  saving: boolean;
  notes: string;
  target: 'full' | number;
  onMethodChange: (v: string) => void;
  onAmountChange: (v: string) => void;
  onReferenceChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onTargetChange: (target: 'full' | number) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!tx) return null;

  const pendingCredits = (tx.payments ?? [])
    .filter(p => p.payment_method === 'credit' && p.status === 'pending')
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
  const isInstallmentSale = pendingCredits.length > 1;
  const today = localDateStr();

  return (
    <Modal isOpen onClose={onClose} title="Record Payment" width="sm">
      <div className="space-y-4">
        {/* Transaction summary */}
        <div className="rounded-lg p-3 space-y-1 text-sm" style={{ background: 'var(--n-input-bg)' }}>
          <div className="flex justify-between">
            <span style={{ color: 'var(--n-text-secondary)' }}>Transaction</span>
            <span className="font-mono font-semibold">{tx.transaction_number}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--n-text-secondary)' }}>Total Amount</span>
            <span>₱{tx.total_amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--n-text-secondary)' }}>Already Paid</span>
            <span className="text-green-700">₱{(tx.total_paid ?? 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold pt-1" style={{ borderTop: '1px solid var(--n-divider)' }}>
            <span style={{ color: 'var(--n-danger)' }}>Balance Due</span>
            <span style={{ color: 'var(--n-danger)' }}>₱{(tx.balance_due ?? 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Installment / Payment target selector */}
        {isInstallmentSale ? (
          <div>
            <label className="neu-label">What is being paid?</label>
            <div className="space-y-2">
              {pendingCredits.map((p, idx) => {
                const overdue = p.due_date && p.due_date < today;
                const selected = target === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onTargetChange(p.id)}
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-left transition-all"
                    style={{
                      background: selected ? 'var(--n-primary-glow, rgba(27,58,92,0.15))' : 'var(--n-input-bg)',
                      border: selected ? '2px solid var(--n-primary)' : '2px solid var(--n-border)',
                    }}
                  >
                    <span
                      className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                      style={{
                        borderColor: selected ? 'var(--n-primary)' : 'var(--n-border)',
                        background: selected ? 'var(--n-primary)' : 'transparent',
                      }}
                    >
                      {selected && <span className="w-2 h-2 rounded-full bg-white block" />}
                    </span>
                    <span className="flex-1">
                      <span className="font-semibold">Installment {idx + 1}</span>
                      {overdue && (
                        <span className="ml-2 text-xs font-bold" style={{ color: 'var(--n-danger)' }}>⚠ OVERDUE</span>
                      )}
                      <span className="block text-xs mt-0.5" style={{ color: 'var(--n-text-secondary)' }}>
                        Due {p.due_date ?? '—'}
                      </span>
                    </span>
                    <span className="font-bold" style={{ color: overdue ? 'var(--n-danger)' : 'var(--n-accent)' }}>
                      ₱{p.amount.toFixed(2)}
                    </span>
                  </button>
                );
              })}
              {/* Pay in full option */}
              <button
                type="button"
                onClick={() => onTargetChange('full')}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-left transition-all"
                style={{
                  background: target === 'full' ? 'var(--n-primary-glow, rgba(27,58,92,0.15))' : 'var(--n-input-bg)',
                  border: target === 'full' ? '2px solid var(--n-primary)' : '2px solid var(--n-border)',
                }}
              >
                <span
                  className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                  style={{
                    borderColor: target === 'full' ? 'var(--n-primary)' : 'var(--n-border)',
                    background: target === 'full' ? 'var(--n-primary)' : 'transparent',
                  }}
                >
                  {target === 'full' && <span className="w-2 h-2 rounded-full bg-white block" />}
                </span>
                <span className="flex-1">
                  <span className="font-semibold">Pay Full Balance</span>
                  <span className="block text-xs mt-0.5" style={{ color: 'var(--n-text-secondary)' }}>
                    Settles all remaining installments at once
                  </span>
                </span>
                <span className="font-bold" style={{ color: 'var(--n-success)' }}>
                  ₱{(tx.balance_due ?? 0).toFixed(2)}
                </span>
              </button>
            </div>
          </div>
        ) : (
          pendingCredits.length === 1 && (
            <div className="rounded-lg p-3 text-sm"
              style={{ background: 'var(--n-surface-raised, var(--n-surface))', border: '1px solid var(--n-accent)' }}>
              <div className="flex justify-between">
                <span style={{ color: 'var(--n-text-secondary)' }}>Due Date</span>
                <span style={{
                  fontWeight: 600,
                  color: pendingCredits[0].due_date && pendingCredits[0].due_date < today
                    ? 'var(--n-danger)' : 'var(--n-text)',
                }}>
                  {pendingCredits[0].due_date ?? '—'}
                  {pendingCredits[0].due_date && pendingCredits[0].due_date < today ? ' ⚠ OVERDUE' : ''}
                </span>
              </div>
            </div>
          )
        )}

        {/* Payment method */}
        <Select
          label="Payment Method"
          value={method}
          onChange={(e) => onMethodChange(e.target.value)}
          options={[
            { value: 'cash', label: 'Cash' },
            { value: 'card', label: 'Card' },
            { value: 'bank_transfer', label: 'Bank Transfer' },
            { value: 'check', label: 'Check' },
            { value: 'business_bank', label: 'Business Bank' },
          ]}
        />

        {/* Amount */}
        <Input
          label="Amount"
          type="number" min="0.01" step="0.01"
          max={(tx.balance_due ?? 0).toFixed(2)}
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0.00"
        />

        {/* Reference number */}
        {(method === 'bank_transfer' || method === 'check' || method === 'business_bank') && (
          <Input
            label="Reference Number"
            value={reference}
            onChange={(e) => onReferenceChange(e.target.value)}
            placeholder="e.g. BDO Transfer Ref# 12345"
          />
        )}

        {/* Notes */}
        <div>
          <label className="neu-label">
            Notes <span style={{ color: 'var(--n-text-dim)', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            className="neu-inline-input w-full"
            style={{ minHeight: '2.5rem', resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="e.g. Check no. 0012, partial payment per agreement"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            maxLength={500}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            loading={saving}
            disabled={!amount || parseFloat(amount) <= 0}
          >
            <HiCash className="w-4 h-4 mr-2" /> Record Payment
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Update Credit Due Date Modal                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function UpdateDueDateModal({
  tx, dueDates, onDueDateChange, saving, onClose, onSave,
}: {
  tx: SalesTransaction | null;
  dueDates: Record<number, string>;
  onDueDateChange: (id: number, value: string) => void;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!tx) return null;

  const creditPayments = (tx.payments ?? [])
    .filter(p => p.payment_method === 'credit' && p.status === 'pending');

  return (
    <Modal isOpen onClose={onClose} title="Update Payment Due Date" width="sm">
      <div className="space-y-4">
        <div className="rounded-lg p-3 text-sm" style={{ background: 'var(--n-input-bg)' }}>
          <div className="flex justify-between mb-1">
            <span style={{ color: 'var(--n-text-secondary)' }}>Transaction</span>
            <span className="font-mono font-semibold">{tx.transaction_number}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--n-text-secondary)' }}>Outstanding</span>
            <span style={{ color: 'var(--n-danger)', fontWeight: 700 }}>₱{(tx.balance_due ?? 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="space-y-3">
          {creditPayments.map((p, idx) => (
            <div key={p.id}>
              {creditPayments.length > 1 && (
                <p className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--n-text-secondary)' }}>
                  Installment {idx + 1} — ₱{p.amount.toFixed(2)}
                </p>
              )}
              <DatePicker
                label={creditPayments.length === 1
                  ? `New Due Date (current: ${p.due_date ?? 'not set'})`
                  : `Due Date (current: ${p.due_date ?? 'not set'})`
                }
                value={dueDates[p.id] ?? p.due_date ?? ''}
                onChange={(e) => onDueDateChange(p.id, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="amber" onClick={onSave} loading={saving}>
            <HiCalendar className="w-4 h-4 mr-2" /> Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
