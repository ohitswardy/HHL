import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import {
  HiPlus, HiTrash, HiCheckCircle, HiClipboardCheck, HiDownload,
  HiBan, HiTable,
} from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { PurchaseOrder, PurchaseOrderItem, Supplier, Product } from '../../../types';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/* ─── helpers ──────────────────────────────────────────────────────────────── */

export const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  draft: 'neutral', sent: 'info', partial: 'warning', received: 'success', cancelled: 'danger',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

async function downloadPOPdf(po: PurchaseOrder) {
  const statusColors: Record<string, string> = {
    draft: '#6b7280', sent: '#2563eb', partial: '#d97706', received: '#16a34a', cancelled: '#dc2626',
  };
  const statusColor = statusColors[po.status] ?? '#6b7280';

  const rows = (po.items ?? []).map((it) => `
    <tr>
      <td>${it.product?.name ?? '—'}</td>
      <td style="font-family:monospace;font-size:11px">${it.product?.sku ?? '—'}</td>
      <td style="text-align:center">${it.quantity_ordered}</td>
      <td style="text-align:center;color:#16a34a">${it.quantity_received}</td>
      <td style="text-align:right">₱${fmt(it.unit_cost)}</td>
      <td style="text-align:right;font-weight:600">₱${fmt(it.quantity_ordered * it.unit_cost)}</td>
    </tr>`).join('');

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:794px;background:#fff;';
  container.innerHTML = `
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body, div { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a2e; }
  .wrap { padding: 32px; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #1B3A5C; }
  .brand { font-size: 22px; font-weight: 700; color: #1B3A5C; }
  .brand span { color: #F5A623; }
  .doc-title { font-size: 13px; color: #666; margin-top: 2px; }
  .po-number { font-size: 18px; font-weight: 700; color: #1B3A5C; font-family: monospace; }
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: #fff; background: ${statusColor}; }
  .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
  .info-card { background: #f8f9fa; border-radius: 8px; padding: 10px 12px; }
  .info-label { font-size: 10px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 3px; }
  .info-value { font-size: 13px; font-weight: 500; color: #1a1a2e; }
  .info-value.bold { font-weight: 700; font-size: 15px; color: #1B3A5C; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  thead th { background: #1B3A5C; color: #fff; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; padding: 9px 12px; text-align: left; }
  tbody tr:nth-child(even) { background: #f8f9fa; }
  tbody td { padding: 8px 12px; border-bottom: 1px solid #e9ecef; font-size: 12px; }
  tfoot td { padding: 10px 12px; font-size: 13px; font-weight: 700; border-top: 2px solid #1B3A5C; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #dee2e6; font-size: 10px; color: #aaa; display: flex; justify-content: space-between; }
</style>
<div class="wrap">
  <div class="header">
    <div>
      <div class="brand">Hardhat<span>Ledger</span></div>
      <div class="doc-title">Purchase Order</div>
    </div>
    <div style="text-align:right">
      <div class="po-number">${po.po_number}</div>
      <div style="margin-top:4px"><span class="status-badge">${po.status}</span></div>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-card"><div class="info-label">Supplier</div><div class="info-value">${po.supplier?.name ?? '—'}</div></div>
    <div class="info-card"><div class="info-label">Expected Date</div><div class="info-value">${po.expected_date ? dayjs(po.expected_date).format('MMM D, YYYY') : '—'}</div></div>
    <div class="info-card"><div class="info-label">Total Amount</div><div class="info-value bold">₱${fmt(po.total_amount)}</div></div>
    <div class="info-card"><div class="info-label">Created By</div><div class="info-value">${po.user?.name ?? '—'}</div></div>
    <div class="info-card"><div class="info-label">Created Date</div><div class="info-value">${dayjs(po.created_at).format('MMM D, YYYY')}</div></div>
    <div class="info-card"><div class="info-label">Payment Method</div><div class="info-value">${po.payment_method ?? '—'}</div></div>
  </div>
  <table>
    <thead><tr><th>Product</th><th>SKU</th><th style="text-align:center">Ordered</th><th style="text-align:center">Received</th><th style="text-align:right">Unit Cost</th><th style="text-align:right">Line Total</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="5" style="text-align:right">ORDER TOTAL</td><td style="text-align:right">₱${fmt(po.total_amount)}</td></tr></tfoot>
  </table>
  ${po.notes ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;font-size:12px;color:#78350f;margin-bottom:16px"><strong>Notes:</strong> ${po.notes}</div>` : ''}
  <div class="footer"><span>Generated by HardhatLedger</span><span>${dayjs().format('MMM D, YYYY h:mm A')}</span></div>
