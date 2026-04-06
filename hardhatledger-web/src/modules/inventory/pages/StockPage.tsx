import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Spinner } from '../../../components/ui/Spinner';
import { AdjustStockModal } from '../components/AdjustStockModal';
import { HiSearch, HiAdjustments, HiExclamation, HiChevronLeft, HiChevronRight, HiRefresh } from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { Product } from '../../../types';

type FilterMode = 'all' | 'low' | 'ok';

export function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, per_page: 20, total: 0 });
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [lowCount, setLowCount] = useState(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStock = useCallback((p: number, q: string, mode: FilterMode) => {
    setLoading(true);
    const params: Record<string, unknown> = { page: p, per_page: 20 };
    if (q) params.search = q;
    if (mode === 'low') params.low_stock = 1;

    api.get('/inventory', { params })
      .then((res) => {
        const data: Product[] = res.data.data;
        setProducts(data);
        setMeta(res.data.meta);
        // count low-stock among all results when not already filtering
        if (mode !== 'low') {
          const low = data.filter((pr) => (pr.stock?.quantity_on_hand ?? 0) <= pr.reorder_level).length;
          setLowCount(low);
        }
      })
      .catch(() => toast.error('Failed to load stock'))
      .finally(() => setLoading(false));
  }, []);

  // Initial load
  useEffect(() => { fetchStock(1, '', 'all'); }, [fetchStock]);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchStock(1, search, filterMode);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // Filter mode change
  useEffect(() => {
    setPage(1);
    fetchStock(1, search, filterMode);
  }, [filterMode]);

  // Page change
  useEffect(() => {
    fetchStock(page, search, filterMode);
  }, [page]);

  const handleAdjusted = (updated: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, stock: updated.stock } : p)));
    setAdjustProduct(null);
    // Refresh to get accurate counts
    fetchStock(page, search, filterMode);
  };

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

  const filterTabs: { key: FilterMode; label: string }[] = [
    { key: 'all', label: 'All Products' },
    { key: 'low', label: `Low Stock${lowCount > 0 ? ` (${lowCount})` : ''}` },
    { key: 'ok', label: 'OK' },
  ];

  const displayedProducts = filterMode === 'ok'
    ? products.filter((p) => (p.stock?.quantity_on_hand ?? 0) > p.reorder_level)
    : products;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-dark">Stock Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{meta.total} products tracked</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchStock(page, search, filterMode)}
        >
          <HiRefresh className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Low-stock banner */}
      {lowCount > 0 && filterMode !== 'low' && (
        <div
          className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 cursor-pointer hover:bg-red-100 transition-colors"
          onClick={() => setFilterMode('low')}
        >
          <HiExclamation className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            {lowCount} product{lowCount > 1 ? 's are' : ' is'} below reorder level.
            <span className="underline ml-1">View low-stock items</span>
          </p>
        </div>
      )}

      {/* Filters card */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <HiSearch className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
            <input
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              placeholder="Search by name or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterMode(tab.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filterMode === tab.key
                    ? 'bg-white text-navy-dark shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400">No products found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Product</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">SKU</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Category</th>
                  <th className="text-center px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">On Hand</th>
                  <th className="text-center px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Reserved</th>
                  <th className="text-center px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Available</th>
                  <th className="text-center px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Reorder At</th>
                  <th className="text-center px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-center px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedProducts.map((p) => {
                  const onHand = p.stock?.quantity_on_hand ?? 0;
                  const reserved = p.stock?.quantity_reserved ?? 0;
                  const available = p.stock?.available_quantity ?? 0;
                  const isLow = onHand <= p.reorder_level;
                  const isCritical = onHand === 0;
                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        isCritical ? 'bg-red-50 hover:bg-red-100' :
                        isLow ? 'bg-amber-50 hover:bg-amber-100' :
                        'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-5 py-3 font-medium text-navy-dark">{p.name}</td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{p.category?.name ?? '—'}</td>
                      <td className={`px-5 py-3 text-center font-bold text-base ${isCritical ? 'text-red-600' : isLow ? 'text-amber-dark' : 'text-navy-dark'}`}>
                        {onHand}
                      </td>
                      <td className="px-5 py-3 text-center text-gray-500">{reserved}</td>
                      <td className="px-5 py-3 text-center font-semibold text-gray-700">{available}</td>
                      <td className="px-5 py-3 text-center text-gray-500">{p.reorder_level}</td>
                      <td className="px-5 py-3 text-center">
                        {isCritical ? (
                          <Badge variant="danger">Out of Stock</Badge>
                        ) : isLow ? (
                          <Badge variant="warning">Low Stock</Badge>
                        ) : (
                          <Badge variant="success">OK</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => setAdjustProduct(p)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-navy border border-navy/30 rounded-lg hover:bg-navy hover:text-white transition-colors"
                        >
                          <HiAdjustments className="w-3.5 h-3.5" />
                          Adjust
                        </button>
                      </td>
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

      {/* Adjust Stock Modal */}
      {adjustProduct && (
        <AdjustStockModal
          product={adjustProduct}
          onClose={() => setAdjustProduct(null)}
          onSuccess={handleAdjusted}
        />
      )}
    </div>
  );
}
