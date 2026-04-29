import { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { HiExclamation, HiPencilAlt } from 'react-icons/hi';

const OVERRIDE_REASONS = [
  { value: 'Negotiated',        label: 'Negotiated' },
  { value: 'Damaged',           label: 'Damaged' },
  { value: 'Promo',             label: 'Promo' },
  { value: 'Manager Approval',  label: 'Manager Approval' },
];

interface PriceOverrideTarget {
  productId: number;
  productName: string;
  currentPrice: number;
  originalPrice: number;
}

interface Props {
  isOpen: boolean;
  target: PriceOverrideTarget | null;
  onClose: () => void;
  onApply: (productId: number, newPrice: number, reason: string) => void;
}

export function PriceOverrideModal({ isOpen, target, onClose, onApply }: Props) {
  const [newPrice, setNewPrice] = useState('');
  const [reason, setReason]     = useState('Negotiated');
  const [confirmStep, setConfirmStep] = useState(false);
  const [error, setError] = useState('');

  // Reset form whenever the modal opens for a new target
  useEffect(() => {
    if (isOpen && target) {
      setNewPrice(target.currentPrice.toFixed(2));
      setReason('Negotiated');
      setConfirmStep(false);
      setError('');
    }
  }, [isOpen, target]);

  if (!target) return null;

  const parsedPrice = parseFloat(newPrice);
  const isValidPrice = !isNaN(parsedPrice) && parsedPrice >= 0;

  const handleApplyClick = () => {
    if (!isValidPrice) {
      setError('Please enter a valid price.');
      return;
    }
    setError('');
    setConfirmStep(true);
  };

  const handleConfirm = () => {
    onApply(target.productId, parsedPrice, reason);
    setConfirmStep(false);
    onClose();
  };

  const handleBack = () => setConfirmStep(false);

  const handleClose = () => {
    setConfirmStep(false);
    onClose();
  };

  const priceDiff   = isValidPrice ? parsedPrice - target.originalPrice : 0;
  const diffLabel   = priceDiff === 0 ? '' : priceDiff > 0 ? `+₱${priceDiff.toFixed(2)}` : `-₱${Math.abs(priceDiff).toFixed(2)}`;
  const diffColor   = priceDiff < 0 ? 'var(--n-danger)' : priceDiff > 0 ? 'var(--n-success)' : 'var(--n-text-secondary)';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Override Price" width="sm">
      {!confirmStep ? (
        /* ── Step 1: Enter new price + reason ── */
        <div className="space-y-4">
          <div
            className="rounded-lg px-3 py-2.5 text-sm flex items-start gap-2"
            style={{ background: 'var(--n-surface-raised, var(--n-surface))', border: '1px solid var(--n-divider)' }}
          >
            <HiPencilAlt className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--n-accent)' }} />
            <div>
              <p className="font-medium" style={{ color: 'var(--n-text)' }}>{target.productName}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--n-text-secondary)' }}>
                Base price: ₱{target.originalPrice.toFixed(2)}
                {target.currentPrice !== target.originalPrice && (
                  <> &nbsp;·&nbsp; Current: ₱{target.currentPrice.toFixed(2)}</>
                )}
              </p>
            </div>
          </div>

          {/* New price input */}
          <div>
            <label className="neu-label">New Price (₱)</label>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium"
                style={{ color: 'var(--n-text-dim)' }}
              >
                ₱
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                autoFocus
                className="neu-inline-input w-full"
                style={{ paddingLeft: '1.75rem' }}
                value={newPrice}
                onChange={(e) => { setNewPrice(e.target.value); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyClick(); }}
                placeholder="0.00"
              />
            </div>
            {isValidPrice && priceDiff !== 0 && (
              <p className="text-xs mt-1 font-medium" style={{ color: diffColor }}>
                {diffLabel} from base price
              </p>
            )}
            {error && (
              <p className="text-xs mt-1" style={{ color: 'var(--n-danger)' }}>{error}</p>
            )}
          </div>

          {/* Reason dropdown */}
          <div>
            <label className="neu-label">Reason</label>
            <Select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              options={OVERRIDE_REASONS}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="amber" className="flex-1" onClick={handleApplyClick}>
              Apply Override
            </Button>
          </div>
        </div>
      ) : (
        /* ── Step 2: Confirmation ── */
        <div className="space-y-4">
          <div
            className="rounded-lg p-3 flex items-start gap-3"
            style={{ background: 'var(--n-warning-glow, rgba(245,166,35,0.12))', border: '1px solid var(--n-accent)' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--n-accent)', color: '#fff' }}
            >
              <HiExclamation className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--n-text)' }}>
                Confirm Price Override
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--n-text-secondary)' }}>
                This change applies to this transaction only.
              </p>
            </div>
          </div>

          <div
            className="rounded-lg px-3 py-3 space-y-1.5 text-sm"
            style={{ background: 'var(--n-surface-raised, var(--n-surface))', border: '1px solid var(--n-divider)' }}
          >
            <div className="flex justify-between">
              <span style={{ color: 'var(--n-text-secondary)' }}>Product</span>
              <span className="font-medium">{target.productName}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--n-text-secondary)' }}>Original Price</span>
              <span>₱{target.originalPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--n-text-secondary)' }}>New Price</span>
              <span className="font-bold" style={{ color: 'var(--n-accent)' }}>₱{parsedPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--n-text-secondary)' }}>Reason</span>
              <span className="font-medium">{reason}</span>
            </div>
            {priceDiff !== 0 && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--n-text-secondary)' }}>Difference</span>
                <span className="font-semibold" style={{ color: diffColor }}>{diffLabel}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={handleBack}>
              Back
            </Button>
            <Button variant="amber" className="flex-1" onClick={handleConfirm}>
              Confirm Override
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
