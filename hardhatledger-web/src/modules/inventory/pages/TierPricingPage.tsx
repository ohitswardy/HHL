import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Spinner } from '../../../components/ui/Spinner';
import { HiSearch, HiSave, HiChevronLeft, HiChevronRight, HiInformationCircle, HiTag } from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { ClientTier, Category, Product } from '../../../types';

type PriceInputMap = { [productId: number]: { [tierId: number]: string } };
type DirtyMap = { [productId: number]: boolean };
type SavingMap = { [productId: number]: boolean };

export function TierPricingPage() {
  const [tiers, setTiers] = useState<ClientTier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 20 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(1);
  const [prices, setPrices] = useState<PriceInputMap>({});
  const [dirty, setDirty] = useState<DirtyMap>({});
  const [saving, setSaving] = useState<SavingMap>({});
  const [savingAll, setSavingAll] = useState(false);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, filterCategory]);

  // Load tiers + categories once
  useEffect(() => {
    api.get('/client-tiers').then((res) => setTiers(res.data.data));
    api.get('/categories').then((res) => setCategories(res.data.data));
  }, []);

  // Load products with tier prices
  useEffect(() => {
    setLoading(true);
    const params: Record<string, unknown> = { page, per_page: 20 };
    if (search) params.search = search;
    if (filterCategory) params.category_id = filterCategory;
    api.get('/products', { params })
      .then((res) => {
        const data: Product[] = res.data.data;
        setProducts(data);
        setMeta(res.data.meta);
        // Initialise price inputs from loaded tier_prices
        const init: PriceInputMap = {};
        data.forEach((p) => {
          init[p.id] = {};
          (p.tier_prices ?? []).forEach((tp) => {
            init[p.id][tp.client_tier_id] = String(tp.price);
          });
        });
        setPrices((prev) => ({ ...prev, ...init }));
        setDirty({});
      })
      .finally(() => setLoading(false));
  }, [page, search, filterCategory]);

  const handlePriceChange = (productId: number, tierId: number, value: string) => {
    setPrices((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], [tierId]: value },
    }));
    setDirty((prev) => ({ ...prev, [productId]: true }));
  };

  const buildPayload = (productId: number) =>
    tiers.map((t) => {
      const raw = prices[productId]?.[t.id];
      const parsed = raw !== undefined && raw !== '' ? parseFloat(raw) : null;
      return {
        client_tier_id: t.id,
        price: parsed !== null && !isNaN(parsed) ? parsed : null,
      };
    });

  const handleSaveRow = async (product: Product) => {
    setSaving((prev) => ({ ...prev, [product.id]: true }));
    try {
      await api.put(`/products/${product.id}/tier-prices`, { prices: buildPayload(product.id) });
      toast.success(`Prices saved for ${product.name}`);
      setDirty((prev) => ({ ...prev, [product.id]: false }));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save prices');
    } finally {
      setSaving((prev) => ({ ...prev, [product.id]: false }));
    }
  };

  const handleSaveAll = async () => {
    const dirtyProducts = products.filter((p) => dirty[p.id]);
    if (dirtyProducts.length === 0) return;
    setSavingAll(true);
    try {
      await Promise.all(
        dirtyProducts.map((p) =>
          api.put(`/products/${p.id}/tier-prices`, { prices: buildPayload(p.id) })
        )
      );
      toast.success(`Saved prices for ${dirtyProducts.length} product${dirtyProducts.length > 1 ? 's' : ''}`);
      setDirty({});
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Some saves failed');
    } finally {
      setSavingAll(false);
    }
  };

  const flatCategories = categories.flatMap((c: Category & { children?: Category[] }) => [c, ...(c.children || [])]);
  const dirtyCount = products.filter((p) => dirty[p.id]).length;

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
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-dark">Tier Pricing</h1>
          {!loading && (
            <p className="text-sm text-gray-500 mt-0.5">
              {meta.total} products · {tiers.length} pricing tiers
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dirtyCount > 0 && (
            <Button variant="amber" onClick={handleSaveAll} disabled={savingAll}>
              <HiSave className="w-4 h-4 mr-2" />
              {savingAll ? 'Saving…' : `Save All (${dirtyCount})`}
            </Button>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-navy/5 border border-navy/15 rounded-lg px-4 py-3 mb-4 text-sm text-navy-dark">
        <HiInformationCircle className="w-5 h-5 shrink-0 mt-0.5 text-navy" />
        <div>
          <strong>How it works:</strong> Set a price per tier for each product. When an encoder selects a client in POS, the system automatically applies the price matching that client's tier.
          Leave a cell <strong>blank</strong> to fall back to the product's base selling price.
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <HiSearch className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
            <input
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              placeholder="Search by name or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 bg-white text-gray-700"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {flatCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {(search || filterCategory) && (
            <button
              onClick={() => { setSearch(''); setFilterCategory(''); }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Tier legend */}
      {tiers.length > 0 && (
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Tiers:</span>
          {tiers.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-navy/10 text-navy rounded-full text-xs font-medium">
              <HiTag className="w-3 h-3 text-amber" />
              {t.name}
            </span>
          ))}
        </div>
      )}

      {/* Grid Table */}
      <Card>
        {loading ? (
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">SKU</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Category</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">Unit</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                    Base Price
                    <div className="text-xs font-normal text-gray-400">(fallback)</div>
                  </th>
                  {tiers.map((t) => (
                    <th key={t.id} className="text-center px-3 py-3 font-semibold text-navy whitespace-nowrap min-w-32">
                      <div className="flex flex-col items-center gap-0.5">
                        <span>{t.name}</span>
                        <span className="text-xs font-normal text-gray-400">price</span>
                      </div>
                    </th>
                  ))}
                  <th className="text-center px-4 py-3 font-medium text-gray-600 w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => {
                  const isRowDirty = dirty[p.id] ?? false;
                  const isRowSaving = saving[p.id] ?? false;
                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${isRowDirty ? 'bg-amber/5 hover:bg-amber/8' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-400 whitespace-nowrap">{p.sku}</td>
                      <td className="px-4 py-2.5 font-medium max-w-48">
                        <span className="truncate block" title={p.name}>{p.name}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{p.category?.name || '—'}</td>
                      <td className="px-3 py-2.5 text-center text-gray-500 text-xs">{p.unit}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400 text-xs font-mono whitespace-nowrap">
                        ₱{Number(p.base_selling_price).toFixed(2)}
                      </td>
                      {tiers.map((t) => {
                        const val = prices[p.id]?.[t.id] ?? '';
                        const hasPrice = val !== '';
                        return (
                          <td key={t.id} className="px-3 py-2.5 text-center">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={val}
                              onChange={(e) => handlePriceChange(p.id, t.id, e.target.value)}
                              placeholder={Number(p.base_selling_price).toFixed(2)}
                              className={`w-full min-w-28 px-2.5 py-1.5 border rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-navy/30 transition-all ${
                                hasPrice
                                  ? 'border-navy/30 bg-white font-semibold text-navy-dark'
                                  : 'border-gray-200 bg-gray-50 text-gray-400 focus:bg-white focus:text-gray-700 focus:border-navy/30'
                              }`}
                            />
                          </td>
                        );
                      })}
                      <td className="px-4 py-2.5 text-center">
                        {isRowDirty ? (
                          <button
                            onClick={() => handleSaveRow(p)}
                            disabled={isRowSaving}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-navy text-white rounded-lg text-xs font-medium hover:bg-navy/80 disabled:opacity-50 transition-colors whitespace-nowrap"
                          >
                            {isRowSaving ? (
                              <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin inline-block" />
                            ) : (
                              <HiSave className="w-3 h-3" />
                            )}
                            {isRowSaving ? 'Saving…' : 'Save'}
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs select-none">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {products.length === 0 && (
              <p className="text-center text-gray-400 py-12">
                No products found{(search || filterCategory) ? ' — try adjusting filters' : ''}
              </p>
            )}
          </div>
        )}

        {/* Pagination */}
        {meta.last_page > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-xs text-gray-500">
              Page {meta.current_page} of {meta.last_page} &nbsp;·&nbsp; {meta.total} products
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={meta.current_page === 1}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <HiChevronLeft className="w-4 h-4" />
              </button>
              {getPageNumbers(meta.current_page, meta.last_page).map((n, i) =>
                n === null ? (
                  <span key={`e-${i}`} className="px-1 text-gray-400 text-sm select-none">…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`min-w-8 h-8 px-2 rounded text-sm font-medium transition-colors ${
                      meta.current_page === n
                        ? 'bg-navy text-white'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {n}
                  </button>
                )
              )}
              <button
                onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                disabled={meta.current_page === meta.last_page}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
