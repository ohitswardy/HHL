import { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { DatePicker } from '../../../components/ui/DatePicker';
import { HiCalendar, HiCash, HiDocumentText, HiPlus, HiTrash } from 'react-icons/hi';

export interface PaymentTermsInstallment {
  dueDate: string;
  amount: number;
}

export interface PaymentTermsData {
  termsDays: number;
  dueDate: string;           // ISO date string YYYY-MM-DD
  downPayment: number;       // 0 = full credit
  downPaymentMethod: 'cash' | 'card' | 'bank_transfer' | 'check';
  referenceNumber: string;
  notes: string;
  useInstallments: boolean;
  installments: PaymentTermsInstallment[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: PaymentTermsData) => void;
  totalAmount: number;
  initialData?: Partial<PaymentTermsData> | null;
}

const TERMS_PRESETS = [
  { value: '15',  label: 'Net 15 — due in 15 days' },
  { value: '30',  label: 'Net 30 — due in 30 days' },
  { value: '45',  label: 'Net 45 — due in 45 days' },
  { value: '60',  label: 'Net 60 — due in 60 days' },
  { value: '90',  label: 'Net 90 — due in 90 days' },
  { value: '0',   label: 'Custom — pick a date' },
];

const DOWN_PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'card',          label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'check',         label: 'Check' },
];

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface InstallmentRow {
  key: string;
  amount: string;
  dueDate: string;
}

