import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { HiBan, HiExclamation } from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { Supplier } from '../../../types';
import dayjs from 'dayjs';

/* ─── shared types (exported so ExpensesPage can import them) ───────────── */

export interface ExpenseCategory {
  id: number;
  name: string;
  account_code: string;
  description: string | null;
}

export interface Expense {
  id: number;
  expense_number: string;
  date: string;
  reference_number: string | null;
  payee: string;
  supplier_id: number | null;
  supplier?: Supplier;
  expense_category_id: number;
  category?: { id: number; name: string; account_code: string };
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  payment_method: string;
  status: 'draft' | 'recorded' | 'voided';
  source: 'manual' | 'purchase_order';
  purchase_order_id: number | null;
  purchase_order?: { id: number; po_number: string; status: string } | null;
  user?: { id: number; name: string };
  created_at: string;
}

/* ─── helpers ──────────────────────────────────────────────────────────── */

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = {
  draft: 'warning',
  recorded: 'success',
  voided: 'danger',
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Expense Form Modal (Create / Edit Draft / Edit Recorded PO-source)       */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function ExpenseFormModal({
  expense, categories, suppliers, systemTaxRate, onClose, onSaved,
}: {
  expense?: Expense | null;
  categories: ExpenseCategory[];
  suppliers: Supplier[];
  systemTaxRate: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!expense;
  const isDraft = expense?.status === 'draft';
  const isRecordedPO = expense?.source === 'purchase_order' && expense?.status === 'recorded';

  // Derive initial VAT checkbox state: if existing tax_amount > 0, it's VATable
  const initialIsVatable = expense ? (expense.tax_amount ?? 0) > 0 : false;

  const [form, setForm] = useState({
    date: expense?.date ?? dayjs().format('YYYY-MM-DD'),
    reference_number: expense?.reference_number ?? '',
    payee: expense?.payee ?? '',
    supplier_id: (expense?.supplier_id ?? '') as number | '',
    expense_category_id: (expense?.expense_category_id ?? '') as number | '',
    subtotal: expense?.total_amount?.toString() ?? '',
    notes: expense?.notes ?? '',
    payment_method: expense?.payment_method ?? 'cash',
    is_vatable: initialIsVatable,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const computedTotal = parseFloat(form.subtotal) || 0;
  const taxAmount = form.is_vatable
    ? parseFloat((computedTotal - computedTotal / (1 + systemTaxRate / 100)).toFixed(2))
    : 0;
  const subtotalNum = parseFloat((computedTotal - taxAmount).toFixed(2));

  const handleSupplierChange = (supplierId: number | '') => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    setForm((f) => ({
      ...f,
      supplier_id: supplierId,
      payee: supplier ? supplier.name : f.payee,
    }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.date) errs.date = 'Date is required';
    if (!form.payee.trim()) errs.payee = 'Payee is required';
    if (!form.expense_category_id) errs.expense_category_id = 'Category is required';
    if (!form.subtotal || parseFloat(form.subtotal) <= 0) errs.subtotal = 'Amount must be greater than 0';
    return errs;
  };

  const buildPayload = () => ({
    date: form.date,
    reference_number: form.reference_number || null,
    payee: form.payee.trim(),
    supplier_id: form.supplier_id || null,
    expense_category_id: form.expense_category_id,
    subtotal: subtotalNum,
    tax_amount: taxAmount,
    total_amount: computedTotal,
    notes: form.notes || null,
    payment_method: form.payment_method,
  });

  const handleSaveDraft = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      await api.put(`/expenses/${expense!.id}`, buildPayload());
      toast.success('Draft saved');
      onSaved();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? 'Failed to save draft');
    } finally { setSubmitting(false); }
  };

  const handleConfirm = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      await api.post(`/expenses/${expense!.id}/confirm`, buildPayload());
      toast.success('Expense confirmed and recorded');
      onSaved();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? 'Failed to confirm expense');
    } finally { setSubmitting(false); }
  };

  const handleCreate = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      await api.post('/expenses', buildPayload());
      toast.success('Expense recorded');
      onSaved();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? 'Failed to record expense');
    } finally { setSubmitting(false); }
  };

  const handleSaveRecordedPO = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      await api.put(`/expenses/${expense!.id}`, buildPayload());
      toast.success('Expense updated');
      onSaved();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? 'Failed to update expense');
    } finally { setSubmitting(false); }
  };

  const title = isDraft
    ? `Review & Confirm — ${expense!.expense_number}`
    : isRecordedPO
    ? `Edit Expense — ${expense!.expense_number}`
    : isEdit
    ? `Edit Expense — ${expense!.expense_number}`
    : 'Record New Expense';

  return (
    <Modal title={title} isOpen onClose={onClose} width="lg">
      <div className="space-y-4">
        {/* PO context banner for draft PO-sourced expenses */}
        {isDraft && expense?.source === 'purchase_order' && (() => {
          const poStatus = expense.purchase_order?.status;
          const isPartialCancel = poStatus === 'cancelled';
          return (
            <div className={`flex items-start gap-3 p-3 rounded-xl border ${
              isPartialCancel
                ? 'bg-red-50 border-red-200'
                : 'bg-amber-50 border-amber-200'
            }`}>
              <HiExclamation className={`w-5 h-5 mt-0.5 shrink-0 ${
                isPartialCancel ? 'text-red-500' : 'text-amber-600'
              }`} />
              <div>
                <p className={`text-sm font-semibold ${
                  isPartialCancel ? 'text-red-800' : 'text-amber-800'
                }`}>Auto-imported from Purchase Order</p>
                <p className={`text-xs mt-0.5 ${
                  isPartialCancel ? 'text-red-700' : 'text-amber-700'
                }`}>
                  {isPartialCancel ? (
                    <>PO {expense.purchase_order?.po_number ?? expense.reference_number} was <strong>cancelled after partial receipt</strong>.
                    {' '}This expense reflects only the received portion. Review and confirm before recording.</>
                  ) : (
                    <>PO {expense.purchase_order?.po_number ?? expense.reference_number} was fully received.
                    {' '}Please review the VAT amount and category before confirming.</>
                  )}
                </p>
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Date *</label>
            <DatePicker
              inline
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              placeholder="Select date"
            />
            {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
          </div>

          {/* Reference Number */}
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Reference / Invoice No.</label>
            <Input
              value={form.reference_number}
              onChange={(e) => setForm((f) => ({ ...f, reference_number: e.target.value }))}
              placeholder="e.g. BI00140317"
            />
          </div>

          {/* Supplier (optional link) */}
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Supplier (optional)</label>
            <Select
              value={form.supplier_id}
              onChange={(e) => handleSupplierChange(e.target.value ? Number(e.target.value) : '')}
              options={[{ value: '', label: '— None —' }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </div>

          {/* Payee (free text) */}
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Payee *</label>
            <Input
              value={form.payee}
              onChange={(e) => setForm((f) => ({ ...f, payee: e.target.value }))}
              placeholder="Vendor / Supplier name"
            />
            {errors.payee && <p className="text-xs text-red-500 mt-1">{errors.payee}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Category *</label>
            <Select
              value={form.expense_category_id}
              onChange={(e) => setForm((f) => ({ ...f, expense_category_id: e.target.value ? Number(e.target.value) : '' }))}
              options={[{ value: '', label: 'Select category...' }, ...categories.map((c) => ({ value: c.id, label: `${c.name} (${c.account_code})` }))]}
            />
            {errors.expense_category_id && <p className="text-xs text-red-500 mt-1">{errors.expense_category_id}</p>}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Payment Method</label>
            <Select
              value={form.payment_method}
              onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'card', label: 'Card' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'check', label: 'Check' },
                { value: 'business_bank', label: 'Business Bank' },
              ]}
            />
          </div>

          {/* Total Amount */}
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Total Amount *</label>
            <Input
              type="number" step="0.01" min="0"
              value={form.subtotal}
              onChange={(e) => setForm((f) => ({ ...f, subtotal: e.target.value }))}
              placeholder="0.00"
            />
            {errors.subtotal && <p className="text-xs text-red-500 mt-1">{errors.subtotal}</p>}
          </div>

          {/* VAT checkbox */}
          <div className="flex flex-col justify-center">
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-2">
              Sales Tax / VAT
            </label>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.is_vatable}
                onChange={(e) => setForm((f) => ({ ...f, is_vatable: e.target.checked }))}
                className="w-5 h-5 rounded accent-amber-500 cursor-pointer"
              />
              <span className="text-sm font-medium text-[var(--n-text)]">
                {form.is_vatable
                  ? <span className="text-amber-600">VAT-inclusive — {systemTaxRate}% = ₱{fmt(taxAmount)} (base ₱{fmt(subtotalNum)})</span>
                  : <span className="text-[var(--n-text-secondary)]">Non-VAT expense</span>}
              </span>
            </label>
          </div>

          {/* Breakdown (read-only) */}
          {form.is_vatable && (
            <div className="col-span-full grid grid-cols-3 gap-2 text-center">
              <div className="px-3 py-2 rounded-lg bg-[var(--n-input-bg)] border border-[var(--n-divider)]">
                <p className="text-xs text-[var(--n-text-secondary)] mb-0.5">Base (excl. VAT)</p>
                <p className="font-semibold text-[var(--n-text)]">₱{fmt(subtotalNum)}</p>
              </div>
              <div className="px-3 py-2 rounded-lg bg-[var(--n-input-bg)] border border-[var(--n-divider)]">
                <p className="text-xs text-[var(--n-text-secondary)] mb-0.5">VAT ({systemTaxRate}%)</p>
                <p className="font-semibold text-amber-600">₱{fmt(taxAmount)}</p>
              </div>
              <div className="px-3 py-2 rounded-lg bg-[var(--n-input-bg)] border border-[var(--n-divider)] border-navy/20">
                <p className="text-xs text-navy mb-0.5">Total</p>
                <p className="font-bold text-navy">₱{fmt(computedTotal)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Notes</label>
          <textarea
            className="neu-inline-input w-full" rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional notes..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {isDraft && (
            <>
              <Button variant="secondary" onClick={handleSaveDraft} disabled={submitting}>
                {submitting ? <Spinner size="sm" /> : 'Save Draft'}
              </Button>
              <Button variant="amber" onClick={handleConfirm} disabled={submitting}>
                {submitting ? <Spinner size="sm" /> : 'Confirm Expense'}
              </Button>
            </>
          )}
          {isRecordedPO && (
            <Button variant="amber" onClick={handleSaveRecordedPO} disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Save Changes'}
            </Button>
          )}
          {!isEdit && (
            <Button variant="amber" onClick={handleCreate} disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Record Expense'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Expense Detail Modal                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function ExpenseDetailModal({
  expense, onClose, onVoid,
}: {
  expense: Expense;
  onClose: () => void;
  onVoid: () => void;
}) {
  return (
    <Modal title={`Expense — ${expense.expense_number}`} isOpen onClose={onClose} width="lg">
      <div className="space-y-5">
        {/* Status badge */}
        <div className="flex items-center gap-3">
          <Badge variant={STATUS_VARIANT[expense.status] ?? 'neutral'}>
            {expense.status.toUpperCase()}
          </Badge>
          <span className="text-sm text-[var(--n-text-secondary)]">
            Recorded by {expense.user?.name ?? '—'} on {dayjs(expense.created_at).format('MMM D, YYYY h:mm A')}
          </span>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Date', value: dayjs(expense.date).format('MMM D, YYYY') },
            { label: 'Payee', value: expense.payee },
            { label: 'Category', value: expense.category?.name ?? '—' },
            { label: 'Reference No.', value: expense.reference_number || '—' },
            { label: 'Account Code', value: expense.category?.account_code ?? '—' },
            { label: 'Supplier', value: expense.supplier?.name ?? '(Manual entry)' },
          ].map((item) => (
            <div key={item.label} className="p-3 rounded-xl bg-[var(--n-input-bg)]">
              <p className="text-xs font-semibold text-[var(--n-text-secondary)] uppercase tracking-wide">{item.label}</p>
              <p className="text-sm font-medium text-[var(--n-text)] mt-1">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-[var(--n-input-bg)] text-center">
            <p className="text-xs font-semibold text-[var(--n-text-secondary)] uppercase">Subtotal</p>
            <p className="text-lg font-bold text-[var(--n-text)] mt-1">₱{fmt(expense.subtotal)}</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--n-input-bg)] text-center">
            <p className="text-xs font-semibold text-[var(--n-text-secondary)] uppercase">Tax</p>
            <p className="text-lg font-bold text-[var(--n-text)] mt-1">
              {expense.tax_amount > 0 ? `₱${fmt(expense.tax_amount)}` : '—'}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-navy/5 text-center border border-navy/10">
            <p className="text-xs font-semibold text-navy uppercase">Total</p>
            <p className="text-xl font-bold text-navy mt-1">₱{fmt(expense.total_amount)}</p>
          </div>
        </div>

        {/* Notes */}
        {expense.notes && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-xs font-semibold text-amber-800 uppercase mb-1">Notes</p>
            <p className="text-sm text-amber-900">{expense.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {expense.status === 'recorded' && (
            <Button variant="danger" onClick={onVoid}>
              <HiBan className="w-4 h-4 mr-2" /> Void Expense
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
