import { useState, useEffect } from 'react';
import { HiX, HiRefresh, HiDocumentDownload } from 'react-icons/hi';

export type ExportFormat = 'pdf' | 'csv' | 'xlsx';

export interface ExportColumn {
  key: string;
  label: string;
  default: boolean;
  required?: boolean;
}

export type ExportKey =
  | 'products'
  | 'stock'
  | 'movements'
  | 'purchase-orders'
  | 'transactions'
  | 'expenses'
  | 'bank-transactions'
  | 'audit-trail'
  | 'client-statements';

export interface ExportColumnPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  exportKey: ExportKey;
  formats: ExportFormat[];
  hasFilterOption?: boolean;
  isFiltered?: boolean;
  onExport: (format: ExportFormat, columns: string[], filtered: boolean) => void;
  exporting?: boolean;
}

// ── Column definitions ──────────────────────────────────────────────────────
export const EXPORT_COLUMN_DEFINITIONS: Record<ExportKey, ExportColumn[]> = {
  products: [
    { key: 'sku',           label: 'SKU',           default: true  },
    { key: 'name',          label: 'Product Name',  default: true  },
    { key: 'category',      label: 'Category',      default: true  },
    { key: 'unit',          label: 'Unit',          default: true  },
    { key: 'cost_price',    label: 'Cost Price',    default: true  },
    { key: 'selling_price', label: 'Selling Price', default: true  },
    { key: 'stock',         label: 'Stock',         default: true  },
    { key: 'reorder_level', label: 'Reorder Level', default: true  },
    { key: 'status',        label: 'Status',        default: true  },
  ],
  stock: [
    { key: 'name',          label: 'Product Name',  default: true  },
    { key: 'sku',           label: 'SKU',           default: true  },
    { key: 'category',      label: 'Category',      default: true  },
    { key: 'unit',          label: 'Unit',          default: true  },
    { key: 'on_hand',       label: 'On Hand',       default: true  },
    { key: 'reserved',      label: 'Reserved',      default: true  },
    { key: 'available',     label: 'Available',     default: true  },
    { key: 'reorder_level', label: 'Reorder Level', default: true  },
    { key: 'status',        label: 'Status',        default: true  },
  ],
  movements: [
    { key: 'date',           label: 'Date & Time',    default: true  },
    { key: 'product',        label: 'Product',        default: true  },
    { key: 'sku',            label: 'SKU',            default: true  },
    { key: 'type',           label: 'Type',           default: true  },
    { key: 'quantity',       label: 'Quantity',       default: true  },
    { key: 'unit_cost',      label: 'Unit Cost',      default: true  },
    { key: 'reference_type', label: 'Reference Type', default: true  },
    { key: 'reference_id',   label: 'Reference ID',   default: false },
    { key: 'notes',          label: 'Notes',          default: true  },
    { key: 'user',           label: 'User',           default: true  },
  ],
  'purchase-orders': [
    { key: 'po_number',     label: 'PO #',          default: true  },
    { key: 'supplier',      label: 'Supplier',      default: true  },
    { key: 'status',        label: 'Status',        default: true  },
    { key: 'items',         label: 'Items',         default: true  },
    { key: 'total',         label: 'Total (₱)',     default: true  },
    { key: 'expected_date', label: 'Expected Date', default: true  },
    { key: 'created_date',  label: 'Created Date',  default: true  },
    { key: 'notes',         label: 'Notes',         default: false },
  ],
  transactions: [
    { key: 'transaction_number', label: 'Transaction #',    default: true  },
    { key: 'date',               label: 'Date',             default: true  },
    { key: 'client',             label: 'Client',           default: true  },
    { key: 'fulfillment_type',   label: 'Fulfillment Type', default: true  },
    { key: 'status',             label: 'Status',           default: true  },
    { key: 'subtotal',           label: 'Subtotal',         default: true  },
    { key: 'discount',           label: 'Discount',         default: true  },
    { key: 'total',              label: 'Total',            default: true  },
    { key: 'payment_method',     label: 'Payment Method',   default: true  },
    { key: 'cashier',            label: 'Cashier',          default: true  },
    { key: 'notes',              label: 'Notes',            default: false },
  ],
  expenses: [
    { key: 'expense_number',  label: 'Expense #',     default: true  },
    { key: 'date',            label: 'Date',          default: true  },
    { key: 'payee',           label: 'Payee',         default: true  },
    { key: 'supplier',        label: 'Supplier',      default: true  },
    { key: 'category',        label: 'Category',      default: true  },
    { key: 'account_code',    label: 'Account Code',  default: false },
    { key: 'reference_number',label: 'Reference No.', default: false },
    { key: 'source',          label: 'Source',        default: true  },
    { key: 'po_number',       label: 'Linked PO #',   default: false },
    { key: 'subtotal',        label: 'Subtotal',      default: true  },
    { key: 'tax_amount',      label: 'VAT / Tax',     default: true  },
    { key: 'total_amount',    label: 'Total Amount',  default: true  },
    { key: 'notes',           label: 'Notes',         default: false },
    { key: 'status',          label: 'Status',        default: true  },
    { key: 'recorded_by',     label: 'Recorded By',   default: true  },
    { key: 'created_at',      label: 'Created At',    default: false },
  ],
  'bank-transactions': [
    { key: 'date',             label: 'Date',             default: true  },
    { key: 'ref_no',           label: 'Ref No',           default: true  },
    { key: 'type',             label: 'Type',             default: true  },
    { key: 'payee_account',    label: 'Payee / Account',  default: true  },
    { key: 'memo',             label: 'Memo',             default: true  },
    { key: 'additional_notes', label: 'Additional Notes', default: false },
    { key: 'payment',          label: 'Payment (₱)',      default: true  },
    { key: 'deposit',          label: 'Deposit (₱)',      default: true  },
    { key: 'tax',              label: 'Tax (₱)',          default: false },
    { key: 'balance',          label: 'Balance (₱)',      default: true  },
  ],
  'audit-trail': [
    { key: 'created_at',  label: 'Date / Time', default: true  },
    { key: 'user',        label: 'User',        default: true  },
    { key: 'action',      label: 'Action',      default: true  },
    { key: 'table_name',  label: 'Module',      default: true  },
    { key: 'record_id',   label: 'Record ID',   default: false },
    { key: 'ip_address',  label: 'IP Address',  default: false },
  ],
  'client-statements': [
    { key: 'transaction_number', label: 'Transaction #',    default: true,  required: true },
    { key: 'date',               label: 'Date',             default: true,  required: true },
    { key: 'time',               label: 'Time',             default: false },
    { key: 'fulfillment_type',   label: 'Fulfillment Type', default: false },
    { key: 'status',             label: 'Status',           default: true  },
    { key: 'payment_method',     label: 'Payment Method',   default: true  },
    { key: 'cashier',            label: 'Cashier',          default: false },
    { key: 'subtotal',           label: 'Subtotal (₱)',     default: false },
    { key: 'discount',           label: 'Discount (₱)',     default: false },
    { key: 'tax',                label: 'VAT (₱)',           default: false },
    { key: 'total',              label: 'Total (₱)',         default: true,  required: true },
    { key: 'paid',               label: 'Paid (₱)',          default: true  },
    { key: 'balance_due',        label: 'Balance Due (₱)',   default: false },
  ],
};

