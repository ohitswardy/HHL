import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Spinner } from '../../../components/ui/Spinner';
import { HiSearch, HiChevronLeft, HiChevronRight, HiFilter, HiX, HiPrinter } from 'react-icons/hi';
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
  const [filterType, setFilterType] = useState<MovementType>('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, per_page: 25, total: 0 });
  const [printing, setPrinting] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canPrint = !!(filterFrom || filterTo);

  const handlePrint = async () => {
    if (!canPrint) return;
    setPrinting(true);
    try {
      const params: Record<string, string> = {};
      if (filterFrom) params.from = filterFrom;
      if (filterTo)   params.to   = filterTo;
      if (filterType) params.type = filterType;

      const res = await api.get('/inventory/movements/print', { params, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      const suffix = filterFrom ? `-${filterFrom}` : '';
      a.href = url;
      a.download = `inventory-movements${suffix}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setPrinting(false);
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
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchMovements(1, search, filterType, filterFrom, filterTo);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

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
          <h1 className="text-2xl font-bold text-navy-dark">Inventory Movements</h1>
          <p className="text-sm text-gray-500 mt-0.5">Full audit trail of all stock changes</p>
        </div>

        <div className="relative group shrink-0">
          <button
            onClick={handlePrint}
            disabled={!canPrint || printing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              canPrint
                ? 'bg-navy text-white hover:bg-navy-dark'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {printing ? (
              <Spinner size="sm" />
            ) : (
              <HiPrinter className="w-4 h-4" />
            )}
            Print Report
          </button>
          {/* Tooltip when dates not set */}
          {!canPrint && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              Select a From or To date to enable printing
              <div className="absolute -top-1.5 right-4 w-3 h-3 bg-gray-800 rotate-45" />
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          {/* Search */}
          <div className="relative md:col-span-1">
            <HiSearch className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
            <input
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              placeholder="Search product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Type filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Movement Type</label>
            <div className="flex gap-1">
              {(['', 'in', 'out', 'adjustment'] as const).map((t) => (
                <button
                  key={t || 'all'}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-2 text-xs rounded-lg border font-medium transition-colors ${
                    filterType === t
                      ? 'bg-navy text-white border-navy'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-navy/40'
                  }`}
                >
                  {t === '' ? 'All' : t === 'in' ? 'IN' : t === 'out' ? 'OUT' : 'ADJ'}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">From</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">To</label>
            <div className="flex gap-2">
              <input
                type="date"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
              />
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-500"
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
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500 flex items-center gap-1"><HiFilter className="w-3 h-3" /> Active filters:</span>
            {search && <span className="px-2 py-0.5 bg-navy/10 text-navy text-xs rounded-full">"{search}"</span>}
            {filterType && <span className="px-2 py-0.5 bg-navy/10 text-navy text-xs rounded-full">Type: {filterType.toUpperCase()}</span>}
            {filterFrom && <span className="px-2 py-0.5 bg-navy/10 text-navy text-xs rounded-full">From: {filterFrom}</span>}
            {filterTo && <span className="px-2 py-0.5 bg-navy/10 text-navy text-xs rounded-full">To: {filterTo}</span>}
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
            <p className="text-gray-400">No movements found</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-sm text-navy underline">Clear filters</button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide whitespace-nowrap">Date & Time</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Product</th>
                  <th className="text-center px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Type</th>
                  <th className="text-center px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Qty</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Unit Cost</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Reference</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Notes</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {movements.map((m) => {
                  const typeMeta = TYPE_META[m.type] ?? { label: m.type.toUpperCase(), variant: 'neutral' as any };
                  const refLabel = REF_LABELS[m.reference_type ?? ''] ?? m.reference_type ?? '—';
                  return (
                    <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {dayjs(m.created_at).format('MMM D, YYYY h:mm A')}
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-navy-dark">{m.product?.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{m.product?.sku}</p>
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
                      <td className="px-5 py-3 text-right text-gray-600 tabular-nums">
                        {m.unit_cost ? parseFloat(m.unit_cost as any).toFixed(2) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">{refLabel}</span>
                        {m.reference_id && (
                          <span className="text-xs text-gray-400 ml-1">#{m.reference_id}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-sm max-w-[180px]">
                        <span className="truncate block" title={m.notes ?? ''}>{m.notes || '—'}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-sm whitespace-nowrap">{m.user?.name ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta.last_page > 1 && (
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {(meta.current_page - 1) * meta.per_page + 1}–{Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <HiChevronLeft className="w-4 h-4" />
              </button>
              {getPageNumbers(page, meta.last_page).map((n, i) =>
                n === null ? (
                  <span key={`e${i}`} className="px-2 py-2 text-gray-400">…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium ${
                      page === n ? 'bg-navy text-white' : 'border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {n}
                  </button>
                )
              )}
              <button
                onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                disabled={page === meta.last_page}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <HiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
