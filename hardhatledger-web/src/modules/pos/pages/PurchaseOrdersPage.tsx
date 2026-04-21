import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import {
  HiPlus, HiEye, HiTrash, HiSearch, HiX, HiChevronLeft, HiChevronRight,
  HiDocumentText, HiCheckCircle, HiExclamation, HiClipboardCheck, HiDownload,
  HiBan, HiDocumentDownload, HiTable,
} from 'react-icons/hi';
import { ExportColumnPickerModal } from '../../../components/ui/ExportColumnPickerModal';
import type { ExportFormat } from '../../../components/ui/ExportColumnPickerModal';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { PurchaseOrder, PurchaseOrderItem, Supplier, Product } from '../../../types';
import dayjs from 'dayjs';
import { CreatePOModal, PODetailModal, CancelPOModal } from '../components/POModals';

/* ─── helpers ──────────────────────────────────────────────────────────────── */

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  draft: 'neutral', sent: 'info', partial: 'warning', received: 'success', cancelled: 'danger',
};
const STATUS_TABS = ['all', 'draft', 'sent', 'partial', 'received', 'cancelled'] as const;

const fmt = (n: number) => new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const getPageNumbers = (current: number, total: number): (number | null)[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const range: (number | null)[] = [1];
  const lo = Math.max(2, current - 1);
  const hi = Math.min(total - 1, current + 1);
  if (lo > 2) range.push(null);
  for (let i = lo; i <= hi; i++) range.push(i);
  if (hi < total - 1) range.push(null);
  range.push(total);
  return range;
};

/* ─── draft-item type for the create form ──────────────────────────────────── */

