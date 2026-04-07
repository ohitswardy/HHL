import { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { DatePicker } from '../../../components/ui/DatePicker';
import { HiCalendar, HiCash, HiDocumentText } from 'react-icons/hi';

export interface PaymentTermsData {
  termsDays: number;
  dueDate: string;           // ISO date string YYYY-MM-DD
  downPayment: number;       // 0 = full credit
  downPaymentMethod: 'cash' | 'card' | 'bank_transfer' | 'check';
  referenceNumber: string;
  notes: string;
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

export function PaymentTermsModal({ isOpen, onClose, onConfirm, totalAmount, initialData }: Props) {
  const [termsDays, setTermsDays] = useState<string>('30');
  const [dueDate, setDueDate]     = useState<string>(addDays(30));
  const [downPayment, setDownPayment]         = useState<string>('');
  const [downPaymentMethod, setDownPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer' | 'check'>('cash');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes]         = useState<string>('');
  const [customDate, setCustomDate] = useState<boolean>(false);

  // Seed from initialData when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const data = initialData;
    if (data) {
      const days = String(data.termsDays ?? 30);
      const isPreset = TERMS_PRESETS.some(p => p.value === days && p.value !== '0');
      const resolvedTermsDays = isPreset ? days : '0';
      const resolvedCustomDate = !isPreset;
      const resolvedDueDate = data.dueDate ?? addDays(data.termsDays ?? 30);
      const resolvedDownPayment = data.downPayment ? String(data.downPayment) : '';
      const resolvedDownMethod = data.downPaymentMethod ?? 'cash';
      const resolvedRef = data.referenceNumber ?? '';
      const resolvedNotes = data.notes ?? '';

      setTermsDays(resolvedTermsDays);
      setCustomDate(resolvedCustomDate);
      setDueDate(resolvedDueDate);
      setDownPayment(resolvedDownPayment);
      setDownPaymentMethod(resolvedDownMethod);
      setReferenceNumber(resolvedRef);
      setNotes(resolvedNotes);
    } else {
      setTermsDays('30');
      setCustomDate(false);
      setDueDate(addDays(30));
      setDownPayment('');
      setDownPaymentMethod('cash');
      setReferenceNumber('');
      setNotes('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleTermsChange = (value: string) => {
    setTermsDays(value);
    if (value === '0') {
      setCustomDate(true);
    } else {
      setCustomDate(false);
      setDueDate(addDays(Number(value)));
    }
  };

  const parsedDown  = parseFloat(downPayment) || 0;
  const creditAmount = Math.max(0, totalAmount - parsedDown);
  const hasDown = parsedDown > 0;
  const downExceedsTotal = parsedDown >= totalAmount;

  const dueDateObj  = new Date(dueDate);
  const today       = new Date();
  today.setHours(0, 0, 0, 0);
  const duePast     = dueDateObj < today;

  const canConfirm = dueDate && !duePast && (!hasDown || !downExceedsTotal);

  const handleConfirm = () => {
    if (!canConfirm) return;
    const days = customDate
      ? Math.round((dueDateObj.getTime() - today.getTime()) / 86_400_000)
      : Number(termsDays);

    onConfirm({
      termsDays:          Math.max(0, days),
      dueDate,
      downPayment:        parsedDown,
      downPaymentMethod,
      referenceNumber:    referenceNumber.trim(),
      notes:              notes.trim(),
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Payment Terms" width="sm">
      <div className="space-y-4">
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
            min={new Date().toISOString().slice(0, 10)}
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

        {/* Down payment */}
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

        {/* Reference Number */}
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

        {/* Notes */}
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

        {/* Actions */}
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
