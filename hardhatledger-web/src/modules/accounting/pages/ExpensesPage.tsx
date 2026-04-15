import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { DatePicker } from '../../../components/ui/DatePicker';
import {
  HiPlus, HiEye, HiSearch, HiX, HiChevronLeft, HiChevronRight,
  HiCurrencyDollar, HiCheckCircle, HiBan, HiFilter, HiRefresh,
  HiExclamation, HiDocumentText, HiDownload, HiDocumentDownload,
  HiChevronDown, HiTable,
} from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { Supplier } from '../../../types';
import dayjs from 'dayjs';

/* ─── types ───────────────────────────────────────────────────────────────── */

interface ExpenseCategory {
  id: number;
  name: string;
  account_code: string;
  description: string | null;
}

interface Expense {
  id: number;
  expense_number: string;
  date: string;
  reference_number: string | null;
  payee: string;
  supplier_id: number | null;
  supplier?: Supplier;
  expense_category_id: number;
  category?: { id: number; name: string; account_code: string };
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  payment_method: string;
  status: 'draft' | 'recorded' | 'voided';
  source: 'manual' | 'purchase_order';
  purchase_order_id: number | null;
  purchase_order?: { id: number; po_number: string; status: string } | null;
  user?: { id: number; name: string };
  created_at: string;
}

interface ExpenseSummary {
  total_expenses: number;
  total_subtotal: number;
  total_tax: number;
  expense_count: number;
  by_category: { category_id: number; category_name: string; total: number; count: number }[];
  top_payees: { payee: string; total: number; count: number }[];
}

