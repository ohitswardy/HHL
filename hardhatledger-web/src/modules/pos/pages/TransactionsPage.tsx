import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Spinner } from '../../../components/ui/Spinner';
import { HiSearch, HiDocumentDownload, HiChevronDown, HiPrinter, HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { SalesTransaction } from '../../../types';

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 20 });

  // Export dropdown
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close export dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Compute from/to date range from period + filterDate
  const getDateRange = (p: typeof period, d: string) => {
    const base = new Date(d);
    if (p === 'daily') {
      return { from: d, to: d };
    }
    if (p === 'weekly') {
      const day = base.getDay(); // 0=Sun
      const monday = new Date(base);
      monday.setDate(base.getDate() - ((day + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        from: monday.toISOString().split('T')[0],
        to:   sunday.toISOString().split('T')[0],
      };
    }
    // monthly
    const from = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const to   = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { from, to };
  };

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, period, filterDate]);

  // Fetch transactions whenever page or filters change
  useEffect(() => {
    setLoading(true);
    const { from, to } = getDateRange(period, filterDate);
    const params: Record<string, unknown> = { page, per_page: 20, from, to };
    if (search) params.search = search;

    api.get('/pos/sales', { params })
      .then((res) => { setTransactions(res.data.data); setMeta(res.data.meta); })
      .catch(() => toast.error('Failed to load transactions'))
      .finally(() => setLoading(false));
  }, [page, search, period, filterDate]);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    setExportOpen(false);
    setExporting(true);
    try {
      const res = await api.get('/pos/reports/export', {
        params: { period, date: filterDate, format: 'pdf' },
        responseType: 'blob',
      });
      downloadBlob(new Blob([res.data], { type: 'application/pdf' }), `transactions-${period}-${filterDate}.pdf`);
      toast.success('Report exported as PDF');
    } catch {
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = async () => {
    setExportOpen(false);
    setExporting(true);
    try {
      const res = await api.get('/pos/reports/export', {
        params: { period, date: filterDate, format: 'csv' },
        responseType: 'blob',
      });
      downloadBlob(new Blob([res.data], { type: 'text/csv' }), `transactions-${period}-${filterDate}.csv`);
      toast.success('Report exported as CSV');
    } catch {
      toast.error('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleExportXlsx = async () => {
    setExportOpen(false);
    setExporting(true);
    try {
      const res = await api.get('/pos/reports/export', {
        params: { period, date: filterDate, format: 'xlsx' },
        responseType: 'blob',
      });
      downloadBlob(
        new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `transactions-${period}-${filterDate}.xlsx`
      );
      toast.success('Report exported as Excel');
    } catch {
      toast.error('Failed to export Excel');
    } finally {
      setExporting(false);
    }
  };

  const handlePrintReceipt = async (transactionId: number) => {
    try {
      const res = await api.get(`/pos/sales/${transactionId}/receipt`, {
        responseType: 'blob',
      });
      downloadBlob(new Blob([res.data], { type: 'application/pdf' }), `receipt-${transactionId}.pdf`);
      toast.success('Receipt downloaded');
    } catch {
      toast.error('Failed to download receipt');
    }
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

  const getPeriodLabel = () => {
    if (period === 'daily') return `Day of ${filterDate}`;
    if (period === 'weekly') return 'This Week';
    return 'This Month';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="neu-page-title">Transactions</h1>
          <p className="text-sm text-[var(--n-text-secondary)] mt-1">{getPeriodLabel()}</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Period</label>
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value as 'daily' | 'weekly' | 'monthly')}
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
            />
          </div>

          {period === 'daily' && (
            <div>
              <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Date</label>
              <DatePicker
                inline
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
          )}

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Search Transaction</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <HiSearch className="absolute left-3 top-2.5 text-[var(--n-text-dim)] w-4 h-4" />
                <input
                  className="neu-inline-input w-full" style={{ paddingLeft: "2.25rem" }}
                  placeholder="Transaction #, Client name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Export Button */}
              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setExportOpen(!exportOpen)}
                  className="neu-btn neu-btn-secondary"
                  disabled={exporting || transactions.length === 0}
                  style={{ padding: '0.625rem 1rem' }}
                >
                  <HiDocumentDownload className="w-4 h-4" />
                  Export
                  <HiChevronDown className="w-3 h-3" />
                </button>

                {/* Export Dropdown */}
                {exportOpen && (
                  <div className="neu-dropdown">
                    <button onClick={handleExportPdf} disabled={exporting} className="neu-dropdown-item">
                      {exporting ? <Spinner size="sm" /> : <HiDocumentDownload className="w-4 h-4" />}
                      Export as PDF
                    </button>
                    <button onClick={handleExportCsv} disabled={exporting} className="neu-dropdown-item">
                      {exporting ? <Spinner size="sm" /> : <HiDocumentDownload className="w-4 h-4" />}
                      Export as CSV
                    </button>
                    <button onClick={handleExportXlsx} disabled={exporting} className="neu-dropdown-item">
                      {exporting ? <Spinner size="sm" /> : <HiDocumentDownload className="w-4 h-4" />}
                      Export as Excel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Transactions Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center">
            <p style={{ color: "var(--n-text-secondary)" }}>No transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="neu-table">
              <thead>
                <tr>
                  <th>Transaction #</th>
                  <th>Date & Time</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Cashier</th>
                  <th className="text-right">Subtotal</th>
                  <th className="text-right">Discount</th>
                  <th className="text-right">Total</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="font-medium font-mono text-xs">{tx.transaction_number}</td>
                    <td style={{ color: 'var(--n-text-secondary)' }}>{new Date(tx.created_at).toLocaleString()}</td>
                    <td style={{ color: 'var(--n-text-secondary)' }}>{tx.client?.business_name || 'Walk-in'}</td>
                    <td>
                      <Badge variant={tx.fulfillment_type === 'delivery' ? 'info' : 'success'}>
                        {tx.fulfillment_type}
                      </Badge>
                    </td>
                    <td style={{ color: 'var(--n-text-secondary)' }}>{tx.user?.name || 'Unknown'}</td>
                    <td className="text-right" style={{ color: 'var(--n-text-secondary)' }}>{parseFloat(tx.subtotal).toFixed(2)}</td>
                    <td className="text-right" style={{ color: 'var(--n-danger)' }}>{parseFloat(tx.discount_amount).toFixed(2)}</td>
                    <td className="text-right font-semibold">{parseFloat(tx.total_amount).toFixed(2)}</td>
                    <td className="text-center">
                      <button onClick={() => handlePrintReceipt(tx.id)} className="neu-btn-icon info" title="Print Receipt">
                        <HiPrinter className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta.last_page > 1 && (
          <div className="neu-pagination">
            <p className="neu-pagination-info">
              Showing {transactions.length > 0 ? (meta.current_page - 1) * meta.per_page + 1 : 0} to{' '}
              {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total} transactions
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
      </Card>
    </div>
  );
}