// ── localStorage helpers ────────────────────────────────────────────────────
const STORAGE_PREFIX = 'hhl_export_cols_';

function loadStoredColumns(exportKey: ExportKey): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + exportKey);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function saveColumns(exportKey: ExportKey, columns: string[]) {
  try {
    localStorage.setItem(STORAGE_PREFIX + exportKey, JSON.stringify(columns));
  } catch {
    // non-critical
  }
}

// ── Component ───────────────────────────────────────────────────────────────
export function ExportColumnPickerModal({
  isOpen,
  onClose,
  exportKey,
  formats,
  hasFilterOption = false,
  isFiltered = false,
  onExport,
  exporting = false,
}: ExportColumnPickerModalProps) {
  const definitions = EXPORT_COLUMN_DEFINITIONS[exportKey];
  const defaultKeys = definitions.filter((c) => c.default).map((c) => c.key);

  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => {
    return loadStoredColumns(exportKey) ?? defaultKeys;
  });
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(formats[0]);
  const [useFiltered, setUseFiltered] = useState(isFiltered);

  useEffect(() => {
    if (isOpen) {
      setSelectedColumns(loadStoredColumns(exportKey) ?? defaultKeys);
      setSelectedFormat(formats[0]);
      setUseFiltered(isFiltered);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, exportKey]);

  if (!isOpen) return null;

  const toggleColumn = (key: string) => {
    const col = definitions.find((c) => c.key === key);
    if (col?.required) return;
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectAll = () => setSelectedColumns(definitions.map((c) => c.key));
  const deselectAll = () => {
    const required = definitions.filter((c) => c.required).map((c) => c.key);
    setSelectedColumns(required);
  };
  const resetDefaults = () => setSelectedColumns(defaultKeys);

  const handleExport = () => {
    saveColumns(exportKey, selectedColumns);
    onExport(selectedFormat, selectedColumns, useFiltered);
  };

  const allSelected = selectedColumns.length === definitions.length;
  const isDefault =
    JSON.stringify([...selectedColumns].sort()) === JSON.stringify([...defaultKeys].sort());

  const formatLabels: Record<ExportFormat, { icon: string; color: string }> = {
    pdf:  { icon: '📄', color: '#EF4444' },
    csv:  { icon: '📊', color: '#16A34A' },
    xlsx: { icon: '📗', color: '#0EA5E9' },
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: 'var(--n-surface)',
          boxShadow: '10px 10px 30px var(--n-shadow-dark), -5px -5px 15px var(--n-shadow-light)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--n-divider)', background: 'var(--n-surface-raised)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--n-accent-glow)', boxShadow: '2px 2px 6px var(--n-shadow-dark-sm)' }}
            >
              <HiDocumentDownload className="w-5 h-5" style={{ color: 'var(--n-accent)' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--n-text)' }}>Customize Export</h3>
              <p className="text-xs" style={{ color: 'var(--n-text-dim)' }}>Select columns, format &amp; data scope</p>
            </div>
          </div>
          <button onClick={onClose} className="neu-btn-icon">
            <HiX className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* ── Format selector ── */}
          {formats.length > 1 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--n-text-dim)' }}>
                Export Format
              </p>
              <div className="flex gap-2">
                {formats.map((fmt) => {
                  const active = selectedFormat === fmt;
                  return (
                    <button
                      key={fmt}
                      onClick={() => setSelectedFormat(fmt)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all"
                      style={{
                        background: active ? 'var(--n-accent)' : 'var(--n-inset)',
                        color: active ? '#fff' : 'var(--n-text-secondary)',
                        boxShadow: active
                          ? `0 2px 10px var(--n-accent-glow)`
                          : 'inset 2px 2px 5px var(--n-shadow-dark-sm), inset -2px -2px 5px var(--n-shadow-light-sm)',
                      }}
                    >
                      <span style={{ fontSize: '1rem' }}>{formatLabels[fmt].icon}</span>
                      <span>{fmt.toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Data scope ── */}
          {hasFilterOption && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--n-text-dim)' }}>
                Data Scope
              </p>
              <div className="flex gap-2">
                {([
                  { value: false, label: '🗂️  All Records' },
                  { value: true,  label: '🔍  Filtered Records' },
                ] as const).map(({ value, label }) => {
                  const active = useFiltered === value;
                  return (
                    <button
                      key={String(value)}
                      onClick={() => setUseFiltered(value)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all"
                      style={{
                        background: active ? '#1B3A5C' : 'var(--n-inset)',
                        color: active ? '#fff' : 'var(--n-text-secondary)',
                        boxShadow: active
                          ? '0 2px 10px rgba(27,58,92,0.35)'
                          : 'inset 2px 2px 5px var(--n-shadow-dark-sm), inset -2px -2px 5px var(--n-shadow-light-sm)',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Column picker ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-text-dim)' }}>
                Columns
                <span
                  className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: 'var(--n-accent-glow)', color: 'var(--n-accent)' }}
                >
                  {selectedColumns.length} / {definitions.length}
                </span>
              </p>
              <div className="flex items-center gap-1.5">
                {!isDefault && (
                  <button
                    onClick={resetDefaults}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg font-medium transition-colors"
                    style={{ color: 'var(--n-accent)', background: 'var(--n-accent-glow)' }}
                  >
                    <HiRefresh className="w-3 h-3" /> Reset defaults
                  </button>
                )}
                <button
                  onClick={allSelected ? deselectAll : selectAll}
                  className="text-[11px] px-2 py-1 rounded-lg font-medium transition-colors"
                  style={{ color: 'var(--n-text-secondary)', background: 'var(--n-inset)', boxShadow: '1px 1px 3px var(--n-shadow-dark-sm)' }}
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>

            <div
              className="rounded-xl p-2 grid grid-cols-2 gap-1"
              style={{
                background: 'var(--n-inset)',
                boxShadow: 'inset 3px 3px 7px var(--n-shadow-dark-sm), inset -3px -3px 7px var(--n-shadow-light-sm)',
                maxHeight: '260px',
                overflowY: 'auto',
              }}
            >
              {definitions.map((col) => {
                const checked = selectedColumns.includes(col.key);
                return (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all select-none"
                    style={{
                      background: checked ? 'var(--n-surface)' : 'transparent',
                      boxShadow: checked
                        ? '2px 2px 5px var(--n-shadow-dark-sm), -1px -1px 3px var(--n-shadow-light-sm)'
                        : 'none',
                      cursor: col.required ? 'default' : 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!!col.required}
                      onChange={() => toggleColumn(col.key)}
                      className="w-3.5 h-3.5 rounded cursor-pointer"
                      style={{ accentColor: 'var(--n-accent)' }}
                    />
                    <span
                      className="text-xs font-medium truncate flex-1"
                      style={{ color: checked ? 'var(--n-text)' : 'var(--n-text-secondary)' }}
                    >
                      {col.label}
                    </span>
                    {col.default && !col.required && (
                      <span
                        className="text-[9px] shrink-0 px-1.5 py-0.5 rounded-full font-semibold"
                        style={{
                          background: checked ? 'var(--n-accent-glow)' : 'transparent',
                          color: checked ? 'var(--n-accent)' : 'var(--n-text-dim)',
                        }}
                      >
                        default
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {selectedColumns.length === 0 && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--n-danger)' }}>
                Select at least one column to export.
              </p>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderTop: '1px solid var(--n-divider)', background: 'var(--n-surface-raised)' }}
        >
          <p className="text-xs" style={{ color: 'var(--n-text-dim)' }}>
            Column preferences are saved per export type.
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="neu-btn neu-btn-secondary neu-btn-sm">
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || selectedColumns.length === 0}
              className="neu-btn neu-btn-primary neu-btn-sm"
            >
              {exporting ? (
                <>
                  <span className="neu-spinner neu-spinner-sm" style={{ marginRight: '0.5rem' }} />
                  Exporting…
                </>
              ) : (
                <>
                  <HiDocumentDownload className="w-3.5 h-3.5" style={{ marginRight: '0.375rem' }} />
                  Export {formats.length === 1 ? formats[0].toUpperCase() : selectedFormat.toUpperCase()}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