</div>`;

  document.body.appendChild(container);
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const canvasFn = (html2canvas as any).default ?? html2canvas;
    const canvas = await canvasFn(container, { scale: 2, useCORS: true, backgroundColor: '#fff' });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
    const imgData = canvas.toDataURL('image/png');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`PO_${po.po_number}_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

function downloadPOCsv(po: PurchaseOrder) {
  const esc = (v: string | number | null | undefined) =>
    `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows: string[] = [];
  rows.push('PURCHASE ORDER');
  rows.push(`PO Number,${esc(po.po_number)}`);
  rows.push(`Supplier,${esc(po.supplier?.name ?? '—')}`);
  rows.push(`Status,${esc(po.status)}`);
  rows.push(`Expected Date,${esc(po.expected_date ? dayjs(po.expected_date).format('MMM D, YYYY') : '—')}`);
  rows.push(`Received Date,${esc(po.received_date ? dayjs(po.received_date).format('MMM D, YYYY') : '—')}`);
  rows.push(`Created By,${esc(po.user?.name ?? '—')}`);
  rows.push(`Created Date,${esc(dayjs(po.created_at).format('MMM D, YYYY h:mm A'))}`);
  if (po.notes) rows.push(`Notes,${esc(po.notes)}`);
  if (po.cancellation_notes) rows.push(`Cancellation Reason,${esc(po.cancellation_notes)}`);
  rows.push('');
  rows.push(['Product', 'SKU', 'Qty Ordered', 'Qty Received', 'Unit Cost (PHP)', 'Line Total (PHP)'].map(esc).join(','));
  (po.items ?? []).forEach((it) => {
    rows.push([
      it.product?.name ?? '—',
      it.product?.sku ?? '—',
      it.quantity_ordered,
      it.quantity_received,
      it.unit_cost.toFixed(2),
      (it.quantity_ordered * it.unit_cost).toFixed(2),
    ].map(esc).join(','));
  });
  rows.push('');
  rows.push(['', '', '', '', 'ORDER TOTAL (PHP):', po.total_amount.toFixed(2)].map(esc).join(','));
  const csv = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PO_${po.po_number}_${dayjs().format('YYYY-MM-DD')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ─── draft-item type for the create form ──────────────────────────────────── */

interface DraftItem { product_id: number | ''; quantity_ordered: number; unit_cost: number; }

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Create PO Modal                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function CreatePOModal({
  isOpen, onClose, suppliers, products, onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  products: Product[];
  onCreated: () => void;
}) {
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [items, setItems] = useState<DraftItem[]>([{ product_id: '', quantity_ordered: 1, unit_cost: 0 }]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setSupplierId(''); setExpectedDate(''); setNotes(''); setPaymentMethod('cash');
    setItems([{ product_id: '', quantity_ordered: 1, unit_cost: 0 }]);
    setErrors({});
  };

  const addItem = () => setItems((prev) => [...prev, { product_id: '', quantity_ordered: 1, unit_cost: 0 }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof DraftItem, value: number | '') =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));

  const onProductChange = (idx: number, pid: number | '') => {
    if (!pid) { updateItem(idx, 'product_id', ''); return; }
    const p = products.find((pr) => pr.id === pid);
    setItems((prev) => prev.map((it, i) =>
      i === idx ? { ...it, product_id: pid, unit_cost: p?.cost_price ?? 0 } : it
    ));
  };

  const filteredProducts = supplierId
    ? products.filter((p) => !p.supplier_id || p.supplier_id === supplierId)
    : products;

  const total = items.reduce((s, it) => (it.product_id ? s + it.quantity_ordered * it.unit_cost : s), 0);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!supplierId) e.supplier = 'Supplier is required';
    const validItems = items.filter((it) => it.product_id);
    if (validItems.length === 0) e.items = 'Add at least one item';
    items.forEach((it, i) => {
      if (!it.product_id) e[`item_${i}_product`] = 'Required';
      if (it.quantity_ordered < 1) e[`item_${i}_qty`] = 'Min 1';
      if (it.unit_cost < 0) e[`item_${i}_cost`] = 'Invalid';
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await api.post('/purchase-orders', {
        supplier_id: supplierId,
        expected_date: expectedDate || null,
        notes: notes || null,
        payment_method: paymentMethod,
        items: items.filter((it) => it.product_id).map((it) => ({
          product_id: it.product_id,
          quantity_ordered: it.quantity_ordered,
          unit_cost: it.unit_cost,
        })),
      });
      toast.success('Purchase order created');
      reset();
      onCreated();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create PO';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { reset(); onClose(); }} title="New Purchase Order" width="xl">
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select
            label="Supplier *"
            value={supplierId}
            onChange={(e) => { setSupplierId(e.target.value ? Number(e.target.value) : ''); }}
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            placeholder="Select supplier..."
            error={errors.supplier}
          />
          <DatePicker
            label="Expected Delivery"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
          />
          <Select
            label="Payment Method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'card', label: 'Card' },
              { value: 'bank_transfer', label: 'Bank Transfer' },
              { value: 'check', label: 'Check' },
              { value: 'business_bank', label: 'Business Bank' },
            ]}
          />
          <Input
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes..."
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-[var(--n-text)]">Order Items *</label>
            <button onClick={addItem} className="flex items-center gap-1 text-xs text-[var(--n-text)] font-semibold hover:underline">
              <HiPlus className="w-3.5 h-3.5" /> Add Line
            </button>
          </div>
          {errors.items && <p className="text-xs text-red-500 mb-2">{errors.items}</p>}

          <div className="space-y-2">
            <div className="hidden md:grid grid-cols-[1fr_80px_120px_100px_32px] gap-2 px-1">
              <span className="text-xs font-semibold text-[var(--n-text-secondary)] uppercase tracking-wide">Product</span>
              <span className="text-xs font-semibold text-[var(--n-text-secondary)] uppercase tracking-wide text-center">Qty</span>
              <span className="text-xs font-semibold text-[var(--n-text-secondary)] uppercase tracking-wide text-center">Unit Cost (₱)</span>
              <span className="text-xs font-semibold text-[var(--n-text-secondary)] uppercase tracking-wide text-right">Subtotal</span>
              <span></span>
            </div>

            {items.map((item, idx) => {
              const selectedProduct = products.find((p) => p.id === item.product_id);
              return (
                <div key={idx} className="grid grid-cols-[1fr_80px_120px_100px_32px] gap-2 items-start p-2 rounded-lg border border-[var(--n-divider)] bg-[var(--n-surface)]">
                  <div>
                    <Select
                      inline
                      value={item.product_id}
                      onChange={(e) => onProductChange(idx, e.target.value ? Number(e.target.value) : '')}
                      options={[{ value: '', label: 'Select product...' }, ...filteredProducts.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` }))]}
                      error={errors[`item_${idx}_product`]}
                    />
                    {selectedProduct && (
                      <span className="text-xs text-[var(--n-text-dim)] mt-0.5 block pl-1">Unit: {selectedProduct.unit}</span>
                    )}
                  </div>
                  <input
                    type="number" min={1}
                    className={`w-full px-2 py-1.5 border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-navy/30 bg-[var(--n-input-bg)] ${errors[`item_${idx}_qty`] ? 'border-red-400' : 'border-[var(--n-divider)]'}`}
                    value={item.quantity_ordered}
                    onChange={(e) => updateItem(idx, 'quantity_ordered', Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <input
                    type="number" min={0} step="0.01"
                    className={`w-full px-2 py-1.5 border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-navy/30 bg-[var(--n-input-bg)] ${errors[`item_${idx}_cost`] ? 'border-red-400' : 'border-[var(--n-divider)]'}`}
                    value={item.unit_cost}
                    onChange={(e) => updateItem(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                  />
                  <div className="text-right font-medium text-[var(--n-text)] text-sm pt-1.5">
                    ₱{fmt(item.product_id ? item.quantity_ordered * item.unit_cost : 0)}
                  </div>
                  <div className="flex items-start pt-1">
                    {items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="p-1 hover:bg-red-50 rounded text-red-400 transition-colors">
                        <HiTrash className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="flex justify-end items-center gap-3 pt-2 pr-1">
              <span className="text-sm font-semibold text-[var(--n-text-secondary)]">Order Total:</span>
              <span className="text-base font-bold text-[var(--n-text)]">₱{fmt(total)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--n-divider)]">
        <Button variant="secondary" onClick={() => { reset(); onClose(); }}>Cancel</Button>
        <Button variant="amber" onClick={handleSubmit} loading={saving}>Create Purchase Order</Button>
      </div>
    </Modal>
  );
}

/* ── Info card used inside the detail modal ── */

export function InfoCard({ label, value, bold, children }: { label: string; value?: string; bold?: boolean; children?: React.ReactNode }) {
  return (
    <div className="bg-[var(--n-input-bg)] rounded-lg px-3 py-2.5">
      <p className="text-xs font-medium text-[var(--n-text-secondary)] mb-0.5">{label}</p>
      {children ?? <p className={`text-sm ${bold ? 'font-bold text-[var(--n-text)]' : 'text-[var(--n-text)]'}`}>{value}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Receive Items Form (inside detail modal)                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function ReceiveItemsForm({
  po, onCancel, onReceived,
}: {
  po: PurchaseOrder;
  onCancel: () => void;
  onReceived: (updated: PurchaseOrder) => void;
}) {
  type Row = { product_id: number; quantity_received: number; max: number };

  const buildRows = (): Row[] =>
    (po.items ?? [])
      .filter((it) => it.quantity_ordered - it.quantity_received > 0)
      .map((it) => ({
        product_id: it.product_id,
        quantity_received: it.quantity_ordered - it.quantity_received,
        max: it.quantity_ordered - it.quantity_received,
      }));

  const [rows, setRows] = useState<Row[]>(buildRows);
  const [saving, setSaving] = useState(false);

  const updateQty = (idx: number, value: number) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, quantity_received: Math.min(r.max, Math.max(0, value)) } : r)));

  const activeRows = rows.filter((r) => r.quantity_received > 0);

  const handleSubmit = async () => {
    if (activeRows.length === 0) { toast.error('Enter quantity for at least one item'); return; }
    setSaving(true);
    try {
      const res = await api.post(`/purchase-orders/${po.id}/receive`, {
        items: activeRows.map((r) => ({ product_id: r.product_id, quantity_received: r.quantity_received })),
      });
      toast.success('Items received — inventory updated');
      onReceived(res.data.data);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to receive items';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="pt-4 border-t border-[var(--n-divider)] text-center">
        <HiCheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
        <p className="text-sm text-[var(--n-text-secondary)] font-medium">All items have been fully received.</p>
        <Button variant="secondary" className="mt-3" onClick={onCancel}>Close</Button>
      </div>
    );
  }

  return (
    <div className="pt-4 border-t border-[var(--n-divider)]">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--n-text)] mb-3">
        <HiClipboardCheck className="w-4 h-4 text-amber" /> Receive Items
      </h4>

      <div className="border border-[var(--n-divider)] rounded-lg overflow-hidden mb-4">
        <table className="neu-table">
          <thead className="bg-amber-50/80 border-b border-amber-100">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-[var(--n-text)]">Product</th>
              <th className="text-center px-4 py-2.5 font-medium text-[var(--n-text)] w-28">Remaining</th>
              <th className="text-center px-4 py-2.5 font-medium text-[var(--n-text)] w-36">Qty to Receive</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const item = (po.items ?? []).find((it) => it.product_id === row.product_id);
              return (
                <tr key={row.product_id} className="hover:bg-[var(--n-input-bg)] transition-colors">
                  <td>
                    <span className="font-medium">{item?.product?.name ?? `Product #${row.product_id}`}</span>
                    <span className="ml-2 text-xs text-[var(--n-text-dim)] font-mono">{item?.product?.sku}</span>
                  </td>
                  <td className="px-4 py-3 text-center font-medium text-amber-600">{row.max}</td>
                  <td>
                    <input
                      type="number" min={0} max={row.max}
                      className="neu-inline-input w-full text-center"
                      value={row.quantity_received}
                      onChange={(e) => updateQty(idx, parseInt(e.target.value) || 0)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mb-4 px-1">
        <p className="text-xs" style={{ color: 'var(--n-text-secondary)' }}>
          Receiving <span className="font-bold text-[var(--n-text)]">{activeRows.reduce((s, r) => s + r.quantity_received, 0)}</span> items across{' '}
          <span className="font-bold text-[var(--n-text)]">{activeRows.length}</span> products
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="amber" onClick={handleSubmit} loading={saving}>
          <HiCheckCircle className="w-4 h-4 mr-2" /> Confirm Receipt
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  PO Detail Modal                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function PODetailModal({
  po, isOpen, onClose, onUpdated, onRequestCancel,
}: {
  po: PurchaseOrder;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updated: PurchaseOrder) => void;
  onRequestCancel: (po: PurchaseOrder) => void;
}) {
  const [receiveMode, setReceiveMode] = useState(false);
  const [prevPoKey, setPrevPoKey] = useState(`${po.id}-${po.status}`);
  const canReceive = po.status === 'draft' || po.status === 'sent' || po.status === 'partial';
  const canCancel = po.status === 'draft' || po.status === 'sent' || po.status === 'partial';
  const isCancelled = po.status === 'cancelled';

  const poKey = `${po.id}-${po.status}`;
  if (poKey !== prevPoKey) {
    setPrevPoKey(poKey);
    setReceiveMode(false);
  }

  const totalOrdered = (po.items ?? []).reduce((s, it) => s + it.quantity_ordered, 0);
  const totalReceived = (po.items ?? []).reduce((s, it) => s + it.quantity_received, 0);
  const progressPct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Purchase Order — ${po.po_number}`} width="xl">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <InfoCard label="Supplier" value={po.supplier?.name ?? '—'} />
        <InfoCard label="Status">
          <Badge variant={STATUS_VARIANT[po.status] ?? 'neutral'}>{po.status}</Badge>
        </InfoCard>
        <InfoCard label="Total Amount" value={`₱${fmt(po.total_amount)}`} bold />
        <InfoCard label="Expected Date" value={po.expected_date ? dayjs(po.expected_date).format('MMM D, YYYY') : '—'} />
        <InfoCard label="Received Date" value={po.received_date ? dayjs(po.received_date).format('MMM D, YYYY') : '—'} />
        <InfoCard label="Created By" value={`${po.user?.name ?? '—'} · ${dayjs(po.created_at).format('MMM D, YYYY')}`} />
        {isCancelled && (
          <InfoCard label="Cancelled On" value={po.cancelled_at ? dayjs(po.cancelled_at).format('MMM D, YYYY h:mm A') : '—'} />
        )}
      </div>

      {isCancelled && po.received_total !== null && (
        <div className="mb-5 grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3">
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Items Received</p>
            <p className="text-lg font-bold text-green-700">{po.received_qty ?? 0} <span className="text-sm font-normal">units</span></p>
            <p className="text-sm font-semibold text-green-800 mt-0.5">₱{fmt(po.received_total ?? 0)}</p>
          </div>
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Items Cancelled</p>
            <p className="text-lg font-bold text-red-700">{po.cancelled_qty ?? 0} <span className="text-sm font-normal">units</span></p>
            <p className="text-sm font-semibold text-red-800 mt-0.5">₱{fmt(po.cancelled_total ?? 0)}</p>
          </div>
        </div>
      )}

      {po.cancellation_notes && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <span className="font-semibold">Cancellation reason:</span> {po.cancellation_notes}
        </div>
      )}

      {po.notes && (
        <div className="mb-5 px-3 py-2 bg-[var(--n-input-bg)] rounded-lg text-sm text-[var(--n-text-secondary)]">
          <span className="font-medium text-[var(--n-text-secondary)]">Notes:</span> {po.notes}
        </div>
      )}

      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-[var(--n-text-secondary)]">Receiving Progress</span>
          <span className="text-xs font-bold text-[var(--n-text)]">{totalReceived} / {totalOrdered} items ({progressPct}%)</span>
        </div>
        <div className="w-full h-2.5 bg-[var(--n-inset)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressPct >= 100 ? 'bg-green-500' : progressPct > 0 ? 'bg-amber' : 'bg-[var(--n-text-dim)]'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="border border-[var(--n-divider)] rounded-lg overflow-hidden mb-6">
        <table className="neu-table">
          <thead>
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-[var(--n-text-secondary)]">Product</th>
              <th className="text-left px-4 py-2.5 font-medium text-[var(--n-text-secondary)] w-16">SKU</th>
              <th className="text-center px-4 py-2.5 font-medium text-[var(--n-text-secondary)] w-20">Ordered</th>
              <th className="text-center px-4 py-2.5 font-medium text-[var(--n-text-secondary)] w-20">Received</th>
              <th className="text-center px-4 py-2.5 font-medium text-[var(--n-text-secondary)] w-24">{isCancelled ? 'Cancelled' : 'Remaining'}</th>
              <th className="text-right px-4 py-2.5 font-medium text-[var(--n-text-secondary)] w-28">Unit Cost</th>
              <th className="text-right px-4 py-2.5 font-medium text-[var(--n-text-secondary)] w-28">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {(po.items ?? []).map((item: PurchaseOrderItem) => {
              const remaining = item.quantity_ordered - item.quantity_received;
              const fullyReceived = remaining === 0;
              return (
                <tr key={item.id} className={`transition-colors ${fullyReceived ? 'bg-green-50/40' : 'hover:bg-[var(--n-input-bg)]'}`}>
                  <td className="font-medium">{item.product?.name ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--n-text-secondary)]">{item.product?.sku ?? '—'}</td>
                  <td className="px-4 py-3 text-center">{item.quantity_ordered}</td>
                  <td className="px-4 py-3 text-center font-medium text-green-700">{item.quantity_received}</td>
                  <td className="px-4 py-3 text-center">
                    {fullyReceived ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                        <HiCheckCircle className="w-3.5 h-3.5" /> Done
                      </span>
                    ) : isCancelled && remaining > 0 ? (
                      <span className="font-medium text-red-500">{remaining}</span>
                    ) : (
                      <span className="font-medium text-amber-600">{remaining}</span>
                    )}
                  </td>
                  <td className="text-right">₱{fmt(item.unit_cost)}</td>
                  <td className="text-right font-semibold">₱{fmt(item.quantity_ordered * item.unit_cost)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-[var(--n-input-bg)] border-t border-[var(--n-divider)]">
            <tr>
              <td colSpan={6} className="px-4 py-2.5 text-right text-sm font-semibold text-[var(--n-text-secondary)]">Total:</td>
              <td className="px-4 py-2.5 text-right font-bold text-[var(--n-text)]">₱{fmt(po.total_amount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {!receiveMode && (
        <div className="flex justify-between items-center pt-2 border-t border-[var(--n-divider)]">
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => downloadPOPdf(po)}>
              <HiDownload className="w-4 h-4 mr-2" /> Download PDF
            </Button>
            <Button variant="secondary" onClick={() => downloadPOCsv(po)}>
              <HiTable className="w-4 h-4 mr-2" /> Download CSV
            </Button>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            {canCancel && (
              <Button
                variant="secondary"
                onClick={() => onRequestCancel(po)}
                className="!text-red-600 !border-red-300 hover:!bg-red-50"
              >
                <HiBan className="w-4 h-4 mr-2" /> Cancel PO
              </Button>
            )}
            {canReceive && (
              <Button variant="amber" onClick={() => setReceiveMode(true)}>
                <HiClipboardCheck className="w-4 h-4 mr-2" /> Receive Items
              </Button>
            )}
          </div>
        </div>
      )}

      {canReceive && receiveMode && (
        <ReceiveItemsForm
          po={po}
          onCancel={() => setReceiveMode(false)}
          onReceived={onUpdated}
        />
      )}
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Cancel PO Modal                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function CancelPOModal({
  po, isOpen, onClose, onCancelled,
}: {
  po: PurchaseOrder;
  isOpen: boolean;
  onClose: () => void;
  onCancelled: (updated: PurchaseOrder) => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const isPartial = po.status === 'partial';
  const receivedTotal = po.items
    ? po.items.reduce((s, it) => s + it.quantity_received * it.unit_cost, 0)
    : po.received_total ?? 0;
  const cancelledTotal = po.items
    ? po.items.reduce((s, it) => s + (it.quantity_ordered - it.quantity_received) * it.unit_cost, 0)
    : po.cancelled_total ?? 0;
  const receivedQty = po.items
    ? po.items.reduce((s, it) => s + it.quantity_received, 0)
    : po.received_qty ?? 0;
  const cancelledQty = po.items
    ? po.items.reduce((s, it) => s + (it.quantity_ordered - it.quantity_received), 0)
    : po.cancelled_qty ?? 0;

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const res = await api.post(`/purchase-orders/${po.id}/cancel`, {
        cancellation_notes: reason.trim() || null,
      });
      toast.success('Purchase order cancelled');
      onCancelled(res.data.data);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Failed to cancel purchase order';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cancel Purchase Order" width="md">
      <div className="space-y-5">
        <div className="flex items-center gap-3 px-4 py-3 bg-[var(--n-input-bg)] rounded-xl border border-[var(--n-divider)]">
          <HiBan className="w-8 h-8 text-red-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-[var(--n-text)]">{po.po_number}</p>
            <p className="text-sm text-[var(--n-text-secondary)]">{po.supplier?.name ?? '—'} · <Badge variant={STATUS_VARIANT[po.status] ?? 'neutral'}>{po.status}</Badge></p>
          </div>
        </div>

        {isPartial && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-amber-800">This PO has partial receipts</p>
            <p className="text-xs text-amber-700">
              Already-received items will <strong>remain in inventory</strong> and a journal entry will be posted
              for the received portion. The unfulfilled balance will be cancelled.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-white rounded-lg border border-green-200 px-3 py-2.5">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">To Keep (Received)</p>
                <p className="text-base font-bold text-green-700">{receivedQty} units</p>
                <p className="text-sm font-semibold text-green-800">₱{fmt(receivedTotal)}</p>
              </div>
              <div className="bg-white rounded-lg border border-red-200 px-3 py-2.5">
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">To Cancel</p>
                <p className="text-base font-bold text-red-700">{cancelledQty} units</p>
                <p className="text-sm font-semibold text-red-800">₱{fmt(cancelledTotal)}</p>
              </div>
            </div>
          </div>
        )}

        {!isPartial && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm font-semibold text-red-700">
              This will cancel the entire purchase order of <span className="font-bold">₱{fmt(po.total_amount)}</span>.
            </p>
            <p className="text-xs text-red-600 mt-1">No items have been received, so no inventory or journal changes will be made.</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Cancellation Reason <span className="text-[var(--n-text-dim)] font-normal">(optional)</span></label>
          <textarea
            className="w-full px-3 py-2 rounded-xl border border-[var(--n-divider)] bg-[var(--n-input-bg)] text-sm text-[var(--n-text)] focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
            rows={3}
            maxLength={1000}
            placeholder="Enter reason for cancellation..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--n-divider)]">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Keep PO</Button>
        <Button
          variant="secondary"
          onClick={handleConfirm}
          loading={saving}
          className="!bg-red-600 !text-white !border-red-600 hover:!bg-red-700"
        >
          <HiBan className="w-4 h-4 mr-2" /> Confirm Cancellation
        </Button>
      </div>
    </Modal>
  );
}
