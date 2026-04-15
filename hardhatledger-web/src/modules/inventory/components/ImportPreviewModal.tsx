import { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Spinner } from '../../../components/ui/Spinner';
import { HiInformationCircle, HiExclamationCircle, HiArrowRight } from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';

export interface PreviewRow {
  row_num: number;
  name: string | null;
  sku: string | null;
  status: 'new' | 'existing' | 'skip';
  reason: string | null;
  import_data: {
    name: string;
    sku: string | null;
    category: string | null;
    unit: string;
    cost_price: number;
    base_selling_price: number;
    quantity: number | null;
  } | null;
  existing_product: {
    id: number;
    name: string;
    sku: string;
    category: string | null;
    unit: string;
    cost_price: number;
    base_selling_price: number;
    current_stock: number;
  } | null;
}

export interface ImportPreviewData {
  has_quantity_column: boolean;
  rows: PreviewRow[];
  summary: {
    new_count: number;
    update_count: number;
    skip_count: number;
    total: number;
  };
}

export interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
  message: string;
}

interface Props {
  file: File;
  previewData: ImportPreviewData;
  onClose: () => void;
  onSuccess: (result: ImportResult) => void;
}

export function ImportPreviewModal({ file, previewData, onClose, onSuccess }: Props) {
  const [quantityMode, setQuantityMode] = useState<'add' | 'override'>('add');
  const [importing, setImporting] = useState(false);

  const { summary, rows, has_quantity_column } = previewData;
  const canImport = summary.new_count > 0 || summary.update_count > 0;

  /** Compute the projected stock for a row based on the selected mode. */
  const getStockProjection = (row: PreviewRow): { current: number; projected: number } | null => {
    if (!has_quantity_column || row.import_data?.quantity == null) return null;
    const qty = row.import_data.quantity;
    if (row.status === 'existing' && row.existing_product) {
      const cur = row.existing_product.current_stock;
      return { current: cur, projected: quantityMode === 'override' ? qty : cur + qty };
    }
    if (row.status === 'new') {
      return { current: 0, projected: qty };
    }
    return null;
  };

  const handleConfirm = async () => {
    setImporting(true);
    try {
      const data = new FormData();
      data.append('file', file);
      if (has_quantity_column) {
        data.append('quantity_mode', quantityMode);
      }
      const res = await api.post('/products/import', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(res.data.message);
      onSuccess(res.data as ImportResult);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Import Preview" width="xl">
      <div className="space-y-4">

        {/* ── Summary stats ─────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{summary.new_count}</p>
            <p className="text-xs text-green-600 mt-0.5 font-medium">New Products</p>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{summary.update_count}</p>
            <p className="text-xs text-blue-600 mt-0.5 font-medium">Stock Updates</p>
          </div>
          <div className="rounded-xl bg-[var(--n-inset)] border border-[var(--n-divider)] p-3 text-center">
            <p className="text-2xl font-bold text-[var(--n-text-secondary)]">{summary.skip_count}</p>
            <p className="text-xs text-[var(--n-text-dim)] mt-0.5 font-medium">Skipped Rows</p>
          </div>
        </div>

        {/* ── Quantity mode selector ─────────────────────────────────── */}
        {has_quantity_column && summary.update_count > 0 && (
          <div className="rounded-xl border border-[var(--n-divider)] bg-[var(--n-inset)] p-4 space-y-3">
            <p className="text-sm font-semibold text-[var(--n-text)]">
              Quantity column detected — how should existing stock be updated?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setQuantityMode('add')}
                className={`px-4 py-3 rounded-xl text-sm font-medium border-2 text-left transition-all ${
                  quantityMode === 'add'
                    ? 'bg-navy text-white border-navy shadow-md'
                    : 'bg-[var(--n-surface)] text-[var(--n-text-secondary)] border-[var(--n-divider)] hover:border-navy/40'
                }`}
              >
                <span className="block font-semibold">Add to existing stock</span>
                <span className={`block text-xs mt-0.5 ${quantityMode === 'add' ? 'opacity-80' : 'opacity-60'}`}>
                  Current + import qty (e.g. 30 + 50 = 80)
                </span>
              </button>
              <button
                onClick={() => setQuantityMode('override')}
                className={`px-4 py-3 rounded-xl text-sm font-medium border-2 text-left transition-all ${
                  quantityMode === 'override'
                    ? 'bg-red-600 text-white border-red-600 shadow-md'
                    : 'bg-[var(--n-surface)] text-[var(--n-text-secondary)] border-[var(--n-divider)] hover:border-red-400/40'
                }`}
              >
                <span className="block font-semibold">Override stock</span>
                <span className={`block text-xs mt-0.5 ${quantityMode === 'override' ? 'opacity-80' : 'opacity-60'}`}>
                  Replace with import qty (e.g. set to 50)
                </span>
              </button>
            </div>
            {quantityMode === 'override' && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <HiExclamationCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                <span>
                  <strong>Warning:</strong> Override will replace current stock with the imported quantity.
                  This action is recorded in the inventory movement log.
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Preview table ──────────────────────────────────────────── */}
        <div className="rounded-xl border border-[var(--n-divider)] overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-[var(--n-inset)] z-10">
                <tr>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-[var(--n-text-secondary)] uppercase tracking-wide border-b border-[var(--n-divider)] w-10">#</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-[var(--n-text-secondary)] uppercase tracking-wide border-b border-[var(--n-divider)]">Product</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-[var(--n-text-secondary)] uppercase tracking-wide border-b border-[var(--n-divider)] w-28">SKU</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-[var(--n-text-secondary)] uppercase tracking-wide border-b border-[var(--n-divider)] w-24">Status</th>
                  {has_quantity_column && (
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-[var(--n-text-secondary)] uppercase tracking-wide border-b border-[var(--n-divider)] w-32">Stock Change</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const proj = getStockProjection(row);
                  const isSkip = row.status === 'skip';
                  return (
                    <tr
                      key={row.row_num}
                      className={`border-t border-[var(--n-divider)] transition-colors ${
                        isSkip ? 'opacity-50' : 'hover:bg-[var(--n-input-bg)]'
                      }`}
                    >
                      <td className="px-3 py-2.5 text-xs text-[var(--n-text-dim)]">{row.row_num}</td>
                      <td className="px-3 py-2.5">
                        <p className={`font-medium ${isSkip ? 'text-[var(--n-text-secondary)] line-through' : 'text-[var(--n-text)]'}`}>
                          {row.name ?? <span className="italic text-[var(--n-text-dim)]">—</span>}
                        </p>
                        {row.reason && (
                          <p className={`text-xs mt-0.5 ${isSkip ? 'text-red-500' : 'text-blue-500'}`}>{row.reason}</p>
                        )}
                        {row.status === 'existing' && row.existing_product?.category && (
                          <p className="text-xs text-[var(--n-text-dim)]">{row.existing_product.category}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-[var(--n-text-secondary)]">
                        {row.sku ?? <span className="text-[var(--n-text-dim)] not-italic">(auto)</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {row.status === 'new'      && <Badge variant="success">New</Badge>}
                        {row.status === 'existing' && <Badge variant="info">Update</Badge>}
                        {row.status === 'skip'     && <Badge variant="neutral">Skip</Badge>}
                      </td>
                      {has_quantity_column && (
                        <td className="px-3 py-2.5 text-center">
                          {proj !== null ? (
                            <span className="inline-flex items-center gap-1 text-xs font-mono">
                              {row.status === 'existing' ? (
                                <>
                                  <span className="text-[var(--n-text-secondary)]">{proj.current}</span>
                                  <HiArrowRight className="w-3 h-3 text-[var(--n-text-dim)]" />
                                  <span className={`font-bold ${
                                    proj.projected > proj.current
                                      ? 'text-green-600'
                                      : proj.projected < proj.current
                                        ? 'text-red-600'
                                        : 'text-[var(--n-text)]'
                                  }`}>
                                    {proj.projected}
                                  </span>
                                </>
                              ) : (
                                <span className="text-green-600 font-bold">{proj.projected}</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[var(--n-text-dim)] text-xs">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Info note ──────────────────────────────────────────────── */}
        <div className="flex items-start gap-2 text-xs text-[var(--n-text-secondary)] bg-[var(--n-inset)] rounded-lg px-3 py-2.5 border border-[var(--n-divider)]">
          <HiInformationCircle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--n-text-dim)]" />
          <span>
            {summary.update_count > 0
              ? `${summary.update_count} existing product(s) will have their stock updated. Product name, price and other details will not be changed.`
              : 'No existing products found in this file. All valid rows will be created as new products.'}
            {!has_quantity_column && ' No quantity column was detected — stock levels will not be changed.'}
          </span>
        </div>

        {/* ── Footer actions ─────────────────────────────────────────── */}
        <div className="flex justify-between items-center pt-1">
          <p className="text-xs text-[var(--n-text-dim)]">
            File: <span className="font-medium text-[var(--n-text-secondary)]">{file.name}</span>
            &nbsp;·&nbsp;{summary.total} row{summary.total !== 1 ? 's' : ''} parsed
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} disabled={importing}>
              Back
            </Button>
            <Button
              variant="amber"
              onClick={handleConfirm}
              disabled={importing || !canImport}
            >
              {importing ? (
                <>
                  <Spinner size="sm" />
                  <span className="ml-2">Importing…</span>
                </>
              ) : (
                `Confirm Import (${summary.new_count + summary.update_count})`
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