/* ─── helpers ─────────────────────────────────────────────────────────────── */

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = {
  draft: 'warning',
  recorded: 'success',
  voided: 'danger',
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

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Main Page                                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function ExpensesPage() {
  /* ── list state ── */
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 20 });

  /* ── master data ── */
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [systemTaxRate, setSystemTaxRate] = useState<number>(12);

  /* ── modals ── */
  const [createOpen, setCreateOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  /* close dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* load master data once */
  useEffect(() => {
    api.get('/expenses/categories').then((r) => setCategories(r.data.data));
    api.get('/suppliers', { params: { per_page: 200 } }).then((r) => setSuppliers(r.data.data));
    api.get('/settings').then((r) => {
      const rate = parseFloat(r.data.data?.tax_rate?.value ?? '12');
      if (!isNaN(rate)) setSystemTaxRate(rate);
    });
  }, []);

  /* ── fetch list ── */
  const fetchExpenses = useCallback(() => {
    setLoading(true);
    const params: Record<string, unknown> = { per_page: 20, page };
    if (statusFilter !== 'all') params.status = statusFilter;
    if (categoryFilter) params.expense_category_id = categoryFilter;
    if (search.trim()) params.search = search.trim();
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    api.get('/expenses', { params })
      .then((r) => {
        setExpenses(r.data.data);
        if (r.data.meta) setMeta(r.data.meta);
      })
      .finally(() => setLoading(false));
  }, [statusFilter, categoryFilter, search, dateFrom, dateTo, page]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  /* ── debounced search ── */
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  /* ── open detail / edit ── */
  const openExpense = async (exp: Expense) => {
    try {
      const r = await api.get(`/expenses/${exp.id}`);
      const loaded: Expense = r.data.data;
      if (loaded.status === 'draft' || (loaded.source === 'purchase_order' && loaded.status === 'recorded')) {
        setEditExpense(loaded);
      } else {
        setDetailExpense(loaded);
      }
    } catch { toast.error('Failed to load expense details'); }
  };

  /* ── void expense ── */
  const handleVoid = async (exp: Expense) => {
    if (!confirm(`Void expense ${exp.expense_number}? This will reverse the journal entry.`)) return;
    try {
      await api.post(`/expenses/${exp.id}/void`);
      toast.success('Expense voided');
      fetchExpenses();
      setDetailExpense(null);
    } catch { toast.error('Failed to void expense'); }
  };

  /* ── sync from POs ── */
  const handleSyncFromPos = async () => {
    setSyncing(true);
    try {
      const r = await api.post('/expenses/sync-from-pos');
      const created: number   = r.data.created   ?? r.data.count ?? 0;
      const confirmed: number = r.data.confirmed ?? 0;

      if (created > 0 || confirmed > 0) {
        const parts: string[] = [];
        if (created > 0)   parts.push(`${created} draft(s) imported`);
        if (confirmed > 0) parts.push(`${confirmed} draft(s) auto-confirmed`);
        toast.success(parts.join(', ') + '.');
        fetchExpenses();
      } else {
        toast('No changes — all purchase orders are up to date.', { icon: 'ℹ️' });
      }
    } catch { toast.error('Sync failed'); }
    finally { setSyncing(false); }
  };

  /* ── export helpers ── */
  const buildExportParams = () => {
    const params: Record<string, unknown> = {};
    if (statusFilter !== 'all') params.status = statusFilter;
    if (categoryFilter) params.expense_category_id = categoryFilter;
    if (search.trim()) params.search = search.trim();
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    return params;
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async (type: 'pdf' | 'csv', filtered: boolean) => {
    setExportOpen(false);
    setExporting(type);
    try {
      const params = filtered ? buildExportParams() : {};
      const r = await api.get(`/expenses/export/${type}`, { params, responseType: 'blob' });
      const mimeType = type === 'pdf' ? 'application/pdf' : 'text/csv';
      const suffix = filtered ? `-filtered-${dayjs().format('YYYY-MM-DD')}` : `-all-${dayjs().format('YYYY-MM-DD')}`;
      downloadBlob(new Blob([r.data], { type: mimeType }), `expenses${suffix}.${type}`);
      toast.success(`${filtered ? 'Filtered' : 'All'} expenses exported as ${type.toUpperCase()}`);
    } catch {
      toast.error(`Failed to export ${type.toUpperCase()}`);
    } finally {
      setExporting(null);
    }
  };

  /* ── load summary ── */
  const loadSummary = async () => {
    const start = dateFrom || dayjs().startOf('month').format('YYYY-MM-DD');
    const end = dateTo || dayjs().format('YYYY-MM-DD');
    setSummaryLoading(true);
    setSummaryOpen(true);
    try {
      const r = await api.get('/expenses/summary', { params: { start_date: start, end_date: end } });
      setSummary(r.data);
    } catch { toast.error('Failed to load summary'); }
    finally { setSummaryLoading(false); }
  };

  const hasActiveFilters = statusFilter !== 'all' || categoryFilter !== '' || searchInput !== '' || dateFrom !== '' || dateTo !== '';
  const clearFilters = () => {
    setStatusFilter('all'); setCategoryFilter(''); setSearchInput(''); setSearch('');
    setDateFrom(''); setDateTo(''); setPage(1);
  };

  /* ── status counts ── */
  const draft = expenses.filter((e) => e.status === 'draft').length;
  const recorded = expenses.filter((e) => e.status === 'recorded').length;
  const voided = expenses.filter((e) => e.status === 'voided').length;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="neu-page-title">Expenses</h1>
          <p className="text-sm text-[var(--n-text-secondary)] mt-0.5">{meta.total} total expenses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadSummary}>
            <HiFilter className="w-4 h-4 mr-2" /> Summary
          </Button>
          <Button variant="secondary" onClick={handleSyncFromPos} disabled={syncing}>
            {syncing ? <Spinner size="sm" /> : <HiRefresh className="w-4 h-4 mr-2" />}
            Sync from POs
          </Button>
          {/* ── Export dropdown ── */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen((v) => !v)}
              disabled={!!exporting}
              className="neu-btn neu-btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
            >
              {exporting ? <Spinner size="sm" /> : <HiDocumentDownload className="w-4 h-4" />}
              Export
              <HiChevronDown className="w-3 h-3" />
            </button>
            {exportOpen && (
              <div className="neu-dropdown" style={{ right: 0, left: 'auto', minWidth: '15rem' }}>
                <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--n-text-dim)' }}>PDF</div>
                <button onClick={() => handleExport('pdf', false)} disabled={!!exporting} className="neu-dropdown-item">
                  <HiDocumentDownload className="w-4 h-4" /> All Expenses (PDF)
                </button>
                <button onClick={() => handleExport('pdf', true)} disabled={!!exporting} className="neu-dropdown-item">
                  <HiDocumentDownload className="w-4 h-4" /> Filtered Expenses (PDF)
                </button>
                <div className="border-t border-(--n-border) my-1" />
                <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--n-text-dim)' }}>CSV</div>
                <button onClick={() => handleExport('csv', false)} disabled={!!exporting} className="neu-dropdown-item">
                  <HiTable className="w-4 h-4" /> All Expenses (CSV)
                </button>
                <button onClick={() => handleExport('csv', true)} disabled={!!exporting} className="neu-dropdown-item">
                  <HiTable className="w-4 h-4" /> Filtered Expenses (CSV)
                </button>
              </div>
            )}
          </div>
          <Button variant="amber" onClick={() => setCreateOpen(true)}>
            <HiPlus className="w-4 h-4 mr-2" /> Record Expense
          </Button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'All Expenses', key: 'all', icon: HiCurrencyDollar, color: 'text-[var(--n-text)]', bg: 'bg-[var(--n-input-bg)]', count: expenses.length },
          { label: 'Needs Review', key: 'draft', icon: HiExclamation, color: 'text-amber-600', bg: 'bg-amber-50', count: draft },
          { label: 'Recorded', key: 'recorded', icon: HiCheckCircle, color: 'text-green-600', bg: 'bg-green-50', count: recorded },
          { label: 'Voided', key: 'voided', icon: HiBan, color: 'text-red-600', bg: 'bg-red-50', count: voided },
        ].map(({ label, key, icon: Icon, color, bg, count }) => (
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
            <p className={`text-lg font-bold ${color}`}>{count}</p>
          </button>
        ))}
      </div>

      {/* ── Filters Card ── */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-50">
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Search</label>
            <div className="relative">
              <HiSearch className="absolute left-3 top-2.5 text-[var(--n-text-dim)] w-4 h-4" />
              <input
                className="neu-inline-input w-full" style={{ paddingLeft: '2.25rem' }}
                placeholder="Payee, expense #, reference..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>

          <div className="w-44">
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Category</label>
            <Select
              inline
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value ? Number(e.target.value) : ''); setPage(1); }}
              options={[{ value: '', label: 'All Categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>

          <div className="w-36">
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">From</label>
            <DatePicker
              inline
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              placeholder="From"
              max={dateTo || undefined}
            />
          </div>

          <div className="w-36">
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">To</label>
            <DatePicker
              inline
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              placeholder="To"
              min={dateFrom || undefined}
            />
          </div>

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

      {/* ── Table ── */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
        ) : expenses.length === 0 ? (
          <div className="py-16 text-center">
            <HiCurrencyDollar className="w-12 h-12 text-[var(--n-text-dim)] mx-auto mb-3" />
            <p className="text-[var(--n-text-dim)] font-medium">No expenses found</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-2 text-sm text-navy hover:underline">Clear filters</button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="neu-table">
                <thead>
                  <tr>
                    <th>Expense #</th>
                    <th>Date</th>
                    <th>Payee</th>
                    <th>Category</th>
                    <th>Reference</th>
                    <th>Source</th>
                    <th className="text-right">Subtotal</th>
                    <th className="text-right">Tax</th>
                    <th className="text-right">Total</th>
                    <th className="text-center">Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr
                      key={exp.id}
                      className={`hover:bg-[var(--n-input-bg)] transition-colors cursor-pointer ${
                        exp.status === 'draft' ? 'bg-amber-50/40' : ''
                      }`}
                      onClick={() => openExpense(exp)}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--n-text)]">{exp.expense_number}</td>
                      <td style={{ color: 'var(--n-text-secondary)' }}>{dayjs(exp.date).format('MMM D, YYYY')}</td>
                      <td className="font-medium">{exp.payee}</td>
                      <td>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--n-input-bg)] text-[var(--n-text-secondary)]">
                          {exp.category?.name ?? '—'}
                        </span>
                      </td>
                      <td className="text-[var(--n-text-secondary)] text-xs font-mono">{exp.reference_number || '—'}</td>
                      <td>
                        {exp.source === 'purchase_order' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-navy/10 text-navy">
                            <HiDocumentText className="w-3 h-3" /> PO
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--n-text-dim)]">Manual</span>
                        )}
                      </td>
                      <td className="text-right text-[var(--n-text-secondary)]">₱{fmt(exp.subtotal)}</td>
                      <td className="text-right text-[var(--n-text-secondary)]">{exp.tax_amount > 0 ? `₱${fmt(exp.tax_amount)}` : '—'}</td>
                      <td className="text-right font-semibold">₱{fmt(exp.total_amount)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={STATUS_VARIANT[exp.status] ?? 'neutral'}>{exp.status}</Badge>
                      </td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openExpense(exp)}
                          className="p-1.5 hover:bg-blue-50 rounded text-blue-600 transition-colors"
                          title="View details"
                        >
                          <HiEye className="w-4 h-4" />
                        </button>
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
                  Showing {expenses.length > 0 ? (meta.current_page - 1) * meta.per_page + 1 : 0} to{' '}
                  {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total} expenses
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

      {/* ── Create Expense Modal ── */}
      {createOpen && (
        <ExpenseFormModal
          categories={categories}
          suppliers={suppliers}
          systemTaxRate={systemTaxRate}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); fetchExpenses(); }}
        />
      )}

      {/* ── Edit / Review Modal (draft or recorded PO-source) ── */}
      {editExpense && (
        <ExpenseFormModal
          expense={editExpense}
          categories={categories}
          suppliers={suppliers}
          systemTaxRate={systemTaxRate}
          onClose={() => setEditExpense(null)}
          onSaved={() => { setEditExpense(null); fetchExpenses(); }}
        />
      )}

      {/* ── Detail Modal (recorded manual) ── */}
      {detailExpense && (
        <ExpenseDetailModal
          expense={detailExpense}
          onClose={() => setDetailExpense(null)}
          onVoid={() => handleVoid(detailExpense)}
        />
      )}

      {/* ── Summary Modal ── */}
      {summaryOpen && (
        <Modal title="Expense Summary" isOpen={summaryOpen} onClose={() => setSummaryOpen(false)} width="lg">
          {summaryLoading ? (
            <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>
          ) : summary ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[var(--n-input-bg)]">
                  <p className="text-xs font-semibold text-[var(--n-text-secondary)] uppercase">Total Expenses</p>
                  <p className="text-xl font-bold text-[var(--n-text)] mt-1">₱{fmt(summary.total_expenses)}</p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--n-input-bg)]">
                  <p className="text-xs font-semibold text-[var(--n-text-secondary)] uppercase">Subtotal</p>
                  <p className="text-xl font-bold text-[var(--n-text)] mt-1">₱{fmt(summary.total_subtotal)}</p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--n-input-bg)]">
                  <p className="text-xs font-semibold text-[var(--n-text-secondary)] uppercase">Total Tax</p>
                  <p className="text-xl font-bold text-[var(--n-text)] mt-1">₱{fmt(summary.total_tax)}</p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--n-input-bg)]">
                  <p className="text-xs font-semibold text-[var(--n-text-secondary)] uppercase">Count</p>
                  <p className="text-xl font-bold text-[var(--n-text)] mt-1">{summary.expense_count}</p>
                </div>
              </div>

              {summary.by_category.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--n-text)] mb-2">By Category</h3>
                  <div className="space-y-2">
                    {summary.by_category.map((cat) => (
                      <div key={cat.category_id} className="flex items-center justify-between p-2 rounded-lg bg-[var(--n-input-bg)]">
                        <div>
                          <span className="text-sm font-medium">{cat.category_name}</span>
                          <span className="text-xs text-[var(--n-text-dim)] ml-2">({cat.count} entries)</span>
                        </div>
                        <span className="font-semibold">₱{fmt(cat.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summary.top_payees.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--n-text)] mb-2">Top Payees</h3>
                  <div className="space-y-2">
                    {summary.top_payees.map((p) => (
                      <div key={p.payee} className="flex items-center justify-between p-2 rounded-lg bg-[var(--n-input-bg)]">
                        <div>
                          <span className="text-sm font-medium">{p.payee}</span>
                          <span className="text-xs text-[var(--n-text-dim)] ml-2">({p.count} entries)</span>
                        </div>
                        <span className="font-semibold">₱{fmt(p.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Expense Form Modal (Create / Edit Draft / Edit Recorded PO-source)       */
/* ═══════════════════════════════════════════════════════════════════════════ */

function ExpenseFormModal({
  expense, categories, suppliers, systemTaxRate, onClose, onSaved,
}: {
  expense?: Expense | null;
  categories: ExpenseCategory[];
  suppliers: Supplier[];
  systemTaxRate: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!expense;
  const isDraft = expense?.status === 'draft';
  const isRecordedPO = expense?.source === 'purchase_order' && expense?.status === 'recorded';

  // Derive initial VAT checkbox state: if existing tax_amount > 0, it's VATable
  const initialIsVatable = expense ? (expense.tax_amount ?? 0) > 0 : false;

  const [form, setForm] = useState({
    date: expense?.date ?? dayjs().format('YYYY-MM-DD'),
    reference_number: expense?.reference_number ?? '',
    payee: expense?.payee ?? '',
    supplier_id: (expense?.supplier_id ?? '') as number | '',
    expense_category_id: (expense?.expense_category_id ?? '') as number | '',
    subtotal: expense?.subtotal?.toString() ?? '',
    notes: expense?.notes ?? '',
    payment_method: expense?.payment_method ?? 'cash',
    is_vatable: initialIsVatable,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const subtotalNum = parseFloat(form.subtotal) || 0;
  const taxAmount = form.is_vatable ? parseFloat((subtotalNum * (systemTaxRate / 100)).toFixed(2)) : 0;
  const computedTotal = subtotalNum + taxAmount;

  const handleSupplierChange = (supplierId: number | '') => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    setForm((f) => ({
      ...f,
      supplier_id: supplierId,
      payee: supplier ? supplier.name : f.payee,
    }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.date) errs.date = 'Date is required';
    if (!form.payee.trim()) errs.payee = 'Payee is required';
    if (!form.expense_category_id) errs.expense_category_id = 'Category is required';
    if (!form.subtotal || parseFloat(form.subtotal) <= 0) errs.subtotal = 'Subtotal must be greater than 0';
    return errs;
  };

  const buildPayload = () => ({
    date: form.date,
    reference_number: form.reference_number || null,
    payee: form.payee.trim(),
    supplier_id: form.supplier_id || null,
    expense_category_id: form.expense_category_id,
    subtotal: subtotalNum,
    tax_amount: taxAmount,
    total_amount: computedTotal,
    notes: form.notes || null,
    payment_method: form.payment_method,
  });

  const handleSaveDraft = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      await api.put(`/expenses/${expense!.id}`, buildPayload());
      toast.success('Draft saved');
      onSaved();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? 'Failed to save draft');
    } finally { setSubmitting(false); }
  };

  const handleConfirm = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      await api.post(`/expenses/${expense!.id}/confirm`, buildPayload());
      toast.success('Expense confirmed and recorded');
      onSaved();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? 'Failed to confirm expense');
    } finally { setSubmitting(false); }
  };

  const handleCreate = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      await api.post('/expenses', buildPayload());
      toast.success('Expense recorded');
      onSaved();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? 'Failed to record expense');
    } finally { setSubmitting(false); }
  };

  const handleSaveRecordedPO = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      await api.put(`/expenses/${expense!.id}`, buildPayload());
      toast.success('Expense updated');
      onSaved();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? 'Failed to update expense');
    } finally { setSubmitting(false); }
  };

  const title = isDraft
    ? `Review & Confirm — ${expense!.expense_number}`
    : isRecordedPO
    ? `Edit Expense — ${expense!.expense_number}`
    : isEdit
    ? `Edit Expense — ${expense!.expense_number}`
    : 'Record New Expense';

  return (
    <Modal title={title} isOpen onClose={onClose} width="lg">
      <div className="space-y-4">
        {/* PO context banner for draft PO-sourced expenses */}
        {isDraft && expense?.source === 'purchase_order' && (() => {
          const poStatus = expense.purchase_order?.status;
          const isPartialCancel = poStatus === 'cancelled';
          return (
            <div className={`flex items-start gap-3 p-3 rounded-xl border ${
              isPartialCancel
                ? 'bg-red-50 border-red-200'
                : 'bg-amber-50 border-amber-200'
            }`}>
              <HiExclamation className={`w-5 h-5 mt-0.5 shrink-0 ${
                isPartialCancel ? 'text-red-500' : 'text-amber-600'
              }`} />
              <div>
                <p className={`text-sm font-semibold ${
                  isPartialCancel ? 'text-red-800' : 'text-amber-800'
                }`}>Auto-imported from Purchase Order</p>
                <p className={`text-xs mt-0.5 ${
                  isPartialCancel ? 'text-red-700' : 'text-amber-700'
                }`}>
                  {isPartialCancel ? (
                    <>PO {expense.purchase_order?.po_number ?? expense.reference_number} was <strong>cancelled after partial receipt</strong>.
                    {' '}This expense reflects only the received portion. Review and confirm before recording.</>
                  ) : (
                    <>PO {expense.purchase_order?.po_number ?? expense.reference_number} was fully received.
                    {' '}Please review the VAT amount and category before confirming.</>
                  )}
                </p>
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Date *</label>
            <DatePicker
              inline
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              placeholder="Select date"
            />
            {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
          </div>

          {/* Reference Number */}
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Reference / Invoice No.</label>
            <Input
              value={form.reference_number}
              onChange={(e) => setForm((f) => ({ ...f, reference_number: e.target.value }))}
              placeholder="e.g. BI00140317"
            />
          </div>

          {/* Supplier (optional link) */}
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Supplier (optional)</label>
            <Select
              value={form.supplier_id}
              onChange={(e) => handleSupplierChange(e.target.value ? Number(e.target.value) : '')}
              options={[{ value: '', label: '— None —' }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </div>

          {/* Payee (free text) */}
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Payee *</label>
            <Input
              value={form.payee}
              onChange={(e) => setForm((f) => ({ ...f, payee: e.target.value }))}
              placeholder="Vendor / Supplier name"
            />
            {errors.payee && <p className="text-xs text-red-500 mt-1">{errors.payee}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Category *</label>
            <Select
              value={form.expense_category_id}
              onChange={(e) => setForm((f) => ({ ...f, expense_category_id: e.target.value ? Number(e.target.value) : '' }))}
              options={[{ value: '', label: 'Select category...' }, ...categories.map((c) => ({ value: c.id, label: `${c.name} (${c.account_code})` }))]}
            />
            {errors.expense_category_id && <p className="text-xs text-red-500 mt-1">{errors.expense_category_id}</p>}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Payment Method</label>
            <Select
              value={form.payment_method}
              onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'card', label: 'Card' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'check', label: 'Check' },
                { value: 'business_bank', label: 'Business Bank' },
              ]}
            />
          </div>

          {/* Subtotal */}
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Amount Before Tax *</label>
            <Input
              type="number" step="0.01" min="0"
              value={form.subtotal}
              onChange={(e) => setForm((f) => ({ ...f, subtotal: e.target.value }))}
              placeholder="0.00"
            />
            {errors.subtotal && <p className="text-xs text-red-500 mt-1">{errors.subtotal}</p>}
          </div>

          {/* VAT checkbox */}
          <div className="flex flex-col justify-center">
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-2">
              Sales Tax / VAT
            </label>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.is_vatable}
                onChange={(e) => setForm((f) => ({ ...f, is_vatable: e.target.checked }))}
                className="w-5 h-5 rounded accent-amber-500 cursor-pointer"
              />
              <span className="text-sm font-medium text-[var(--n-text)]">
                {form.is_vatable
                  ? <span className="text-amber-600">VATable — {systemTaxRate}% applied (₱{fmt(taxAmount)})</span>
                  : <span className="text-[var(--n-text-secondary)]">Non-VAT expense</span>}
              </span>
            </label>
          </div>

          {/* Computed Total */}
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Total</label>
            <div className="px-3 py-2 rounded-lg bg-[var(--n-input-bg)] border border-[var(--n-divider)] font-bold text-lg text-[var(--n-text)]">
              ₱{fmt(computedTotal)}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Notes</label>
          <textarea
            className="neu-inline-input w-full" rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional notes..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {isDraft && (
            <>
              <Button variant="secondary" onClick={handleSaveDraft} disabled={submitting}>
                {submitting ? <Spinner size="sm" /> : 'Save Draft'}
              </Button>
              <Button variant="amber" onClick={handleConfirm} disabled={submitting}>
                {submitting ? <Spinner size="sm" /> : 'Confirm Expense'}
              </Button>
            </>
          )}
          {isRecordedPO && (
            <Button variant="amber" onClick={handleSaveRecordedPO} disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Save Changes'}
            </Button>
          )}
          {!isEdit && (
            <Button variant="amber" onClick={handleCreate} disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Record Expense'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Expense Detail Modal                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

function ExpenseDetailModal({
  expense, onClose, onVoid,
}: {
  expense: Expense;
  onClose: () => void;
  onVoid: () => void;
}) {
  return (
    <Modal title={`Expense — ${expense.expense_number}`} isOpen onClose={onClose} width="lg">
      <div className="space-y-5">
        {/* Status badge */}
        <div className="flex items-center gap-3">
          <Badge variant={STATUS_VARIANT[expense.status] ?? 'neutral'}>
            {expense.status.toUpperCase()}
          </Badge>
          <span className="text-sm text-[var(--n-text-secondary)]">
            Recorded by {expense.user?.name ?? '—'} on {dayjs(expense.created_at).format('MMM D, YYYY h:mm A')}
          </span>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Date', value: dayjs(expense.date).format('MMM D, YYYY') },
            { label: 'Payee', value: expense.payee },
            { label: 'Category', value: expense.category?.name ?? '—' },
            { label: 'Reference No.', value: expense.reference_number || '—' },
            { label: 'Account Code', value: expense.category?.account_code ?? '—' },
            { label: 'Supplier', value: expense.supplier?.name ?? '(Manual entry)' },
          ].map((item) => (
            <div key={item.label} className="p-3 rounded-xl bg-[var(--n-input-bg)]">
              <p className="text-xs font-semibold text-[var(--n-text-secondary)] uppercase tracking-wide">{item.label}</p>
              <p className="text-sm font-medium text-[var(--n-text)] mt-1">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-[var(--n-input-bg)] text-center">
            <p className="text-xs font-semibold text-[var(--n-text-secondary)] uppercase">Subtotal</p>
            <p className="text-lg font-bold text-[var(--n-text)] mt-1">₱{fmt(expense.subtotal)}</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--n-input-bg)] text-center">
            <p className="text-xs font-semibold text-[var(--n-text-secondary)] uppercase">Tax</p>
            <p className="text-lg font-bold text-[var(--n-text)] mt-1">
              {expense.tax_amount > 0 ? `₱${fmt(expense.tax_amount)}` : '—'}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-navy/5 text-center border border-navy/10">
            <p className="text-xs font-semibold text-navy uppercase">Total</p>
            <p className="text-xl font-bold text-navy mt-1">₱{fmt(expense.total_amount)}</p>
          </div>
        </div>

        {/* Notes */}
        {expense.notes && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-xs font-semibold text-amber-800 uppercase mb-1">Notes</p>
            <p className="text-sm text-amber-900">{expense.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {expense.status === 'recorded' && (
            <Button variant="danger" onClick={onVoid}>
              <HiBan className="w-4 h-4 mr-2" /> Void Expense
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