export function PaymentTermsModal({ isOpen, onClose, onConfirm, totalAmount, initialData }: Props) {
  const [mode, setMode] = useState<'standard' | 'installments'>('standard');

  // Standard mode
  const [termsDays, setTermsDays] = useState<string>('30');
  const [dueDate, setDueDate]     = useState<string>(addDays(30));
  const [customDate, setCustomDate] = useState<boolean>(false);

  // Installment plan mode
  const [installments, setInstallments] = useState<InstallmentRow[]>([
    { key: 'inst-0', amount: '', dueDate: addDays(30) },
  ]);

  // Shared between modes
  const [downPayment, setDownPayment]         = useState<string>('');
  const [downPaymentMethod, setDownPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer' | 'check'>('cash');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes]         = useState<string>('');

  // Seed from initialData when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const data = initialData;
    if (data) {
      const days = String(data.termsDays ?? 30);
      const isPreset = TERMS_PRESETS.some(p => p.value === days && p.value !== '0');
      setTermsDays(isPreset ? days : '0');
      setCustomDate(!isPreset);
      setDueDate(data.dueDate ?? addDays(data.termsDays ?? 30));
      setDownPayment(data.downPayment ? String(data.downPayment) : '');
      setDownPaymentMethod(data.downPaymentMethod ?? 'cash');
      setReferenceNumber(data.referenceNumber ?? '');
      setNotes(data.notes ?? '');
      if (data.useInstallments && data.installments?.length) {
        setMode('installments');
        setInstallments(data.installments.map((inst, i) => ({
          key: `inst-${i}`,
          amount: String(inst.amount),
          dueDate: inst.dueDate,
        })));
      } else {
        setMode('standard');
        setInstallments([{ key: 'inst-0', amount: '', dueDate: addDays(30) }]);
      }
    } else {
      setMode('standard');
      setTermsDays('30');
      setCustomDate(false);
      setDueDate(addDays(30));
      setDownPayment('');
      setDownPaymentMethod('cash');
      setReferenceNumber('');
      setNotes('');
      setInstallments([{ key: 'inst-0', amount: '', dueDate: addDays(30) }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const parsedDown   = parseFloat(downPayment) || 0;
  const creditAmount = Math.max(0, totalAmount - parsedDown);
  const hasDown      = parsedDown > 0;
  const downExceedsTotal = parsedDown >= totalAmount;

  // ── Standard mode validations ──
  const dueDateObj  = new Date(dueDate);
  const today       = new Date();
  today.setHours(0, 0, 0, 0);
  const duePast     = dueDateObj < today;
  const canConfirmStandard = dueDate && !duePast && (!hasDown || !downExceedsTotal);

  // ── Installment mode helpers ──
  const installmentTotal   = installments.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const installmentsBalanced = Math.abs(installmentTotal - creditAmount) < 0.01;
  const installmentsValid  = installments.length > 0
    && installments.every(i => (parseFloat(i.amount) || 0) > 0 && !!i.dueDate)
    && installmentsBalanced;
  const canConfirmInstallments = installmentsValid && (!hasDown || !downExceedsTotal);

  const canConfirm = mode === 'standard' ? canConfirmStandard : canConfirmInstallments;

  const addInstallment = () => {
    const lastDate = installments[installments.length - 1]?.dueDate ?? addDays(30);
    const next = new Date(lastDate);
    next.setDate(next.getDate() + 30);
    setInstallments(prev => [...prev, {
      key: `inst-${Date.now()}`,
      amount: '',
      dueDate: next.toISOString().slice(0, 10),
    }]);
  };

  const removeInstallment = (key: string) => {
    setInstallments(prev => prev.filter(i => i.key !== key));
  };

  const updateInstallment = (key: string, field: 'amount' | 'dueDate', value: string) => {
    setInstallments(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));
  };

  const splitEqually = () => {
    if (installments.length === 0 || creditAmount <= 0) return;
    const each = Math.round((creditAmount / installments.length) * 100) / 100;
    setInstallments(prev => prev.map((inst, idx) => ({
      ...inst,
      amount: idx === prev.length - 1
        ? (creditAmount - each * (prev.length - 1)).toFixed(2)
        : each.toFixed(2),
    })));
  };

  const handleTermsChange = (value: string) => {
    setTermsDays(value);
    if (value === '0') {
      setCustomDate(true);
    } else {
      setCustomDate(false);
      setDueDate(addDays(Number(value)));
    }
  };

  const handleConfirm = () => {
    if (!canConfirm) return;

    if (mode === 'installments') {
      const sorted = [...installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      onConfirm({
        termsDays: 0,
        dueDate: sorted[0]?.dueDate ?? addDays(30),
        downPayment: parsedDown,
        downPaymentMethod,
        referenceNumber: referenceNumber.trim(),
        notes: notes.trim(),
        useInstallments: true,
        installments: sorted.map(i => ({ dueDate: i.dueDate, amount: parseFloat(i.amount) || 0 })),
      });
      return;
    }

    const dueDateObj2 = new Date(dueDate);
    const todayForCalc = new Date();
    todayForCalc.setHours(0, 0, 0, 0);
    const days = customDate
      ? Math.round((dueDateObj2.getTime() - todayForCalc.getTime()) / 86_400_000)
      : Number(termsDays);

    onConfirm({
      termsDays:       Math.max(0, days),
      dueDate,
      downPayment:     parsedDown,
      downPaymentMethod,
      referenceNumber: referenceNumber.trim(),
      notes:           notes.trim(),
      useInstallments: false,
      installments:    [],
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Payment Terms" width="sm">
      <div className="space-y-4">

        {/* ── Mode toggle ── */}
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--n-border)', background: 'var(--n-inset)' }}
        >
          <button
            type="button"
            onClick={() => setMode('standard')}
            className="flex-1 py-2 text-sm font-medium transition-all"
            style={{
              background: mode === 'standard' ? 'var(--n-primary)' : 'transparent',
              color: mode === 'standard' ? '#fff' : 'var(--n-text-secondary)',
            }}
          >
            Standard Terms
          </button>
          <button
            type="button"
            onClick={() => setMode('installments')}
            className="flex-1 py-2 text-sm font-medium transition-all"
            style={{
              background: mode === 'installments' ? 'var(--n-primary)' : 'transparent',
              color: mode === 'installments' ? '#fff' : 'var(--n-text-secondary)',
            }}
          >
            Installment Plan
          </button>
        </div>

        {/* ── Standard mode ── */}
        {mode === 'standard' && (
          <>
            {/* Terms preset */}
            <div>
              <label className="neu-label">
                <HiCalendar className="inline w-4 h-4 mr-1.5 -mt-0.5" style={{ color: 'var(--n-accent)' }} />
                Terms
              </label>
              <Select
                value={termsDays}
                onChange={(e) => handleTermsChange(e.target.value)}
                options={TERMS_PRESETS}
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="neu-label">Due Date</label>
              <DatePicker
                value={dueDate}
                min={todayStr()}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setCustomDate(true);
                  setTermsDays('0');
                }}
              />
              {duePast && (
                <p className="text-xs mt-1" style={{ color: 'var(--n-danger)' }}>
                  Due date cannot be in the past.
                </p>
              )}
            </div>

            {/* Summary bar */}
            <div className="rounded-lg p-3" style={{ background: 'var(--n-surface-raised, var(--n-surface))' }}>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--n-text-secondary)' }}>Total Amount</span>
                <span className="font-semibold">₱{totalAmount.toFixed(2)}</span>
              </div>
              {hasDown && (
                <>
                  <div className="flex justify-between text-sm mt-1">
                    <span style={{ color: 'var(--n-text-secondary)' }}>Down Payment</span>
                    <span className="font-semibold" style={{ color: 'var(--n-success)' }}>
                      − ₱{parsedDown.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1 pt-1" style={{ borderTop: '1px solid var(--n-divider)' }}>
                    <span className="font-medium">Balance on Credit</span>
                    <span className="font-bold text-amber-dark">₱{creditAmount.toFixed(2)}</span>
                  </div>
                </>
              )}
              {!hasDown && (
                <div className="flex justify-between text-sm mt-1 pt-1" style={{ borderTop: '1px solid var(--n-divider)' }}>
                  <span className="font-medium">On Credit (full)</span>
                  <span className="font-bold text-amber-dark">₱{totalAmount.toFixed(2)}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Installment Plan mode ── */}
        {mode === 'installments' && (
          <>
            {/* Summary bar */}
            <div className="rounded-lg p-3" style={{ background: 'var(--n-surface-raised, var(--n-surface))' }}>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--n-text-secondary)' }}>Total Amount</span>
                <span className="font-semibold">₱{totalAmount.toFixed(2)}</span>
              </div>
              {hasDown && (
                <>
                  <div className="flex justify-between text-sm mt-1">
                    <span style={{ color: 'var(--n-text-secondary)' }}>Down Payment</span>
                    <span className="font-semibold" style={{ color: 'var(--n-success)' }}>− ₱{parsedDown.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1 pt-1" style={{ borderTop: '1px solid var(--n-divider)' }}>
                    <span className="font-medium">Credit Balance to Schedule</span>
                    <span className="font-bold text-amber-dark">₱{creditAmount.toFixed(2)}</span>
                  </div>
                </>
              )}
              {!hasDown && (
                <div className="flex justify-between text-sm mt-1 pt-1" style={{ borderTop: '1px solid var(--n-divider)' }}>
                  <span className="font-medium">Credit Balance to Schedule</span>
                  <span className="font-bold text-amber-dark">₱{totalAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Installment rows */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="neu-label mb-0">Installments</label>
                <button
                  type="button"
                  onClick={splitEqually}
                  className="text-xs underline"
                  style={{ color: 'var(--n-accent)' }}
                >
                  Split equally
                </button>
              </div>

              {installments.map((inst) => (
                <div key={inst.key} className="flex gap-2 items-center">
                  <div className="relative" style={{ width: '6rem', flexShrink: 0 }}>
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--n-text-dim)' }}>₱</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={inst.amount}
                      onChange={(e) => updateInstallment(inst.key, 'amount', e.target.value)}
                      className="neu-inline-input w-full text-right"
                      style={{ paddingLeft: '1.25rem', paddingRight: '0.4rem', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div className="flex-1">
                    <DatePicker
                      value={inst.dueDate}
                      onChange={(e) => updateInstallment(inst.key, 'dueDate', e.target.value)}
                      min={todayStr()}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeInstallment(inst.key)}
                    disabled={installments.length === 1}
                    className="p-1.5 rounded-lg"
                    style={{ color: 'var(--n-danger)', opacity: installments.length === 1 ? 0.3 : 1 }}
                    title="Remove installment"
                  >
                    <HiTrash className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addInstallment}
                className="flex items-center gap-1.5 text-sm w-full justify-center py-1.5 rounded-lg border border-dashed"
                style={{ borderColor: 'var(--n-border)', color: 'var(--n-text-secondary)' }}
              >
                <HiPlus className="w-4 h-4" /> Add Installment
              </button>

              {/* Balance validation */}
              {installments.some(i => parseFloat(i.amount) > 0) && (
                <div
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    color: installmentsBalanced ? 'var(--n-success)' : 'var(--n-danger)',
                    background: installmentsBalanced ? 'var(--n-success-glow)' : 'var(--n-danger-glow, #fee2e2)',
                  }}
                >
                  {installmentsBalanced
                    ? `✓ Installments match credit balance (₱${creditAmount.toFixed(2)})`
                    : `Total ₱${installmentTotal.toFixed(2)} — must equal credit balance ₱${creditAmount.toFixed(2)}`
                  }
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Down payment (shared) ── */}
        <div>
          <label className="neu-label">
            <HiCash className="inline w-4 h-4 mr-1.5 -mt-0.5" style={{ color: 'var(--n-accent)' }} />
            Down Payment <span className="font-normal" style={{ color: 'var(--n-text-dim)' }}>(optional)</span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--n-text-dim)' }}>₱</span>
              <input
                type="number"
                min="0"
                step="0.01"
                max={totalAmount - 0.01}
                placeholder="0.00"
                value={downPayment}
                onChange={(e) => setDownPayment(e.target.value)}
                className="neu-inline-input w-full"
                style={{ paddingLeft: '1.5rem' }}
              />
            </div>
            {hasDown && (
              <div className="flex-1">
                <Select
                  value={downPaymentMethod}
                  onChange={(e) => setDownPaymentMethod(e.target.value as typeof downPaymentMethod)}
                  options={DOWN_PAYMENT_METHODS}
                />
              </div>
            )}
          </div>
          {downExceedsTotal && (
            <p className="text-xs mt-1" style={{ color: 'var(--n-danger)' }}>
              Down payment cannot equal or exceed the total amount.
            </p>
          )}
        </div>

        {/* ── Reference Number ── */}
        <div>
          <label className="neu-label">
            <HiDocumentText className="inline w-4 h-4 mr-1.5 -mt-0.5" style={{ color: 'var(--n-text-dim)' }} />
            Reference # <span className="font-normal" style={{ color: 'var(--n-text-dim)' }}>(optional)</span>
          </label>
          <input
            type="text"
            className="neu-inline-input w-full"
            placeholder="e.g. PO-2026-001, SOA-Apr-001"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            maxLength={100}
          />
        </div>

        {/* ── Notes ── */}
        <div>
          <label className="neu-label">
            Notes <span className="font-normal" style={{ color: 'var(--n-text-dim)' }}>(optional)</span>
          </label>
          <textarea
            className="neu-inline-input w-full"
            style={{ minHeight: '3rem', resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="e.g. Billing to main office, confirm before delivery"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={300}
          />
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            variant="amber"
            className="flex-1"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            Apply Terms
          </Button>
        </div>
      </div>
    </Modal>
  );
}
