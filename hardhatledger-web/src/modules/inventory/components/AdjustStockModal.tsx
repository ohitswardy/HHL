import { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { Product } from '../../../types';

interface Props {
  product: Product;
  onClose: () => void;
  onSuccess: (updated: Product) => void;
}

export function AdjustStockModal({ product, onClose, onSuccess }: Props) {
  const [type, setType] = useState<'in' | 'out' | 'adjustment'>('in');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onHand = product.stock?.quantity_on_hand ?? 0;

  const previewQty = () => {
    const q = parseInt(quantity) || 0;
    if (type === 'in') return onHand + q;
    if (type === 'out') return onHand - q;
    return q; // adjustment sets absolute
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    const q = parseInt(quantity);
    if (!quantity || isNaN(q) || q < 1) errs.quantity = 'Quantity must be at least 1';
    if (type === 'out' && q > onHand) errs.quantity = `Cannot remove more than on-hand (${onHand})`;
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const res = await api.post('/inventory/adjust', {
        product_id: product.id,
        quantity: parseInt(quantity),
        type,
        notes: notes.trim() || undefined,
      });
      toast.success('Stock adjusted successfully');
      onSuccess(res.data.data);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Adjustment failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = { in: 'Stock In', out: 'Stock Out', adjustment: 'Set Quantity' }[type];
  const preview = previewQty();
  const previewDanger = preview < 0 || preview < product.reorder_level;

  return (
    <Modal isOpen onClose={onClose} title="Adjust Stock" width="sm">
      {/* Product header */}
      <div className="bg-[var(--n-input-bg)] rounded-lg px-4 py-3 mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[var(--n-text)] text-sm">{product.name}</p>
          <p className="text-xs text-[var(--n-text-secondary)] font-mono mt-0.5">{product.sku}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs" style={{ color: "var(--n-text-secondary)" }}>On Hand</p>
          <p className="text-xl font-bold text-[var(--n-text)]">{onHand}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Adjustment Type"
          value={type}
          onChange={(e) => { setType(e.target.value as typeof type); setErrors({}); }}
          options={[
            { value: 'in', label: 'Stock In — Add to inventory' },
            { value: 'out', label: 'Stock Out — Remove from inventory' },
            { value: 'adjustment', label: 'Set Quantity — Override total' },
          ]}
        />

        <Input
          label={type === 'adjustment' ? 'New Total Quantity' : 'Quantity'}
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => { setQuantity(e.target.value); setErrors({}); }}
          error={errors.quantity}
          placeholder="Enter quantity"
        />

        {/* Live preview */}
        {quantity && !errors.quantity && (
          <div className={`rounded-lg px-4 py-3 flex items-center justify-between text-sm ${previewDanger ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
            <span className="text-[var(--n-text-secondary)] font-medium">New stock level:</span>
            <div className="flex items-center gap-2">
              <span className={`text-xl font-bold ${previewDanger ? 'text-red-600' : 'text-green-700'}`}>
                {preview}
              </span>
              {preview < product.reorder_level && (
                <Badge variant="danger">Below Reorder</Badge>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[var(--n-text)] mb-1">Notes <span className="text-[var(--n-text-dim)] font-normal">(optional)</span></label>
          <textarea
            className="neu-inline-input w-full resize-none"
            rows={2}
            placeholder="Reason for adjustment, supplier ref, etc."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="amber" className="flex-1" loading={saving}>
            Confirm {typeLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