interface DraftItem { product_id: number | ''; quantity_ordered: number; unit_cost: number; }

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Main Page                                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function PurchaseOrdersPage() {
  /* ── list state ── */
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 20 });

  /* ── master data ── */
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  /* ── modals ── */
  const [createOpen, setCreateOpen] = useState(false);
  const [detailPO, setDetailPO] = useState<PurchaseOrder | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [cancelPO, setCancelPO] = useState<PurchaseOrder | null>(null);
  const [downloadingCsvId, setDownloadingCsvId] = useState<number | null>(null);
  const [exportingList, setExportingList] = useState(false);
  const [exportPickerOpen, setExportPickerOpen] = useState(false);

  /* load master data once */
  useEffect(() => {
    api.get('/suppliers', { params: { per_page: 200 } }).then((r) => setSuppliers(r.data.data));
    api.get('/products', { params: { per_page: 500, is_active: 1 } }).then((r) => setProducts(r.data.data));
  }, []);

  /* ── fetch list ── */
  const fetchPOs = useCallback(() => {
    setLoading(true);
    const params: Record<string, unknown> = { per_page: 20, page };
    if (statusFilter !== 'all') params.status = statusFilter;
    if (supplierFilter) params.supplier_id = supplierFilter;
    if (search.trim()) params.search = search.trim();
    api.get('/purchase-orders', { params })
      .then((r) => {
        setPOs(r.data.data);
        if (r.data.meta) setMeta(r.data.meta);
      })
      .finally(() => setLoading(false));
  }, [statusFilter, supplierFilter, search, page]);

  useEffect(() => {
    fetchPOs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, supplierFilter, search, page]);

  /* ── debounced search ── */
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const openDetail = async (po: PurchaseOrder) => {
    try {
      const r = await api.get(`/purchase-orders/${po.id}`);
      setDetailPO(r.data.data);
    } catch { toast.error('Failed to load PO details'); }
  };

  const handleDownloadPdf = async (po: PurchaseOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingId(po.id);
    try {
      const r = await api.get(`/purchase-orders/${po.id}`);
      downloadPOPdf(r.data.data);
    } catch { toast.error('Failed to download PDF'); }
    finally { setDownloadingId(null); }
  };

  const handleDownloadCsv = async (po: PurchaseOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingCsvId(po.id);
    try {
      const r = await api.get(`/purchase-orders/${po.id}`);
      downloadPOCsv(r.data.data);
    } catch { toast.error('Failed to download CSV'); }
    finally { setDownloadingCsvId(null); }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.setAttribute('download', filename);
    document.body.appendChild(link); link.click();
    link.remove(); window.URL.revokeObjectURL(url);
  };

  const buildListParams = (filtered: boolean): Record<string, unknown> => {
    if (!filtered) return {};
    const params: Record<string, unknown> = {};
    if (statusFilter !== 'all') params.status = statusFilter;
    if (supplierFilter) params.supplier_id = supplierFilter;
    if (search.trim()) params.search = search.trim();
    return params;
  };

  const handleExportList = async (format: ExportFormat, columns: string[], filtered: boolean) => {
    setExportPickerOpen(false);
    setExportingList(true);
    try {
      const params = { ...buildListParams(filtered), columns };
      const suffix = filtered ? `-filtered-${dayjs().format('YYYY-MM-DD')}` : `-all-${dayjs().format('YYYY-MM-DD')}`;
      if (format === 'pdf') {
        const response = await api.get('/purchase-orders/export/pdf', { params, responseType: 'blob' });
        downloadBlob(new Blob([response.data]), `purchase-orders${suffix}.pdf`);
      } else {
        const response = await api.get('/purchase-orders/export/csv', { params, responseType: 'blob' });
        downloadBlob(new Blob([response.data], { type: 'text/csv' }), `purchase-orders${suffix}.csv`);
      }
      toast.success(`${filtered ? 'Filtered' : 'All'} purchase orders exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Failed to export');
    } finally {
      setExportingList(false);
    }
  };

  const hasActiveFilters = statusFilter !== 'all' || supplierFilter !== '' || searchInput !== '';
  const clearFilters = () => {
    setStatusFilter('all'); setSupplierFilter(''); setSearchInput(''); setSearch(''); setPage(1);
  };

  /* ── status summary cards ── */
  const statusCounts: Record<string, number> = {};
  // We rely on the paginated total, but also show live list counts for context
  pos.forEach((p) => { statusCounts[p.status] = (statusCounts[p.status] || 0) + 1; });

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="neu-page-title">Purchase Orders</h1>
          <p className="text-sm text-[var(--n-text-secondary)] mt-0.5">{meta.total} total orders</p>
        </div>
        <div className="flex items-center gap-2">
          {/* ── Export ── */}
          <Button variant="secondary" onClick={() => setExportPickerOpen(true)} loading={exportingList}>
            <HiDocumentDownload className="w-4 h-4 mr-1" />
            Export
          </Button>
          <Button variant="amber" onClick={() => setCreateOpen(true)}>
            <HiPlus className="w-4 h-4 mr-2" /> New Purchase Order
          </Button>
        </div>
      </div>

      {/* ── Summary Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Draft', key: 'draft', icon: HiDocumentText, color: 'text-[var(--n-text-secondary)]', bg: 'bg-[var(--n-input-bg)]' },
          { label: 'Sent', key: 'sent', icon: HiDocumentText, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Partial', key: 'partial', icon: HiExclamation, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Received', key: 'received', icon: HiCheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Cancelled', key: 'cancelled', icon: HiX, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(({ label, key, icon: Icon, color, bg }) => (
          <button
            key={key}
            onClick={() => { setStatusFilter(statusFilter === key ? 'all' : key); setPage(1); }}
            className={`rounded-xl border p-3 text-left transition-all ${
              statusFilter === key
                ? 'border-navy/30 ring-2 ring-navy/10 shadow-sm'
                : 'border-[var(--n-divider)] hover:border-[var(--n-divider)] hover:shadow-sm'
            } bg-[var(--n-surface)]`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </span>
              <span className="text-xs font-medium text-[var(--n-text-secondary)] uppercase tracking-wide">{label}</span>
            </div>
            <p className={`text-lg font-bold ${color}`}>{statusCounts[key] || 0}</p>
          </button>
        ))}
      </div>

      {/* ── Filters Card ───────────────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-50">
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Search</label>
            <div className="relative">
              <HiSearch className="absolute left-3 top-2.5 text-[var(--n-text-dim)] w-4 h-4" />
              <input
                className="neu-inline-input w-full" style={{ paddingLeft: "2.25rem" }}
                placeholder="PO number, supplier..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>

          {/* Status filter */}
          <div className="w-40">
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Status</label>
            <Select
              inline
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              options={[{ value: 'all', label: 'All Statuses' }, ...STATUS_TABS.slice(1).map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))]}
            />
          </div>

          {/* Supplier filter */}
          <div className="w-48">
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Supplier</label>
            <Select
              inline
              value={supplierFilter}
              onChange={(e) => { setSupplierFilter(e.target.value ? Number(e.target.value) : ''); setPage(1); }}
              options={[{ value: '', label: 'All Suppliers' }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </div>

          {/* Clear */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <HiX className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </Card>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
        ) : pos.length === 0 ? (
          <div className="py-16 text-center">
            <HiDocumentText className="w-12 h-12 text-[var(--n-text-dim)] mx-auto mb-3" />
            <p className="text-[var(--n-text-dim)] font-medium">No purchase orders found</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-2 text-sm text-navy hover:underline">Clear filters</button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="neu-table">
                <thead className="">
                  <tr>
                    <th >PO #</th>
                    <th >Supplier</th>
                    <th className="text-center px-4 py-3 font-medium text-[var(--n-text-secondary)]">Status</th>
                    <th className="text-center px-4 py-3 font-medium text-[var(--n-text-secondary)]">Items</th>
                    <th className="text-right">Total</th>
                    <th >Expected</th>
                    <th >Created</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody >
                  {pos.map((po) => (
                    <tr
                      key={po.id}
                      className="hover:bg-[var(--n-input-bg)] transition-colors cursor-pointer"
                      onClick={() => openDetail(po)}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--n-text)]">{po.po_number}</td>
                      <td className="font-medium">{po.supplier?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={STATUS_VARIANT[po.status] ?? 'neutral'}>{po.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-[var(--n-text-secondary)]">{po.items?.length ?? '—'}</td>
                  <td className="text-right font-semibold">
                        <span>₱{fmt(po.total_amount)}</span>
                        {po.status === 'cancelled' && po.received_total !== null && po.cancelled_total !== null && (
                          <div className="text-xs font-normal mt-0.5 space-y-0.5">
                            <div className="text-green-600">Recv: ₱{fmt(po.received_total)}</div>
                            <div className="text-red-500">Cancelled: ₱{fmt(po.cancelled_total)}</div>
                          </div>
                        )}
                      </td>
                      <td style={{ color: "var(--n-text-secondary)" }}>
                        {po.expected_date ? dayjs(po.expected_date).format('MMM D, YYYY') : '—'}
                      </td>
                      <td style={{ color: "var(--n-text-secondary)" }}>{dayjs(po.created_at).format('MMM D, YYYY')}</td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openDetail(po)}
                            className="p-1.5 hover:bg-blue-50 rounded text-blue-600 transition-colors"
                            title="View details"
                          >
                            <HiEye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDownloadPdf(po, e)}
                            disabled={downloadingId === po.id}
                            className="p-1.5 hover:bg-green-50 rounded text-green-600 transition-colors disabled:opacity-50"
                            title="Download PDF"
                          >
                            <HiDownload className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDownloadCsv(po, e)}
                            disabled={downloadingCsvId === po.id}
                            className="p-1.5 hover:bg-teal-50 rounded text-teal-600 transition-colors disabled:opacity-50"
                            title="Download CSV"
                          >
                            <HiTable className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {meta.last_page > 1 && (
              <div className="neu-pagination">
                <p className="neu-pagination-info">
                  Showing {pos.length > 0 ? (meta.current_page - 1) * meta.per_page + 1 : 0} to{' '}
                  {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total} orders
                </p>
                <div className="neu-pagination-buttons">
                  <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="neu-pagination-btn">
                    <HiChevronLeft className="w-4 h-4" />
                  </button>
                  {getPageNumbers(page, meta.last_page).map((p, i) =>
                    p === null ? (
                      <span key={`dots-${i}`} className="neu-pagination-dots">…</span>
                    ) : (
                      <button key={p} onClick={() => setPage(p)} className={`neu-pagination-btn ${page === p ? 'active' : ''}`}>{p}</button>
                    )
                  )}
                  <button onClick={() => setPage(Math.min(meta.last_page, page + 1))} disabled={page === meta.last_page} className="neu-pagination-btn">
                    <HiChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <CreatePOModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        suppliers={suppliers}
        products={products}
        onCreated={() => { setCreateOpen(false); fetchPOs(); }}
      />

      {detailPO && (
        <PODetailModal
          po={detailPO}
          isOpen={!!detailPO}
          onClose={() => setDetailPO(null)}
          onUpdated={(updated) => { setDetailPO(updated); fetchPOs(); }}
          onRequestCancel={(po) => { setDetailPO(null); setCancelPO(po); }}
        />
      )}

      {cancelPO && (
        <CancelPOModal
          po={cancelPO}
          isOpen={!!cancelPO}
          onClose={() => setCancelPO(null)}
          onCancelled={(updated) => { setCancelPO(null); setDetailPO(updated); fetchPOs(); }}
        />
      )}

      {/* Export Column Picker */}
      <ExportColumnPickerModal
        isOpen={exportPickerOpen}
        onClose={() => setExportPickerOpen(false)}
        exportKey="purchase-orders"
        formats={['pdf', 'csv']}
        hasFilterOption
        isFiltered={hasActiveFilters}
        onExport={handleExportList}
        exporting={exportingList}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
