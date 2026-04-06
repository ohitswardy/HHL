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
          <h1 className="neu-page-title">Stock Management</h1>
          <p className="text-sm text-[var(--n-text-secondary)] mt-0.5">{meta.total} products tracked</p>
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
          className="neu-banner-danger"
          onClick={() => setFilterMode('low')}
          style={{ cursor: 'pointer' }}
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
            <HiSearch className="absolute left-3 top-2.5 text-[var(--n-text-dim)] w-4 h-4" />
            <input
              className="neu-inline-input w-full" style={{ paddingLeft: "2.25rem" }}
              placeholder="Search by name or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 bg-[var(--n-inset)] rounded-lg p-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterMode(tab.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filterMode === tab.key
                    ? 'bg-[var(--n-surface)] text-[var(--n-text)] shadow-sm'
                    : 'text-[var(--n-text-secondary)] hover:text-[var(--n-text)]'
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
            <p className="text-[var(--n-text-dim)]">No products found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="neu-table">
              <thead>
                <tr className="">
                  <th className="text-left px-5 py-3 font-semibold text-[var(--n-text-secondary)] text-xs uppercase tracking-wide">Product</th>
                  <th className="text-left px-5 py-3 font-semibold text-[var(--n-text-secondary)] text-xs uppercase tracking-wide">SKU</th>
                  <th className="text-left px-5 py-3 font-semibold text-[var(--n-text-secondary)] text-xs uppercase tracking-wide">Category</th>
                  <th className="text-center px-5 py-3 font-semibold text-[var(--n-text-secondary)] text-xs uppercase tracking-wide">On Hand</th>
                  <th className="text-center px-5 py-3 font-semibold text-[var(--n-text-secondary)] text-xs uppercase tracking-wide">Reserved</th>
                  <th className="text-center px-5 py-3 font-semibold text-[var(--n-text-secondary)] text-xs uppercase tracking-wide">Available</th>
                  <th className="text-center px-5 py-3 font-semibold text-[var(--n-text-secondary)] text-xs uppercase tracking-wide">Reorder At</th>
                  <th className="text-center px-5 py-3 font-semibold text-[var(--n-text-secondary)] text-xs uppercase tracking-wide">Status</th>
                  <th className="text-center px-5 py-3 font-semibold text-[var(--n-text-secondary)] text-xs uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody>
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
                        isCritical ? 'bg-red-500/10 hover:bg-red-500/[0.16]' :
                        isLow ? 'bg-amber-500/[0.08] hover:bg-amber-500/[0.14]' :
                        'hover:bg-[var(--n-input-bg)]'
                      }`}
                    >
                      <td className="px-5 py-3 font-medium text-[var(--n-text)]">{p.name}</td>
                      <td className="px-5 py-3 font-mono text-xs text-[var(--n-text-secondary)]">{p.sku}</td>
                      <td className="px-5 py-3 text-[var(--n-text-secondary)] text-xs">{p.category?.name ?? '—'}</td>
                      <td className={`px-5 py-3 text-center font-bold text-base ${isCritical ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-[var(--n-text)]'}`}>
                        {onHand}
                      </td>
                      <td className="px-5 py-3 text-center text-[var(--n-text-secondary)]">{reserved}</td>
                      <td className="px-5 py-3 text-center font-semibold text-[var(--n-text)]">{available}</td>
                      <td className="px-5 py-3 text-center text-[var(--n-text-secondary)]">{p.reorder_level}</td>
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
                          className="neu-btn neu-btn-secondary" style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
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
          <div className="neu-pagination">
            <p className="neu-pagination-info">
              {(meta.current_page - 1) * meta.per_page + 1}–{Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total}
            </p>
            <div className="neu-pagination-buttons">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="neu-pagination-btn">
                <HiChevronLeft className="w-4 h-4" />
              </button>
              {getPageNumbers(page, meta.last_page).map((n, i) =>
                n === null ? (
                  <span key={`e${i}`} className="neu-pagination-dots">…</span>
                ) : (
                  <button key={n} onClick={() => setPage(n)} className={`neu-pagination-btn ${page === n ? 'active' : ''}`}>{n}</button>
                )
              )}
              <button onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))} disabled={page === meta.last_page} className="neu-pagination-btn">
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
