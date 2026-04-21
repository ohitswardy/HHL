import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { DatePicker } from '../../../components/ui/DatePicker';
import { SearchBar } from '../../../components/ui/SearchBar';
import { Spinner } from '../../../components/ui/Spinner';
import { ExportColumnPickerModal } from '../../../components/ui/ExportColumnPickerModal';
import type { ExportFormat } from '../../../components/ui/ExportColumnPickerModal';
import { useDebounce } from '../../../lib/useDebounce';
import { HiChevronLeft, HiChevronRight, HiFilter, HiX, HiDocumentDownload } from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import type { InventoryMovement } from '../../../types';

type MovementType = '' | 'in' | 'out' | 'adjustment';

const TYPE_META: Record<string, { label: string; variant: 'success' | 'danger' | 'info' }> = {
  in:         { label: 'IN',         variant: 'success' },
  out:        { label: 'OUT',        variant: 'danger'  },
  adjustment: { label: 'ADJUSTMENT', variant: 'info'    },
};

const REF_LABELS: Record<string, string> = {
  sale:             'Sale',
  sale_void:        'Sale Void',
  purchase_receipt: 'Purchase',
  manual_adjustment:'Manual',
};

export function MovementsPage() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [filterType, setFilterType] = useState<MovementType>('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, per_page: 25, total: 0 });
  const [exporting, setExporting] = useState(false);
  const [exportPickerOpen, setExportPickerOpen] = useState(false);
  const exportRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const buildExportParams = (filtered: boolean): Record<string, string> => {
    if (!filtered) return {};
    const params: Record<string, string> = {};
    if (filterFrom) params.from = filterFrom;
    if (filterTo)   params.to   = filterTo;
    if (filterType) params.type = filterType;
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    return params;
  };

  const handleExport = async (format: ExportFormat, columns: string[], filtered: boolean) => {
    setExportPickerOpen(false);
    setExporting(true);
    try {
      const params = { ...buildExportParams(filtered), columns };
      const suffix = filtered ? `-filtered-${dayjs().format('YYYY-MM-DD')}` : `-all-${dayjs().format('YYYY-MM-DD')}`;
      if (format === 'pdf') {
        const res = await api.get('/inventory/movements/print', { params, responseType: 'blob' });
        downloadBlob(new Blob([res.data], { type: 'application/pdf' }), `inventory-movements${suffix}.pdf`);
      } else {
        const res = await api.get('/inventory/movements/export/csv', { params, responseType: 'blob' });
        downloadBlob(new Blob([res.data], { type: 'text/csv' }), `inventory-movements${suffix}.csv`);
      }
      toast.success(`${filtered ? 'Filtered' : 'All'} movements exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Failed to export');
    } finally {
      setExporting(false);
    }
  };

  const fetchMovements = useCallback((p: number, q: string, type: MovementType, from: string, to: string) => {
    setLoading(true);
    const params: Record<string, unknown> = { page: p, per_page: 25 };
    if (q) params.search = q;
    if (type) params.type = type;
    if (from) params.from = from;
    if (to) params.to = to;

    api.get('/inventory/movements', { params })
      .then((res) => { setMovements(res.data.data); setMeta(res.data.meta); })
      .catch(() => toast.error('Failed to load movements'))
      .finally(() => setLoading(false));
  }, []);

  // Initial load
  useEffect(() => { fetchMovements(1, '', '', '', ''); }, [fetchMovements]);

  // Debounced search
  useEffect(() => {
    setPage(1);
    fetchMovements(1, debouncedSearch, filterType, filterFrom, filterTo);
  }, [debouncedSearch]);

  // Other filter changes
  useEffect(() => {
    setPage(1);
    fetchMovements(1, search, filterType, filterFrom, filterTo);
  }, [filterType, filterFrom, filterTo]);

  // Page change
  useEffect(() => {
    fetchMovements(page, search, filterType, filterFrom, filterTo);
  }, [page]);

  const clearFilters = () => {
    setSearch('');
    setFilterType('');
    setFilterFrom('');
    setFilterTo('');
  };

  const hasActiveFilters = search || filterType || filterFrom || filterTo;

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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="neu-page-title">Inventory Movements</h1>
          <p className="text-sm text-[var(--n-text-secondary)] mt-0.5">Full audit trail of all stock changes</p>
        </div>

        <div className="shrink-0">
          <button
            onClick={() => setExportPickerOpen(true)}
            disabled={exporting}
            className="neu-btn neu-btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            {exporting ? <Spinner size="sm" /> : <HiDocumentDownload className="w-4 h-4" />}
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          {/* Search */}
          <div className="relative md:col-span-1">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search product…"
            />
          </div>

          {/* Type filter */}
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Movement Type</label>
            <div className="flex gap-1">
              {(['', 'in', 'out', 'adjustment'] as const).map((t) => (
                <button
                  key={t || 'all'}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-2 text-xs rounded-lg border font-medium transition-colors ${
                    filterType === t
                      ? 'neu-btn-primary'
                      : 'bg-[var(--n-surface)] text-[var(--n-text-secondary)] border-[var(--n-divider)] hover:border-[var(--n-accent)]/40'
                  }`}
                >
                  {t === '' ? 'All' : t === 'in' ? 'IN' : t === 'out' ? 'OUT' : 'ADJ'}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">From</label>
            <DatePicker
              inline
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">To</label>
            <div className="flex gap-2">
              <DatePicker
                inline
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="flex-1"
              />
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="p-2 border border-[var(--n-divider)] rounded-lg hover:bg-[var(--n-input-bg)] text-[var(--n-text-secondary)]"
                  title="Clear filters"
                >
                  <HiX className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[var(--n-divider)]">
            <span className="text-xs text-[var(--n-text-secondary)] flex items-center gap-1"><HiFilter className="w-3 h-3" /> Active filters:</span>
            {search && <span className="px-2 py-0.5 bg-[var(--n-info-glow)] text-navy text-xs rounded-full">"{search}"</span>}
            {filterType && <span className="px-2 py-0.5 bg-[var(--n-info-glow)] text-navy text-xs rounded-full">Type: {filterType.toUpperCase()}</span>}
            {filterFrom && <span className="px-2 py-0.5 bg-[var(--n-info-glow)] text-navy text-xs rounded-full">From: {filterFrom}</span>}
            {filterTo && <span className="px-2 py-0.5 bg-[var(--n-info-glow)] text-navy text-xs rounded-full">To: {filterTo}</span>}
          </div>
        )}
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : movements.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <p className="text-[var(--n-text-dim)]">No movements found</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-sm text-navy underline">Clear filters</button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="neu-table">
              <thead>
                <tr className="">
                  <th className="text-left px-5 py-3 font-semibold text-[var(--n-text-secondary)] text-xs uppercase tracking-wide whitespace-nowrap">Date & Time</th>
                  <th className="text-left px-5 py-3 font-semibold text-[var(--n-text-secondary)] text-xs uppercase tracking-wide">Product</th>
                  <th className="text-center px-5 py-3 font-semibold text-[var(--n-text-secondary)] text-xs uppercase tracking-wide">Type</th>
                  <th className="text-center px-5 py-3 font-semibold text-[var(--n-text-secondary)] text-xs uppercase tracking-wide">Qty</th>
                  <th className="text-right px-5 py-3 font-semibold text-[var(--n-text-secondary)] text-xs uppercase tracking-wide">Unit Cost</th>
                  <th className="text-left px-5 py-3 font-semibold text-[var(--n-text-secondary)] text-xs uppercase tracking-wide">Reference</th>
                  <th className="text-left px-5 py-3 font-semibold text-[var(--n-text-secondary)] text-xs uppercase tracking-wide">Notes</th>
                  <th className="text-left px-5 py-3 font-semibold text-[var(--n-text-secondary)] text-xs uppercase tracking-wide">User</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const typeMeta = TYPE_META[m.type] ?? { label: m.type.toUpperCase(), variant: 'neutral' as any };
                  const refLabel = REF_LABELS[m.reference_type ?? ''] ?? m.reference_type ?? '—';
                  return (
                    <tr key={m.id} className="hover:bg-[var(--n-input-bg)] transition-colors">
                      <td className="px-5 py-3 text-[var(--n-text-secondary)] text-xs whitespace-nowrap">
                        {dayjs(m.created_at).format('MMM D, YYYY h:mm A')}
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-[var(--n-text)]">{m.product?.name}</p>
                        <p className="text-xs text-[var(--n-text-dim)] font-mono">{m.product?.sku}</p>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Badge variant={typeMeta.variant}>{typeMeta.label}</Badge>
                      </td>
                      <td className={`px-5 py-3 text-center font-bold text-base ${
                        m.type === 'in' ? 'text-green-700' :
                        m.type === 'out' ? 'text-red-600' :
                        'text-blue-700'
                      }`}>
                        {m.type === 'in' ? '+' : m.type === 'out' ? '-' : '='}{m.quantity}
                      </td>
                      <td className="px-5 py-3 text-right text-[var(--n-text-secondary)] tabular-nums">
                        {m.unit_cost ? parseFloat(m.unit_cost as any).toFixed(2) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 bg-[var(--n-inset)] rounded-full text-[var(--n-text-secondary)]">{refLabel}</span>
                        {m.reference_id && (
                          <span className="text-xs text-[var(--n-text-dim)] ml-1">#{m.reference_id}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-[var(--n-text-secondary)] text-sm max-w-[180px]">
                        <span className="truncate block" title={m.notes ?? ''}>{m.notes || '—'}</span>
                      </td>
                      <td className="px-5 py-3 text-[var(--n-text-secondary)] text-sm whitespace-nowrap">{m.user?.name ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta.last_page > 1 && (
          <div className="neu-pagination">
            <p className="neu-pagination-info">
              {(meta.current_page - 1) * meta.per_page + 1}–{Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total}
            </p>
            <div className="neu-pagination-buttons">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="neu-pagination-btn"
              >
                <HiChevronLeft className="w-4 h-4" />
              </button>
              {getPageNumbers(page, meta.last_page).map((n, i) =>
                n === null ? (
                  <span key={`e${i}`} className="neu-pagination-dots">…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`neu-pagination-btn ${page === n ? 'active' : ''}`}
                  >
                    {n}
                  </button>
                )
              )}
              <button
                onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                disabled={page === meta.last_page}
                className="neu-pagination-btn"
              >
                <HiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Export Column Picker */}
      <ExportColumnPickerModal
        isOpen={exportPickerOpen}
        onClose={() => setExportPickerOpen(false)}
        exportKey="movements"
        formats={['pdf', 'csv']}
        hasFilterOption
        isFiltered={!!(filterFrom || filterTo || filterType || search.trim())}
        onExport={handleExport}
        exporting={exporting}
      />
    </div>
  );
}
