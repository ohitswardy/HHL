import { useEffect, useRef, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Spinner } from '../../../components/ui/Spinner';
import { HiPrinter, HiChevronLeft, HiChevronRight, HiDocumentDownload, HiChevronDown, HiSearch, HiX } from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { Client, SalesTransaction } from '../../../types';
import dayjs from 'dayjs';

interface StatementSummary {
  client: {
    id: number;
    business_name: string;
    tier: string | null;
    outstanding_balance: number;
  };
  period: { start: string; end: string };
  total_charges: number;
  total_payments: number;
  balance: number;
}

export function ClientStatementsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');
  const [startDate, setStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [searchTx, setSearchTx] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 20 });

  const [summary, setSummary] = useState<StatementSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

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

  // Load client list once
  useEffect(() => {
    api.get('/clients', { params: { per_page: 200 } })
      .then((res) => setClients(res.data.data))
      .catch(() => toast.error('Failed to load clients'));
  }, []);

  // Fetch paginated transactions
  useEffect(() => {
    if (!clientId) return;
    setLoadingTx(true);
    const params: Record<string, unknown> = { client_id: clientId, from: startDate, to: endDate, page, per_page: 20 };
    if (statusFilter) params.status = statusFilter;
    if (paymentMethodFilter) params.payment_method = paymentMethodFilter;
    if (searchTx.trim()) params.search = searchTx.trim();
    if (minAmount !== '') params.min_amount = minAmount;
    if (maxAmount !== '') params.max_amount = maxAmount;
    api.get('/pos/sales', { params })
      .then((res) => { setTransactions(res.data.data); setMeta(res.data.meta); })
      .catch(() => toast.error('Failed to load transactions'))
      .finally(() => setLoadingTx(false));
  }, [clientId, startDate, endDate, statusFilter, paymentMethodFilter, searchTx, minAmount, maxAmount, page]);

  // Fetch statement summary (non-voided totals)
  useEffect(() => {
    if (!clientId) return;
    setLoadingSummary(true);
    api.get('/accounting/reports/client-statement', { params: { client_id: clientId, start_date: startDate, end_date: endDate } })
      .then((res) => setSummary(res.data))
      .catch(() => toast.error('Failed to load statement summary'))
      .finally(() => setLoadingSummary(false));
  }, [clientId, startDate, endDate]);

  // Helpers to change filters while resetting pagination
  const changeClient = (id: string) => { setClientId(id); setPage(1); setTransactions([]); setSummary(null); };
  const changeStartDate = (d: string) => { setStartDate(d); setPage(1); };
  const changeEndDate = (d: string) => { setEndDate(d); setPage(1); };
  const changeStatus = (s: string) => { setStatusFilter(s); setPage(1); };
  const changePaymentMethod = (s: string) => { setPaymentMethodFilter(s); setPage(1); };
  const changeSearch = (s: string) => { setSearchTx(s); setPage(1); };
  const changeMinAmount = (s: string) => { setMinAmount(s); setPage(1); };
  const changeMaxAmount = (s: string) => { setMaxAmount(s); setPage(1); };

  const hasActiveFilters = !!(statusFilter || paymentMethodFilter || searchTx || minAmount || maxAmount);
  const clearAllFilters = () => {
    setStatusFilter(''); setPaymentMethodFilter(''); setSearchTx(''); setMinAmount(''); setMaxAmount(''); setPage(1);
  };

  const selectedClient = clients.find((c) => String(c.id) === clientId);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAll = async () => {
    if (!clientId) return;
    setExportOpen(false);
    setExporting(true);
    try {
      const res = await api.get('/accounting/reports/client-statement/pdf', {
        params: { client_id: clientId, start_date: '2000-01-01', end_date: dayjs().format('YYYY-MM-DD') },
        responseType: 'blob',
      });
      const slug = (selectedClient?.business_name ?? clientId).replace(/\s+/g, '-');
      downloadBlob(new Blob([res.data], { type: 'application/pdf' }), `${slug}-all-transactions.pdf`);
      toast.success('All transactions exported as PDF');
    } catch {
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleExportFiltered = async () => {
    if (!clientId) return;
    setExportOpen(false);
    setExporting(true);
    try {
      const params: Record<string, unknown> = {
        client_id: clientId,
        start_date: startDate,
        end_date: endDate,
      };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/accounting/reports/client-statement/pdf', {
        params,
        responseType: 'blob',
      });
      const slug = (selectedClient?.business_name ?? clientId).replace(/\s+/g, '-');
      downloadBlob(
        new Blob([res.data], { type: 'application/pdf' }),
        `${slug}-${startDate}-to-${endDate}.pdf`
      );
      toast.success('Filtered transactions exported as PDF');
    } catch {
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const handlePrintReceipt = async (transactionId: number) => {
    try {
      const res = await api.get(`/pos/sales/${transactionId}/receipt`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `receipt-${transactionId}.pdf`; a.click();
      URL.revokeObjectURL(url);
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="neu-page-title">Client Statements</h1>
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen(!exportOpen)}
            disabled={!clientId || exporting}
            className="neu-btn neu-btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            {exporting ? <Spinner size="sm" /> : <HiDocumentDownload className="w-4 h-4" />}
            Export
            <HiChevronDown className="w-3 h-3" />
          </button>

          {exportOpen && (
            <div className="neu-dropdown" style={{ right: 0, left: 'auto', minWidth: '13rem' }}>
              <button onClick={handleExportAll} disabled={exporting} className="neu-dropdown-item">
                <HiDocumentDownload className="w-4 h-4" />
                All Transactions (PDF)
              </button>
              <button onClick={handleExportFiltered} disabled={exporting} className="neu-dropdown-item">
                <HiDocumentDownload className="w-4 h-4" />
                Filtered Transactions (PDF)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <Select
              label="Client"
              value={clientId}
              onChange={(e) => changeClient(e.target.value)}
              options={clients.map((c) => ({ value: c.id, label: c.business_name }))}
              placeholder="Select a client..."
            />
          </div>
          <DatePicker label="From" value={startDate} onChange={(e) => changeStartDate(e.target.value)} />
          <DatePicker label="To" value={endDate} onChange={(e) => changeEndDate(e.target.value)} />
        </div>
      </Card>

      {/* Empty state */}
      {!clientId && (
        <Card className="p-12 text-center">
          <p style={{ color: 'var(--n-text-secondary)' }}>Select a client above to view their statement and transactions.</p>
        </Card>
      )}

      {clientId && (
        <>
          {/* Summary Cards */}
          {loadingSummary && !summary ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : summary ? (
            <>
              {/* Client info */}
              <Card className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-(--n-text)">{summary.client.business_name}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      {summary.client.tier && (
                        <span className="neu-badge neu-badge-info">{summary.client.tier}</span>
                      )}
                      {selectedClient?.phone && (
                        <span className="text-xs" style={{ color: 'var(--n-text-secondary)' }}>{selectedClient.phone}</span>
                      )}
                      {selectedClient?.email && (
                        <span className="text-xs" style={{ color: 'var(--n-text-secondary)' }}>{selectedClient.email}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs" style={{ color: 'var(--n-text-secondary)' }}>Statement Period</p>
                    <p className="font-semibold text-sm">
                      {dayjs(summary.period.start).format('MMM D')} – {dayjs(summary.period.end).format('MMM D, YYYY')}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Totals */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                  <p className="text-xs mb-1" style={{ color: 'var(--n-text-secondary)' }}>Total Charges</p>
                  <p className="text-xl font-bold text-(--n-text)">₱{summary.total_charges.toFixed(2)}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--n-text-dim)' }}>Non-voided sales</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-xs mb-1" style={{ color: 'var(--n-text-secondary)' }}>Total Payments</p>
                  <p className="text-xl font-bold text-green-600">₱{summary.total_payments.toFixed(2)}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--n-text-dim)' }}>Confirmed payments</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-xs mb-1" style={{ color: 'var(--n-text-secondary)' }}>Period Balance</p>
                  <p className={`text-xl font-bold ${summary.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ₱{summary.balance.toFixed(2)}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--n-text-dim)' }}>Charges minus payments</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-xs mb-1" style={{ color: 'var(--n-text-secondary)' }}>Outstanding Balance</p>
                  <p className={`text-xl font-bold ${summary.client.outstanding_balance > 0 ? 'text-red-600' : 'text-(--n-text)'}`}>
                    ₱{summary.client.outstanding_balance.toFixed(2)}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--n-text-dim)' }}>All time</p>
                </Card>
              </div>
            </>
          ) : null}

          {/* Transactions Table */}
          <Card className="overflow-hidden">
            {/* Table toolbar */}
            <div className="p-4 border-b border-(--n-border) space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-(--n-text)">Transactions</h3>
                  {!loadingTx && (
                    <span className="text-sm" style={{ color: 'var(--n-text-secondary)' }}>
                      ({meta.total} found)
                    </span>
                  )}
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="neu-btn neu-btn-secondary text-xs"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <HiX className="w-3 h-3" />
                    Clear filters
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
                {/* Search by transaction # */}
                <div className="relative lg:col-span-2">
                  <HiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--n-text-dim)' }} />
                  <input
                    type="text"
                    value={searchTx}
                    onChange={(e) => changeSearch(e.target.value)}
                    placeholder="Search transaction #..."
                    className="neu-input w-full pl-8"
                  />
                </div>
                {/* Status */}
                <Select
                  value={statusFilter}
                  onChange={(e) => changeStatus(e.target.value)}
                  options={[
                    { value: '', label: 'All Statuses' },
                    { value: 'pending', label: 'Pending' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'voided', label: 'Voided' },
                  ]}
                />
                {/* Payment method */}
                <Select
                  value={paymentMethodFilter}
                  onChange={(e) => changePaymentMethod(e.target.value)}
                  options={[
                    { value: '', label: 'All Payments' },
                    { value: 'cash', label: 'Cash' },
                    { value: 'card', label: 'Card' },
                    { value: 'bank_transfer', label: 'Bank Transfer' },
                    { value: 'check', label: 'Check' },
                    { value: 'credit', label: 'Credit' },
                  ]}
                />
                {/* Amount range */}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={minAmount}
                    onChange={(e) => changeMinAmount(e.target.value)}
                    placeholder="Min ₱"
                    min={0}
                    className="neu-input w-full"
                  />
                  <span style={{ color: 'var(--n-text-dim)' }}>–</span>
                  <input
                    type="number"
                    value={maxAmount}
                    onChange={(e) => changeMaxAmount(e.target.value)}
                    placeholder="Max ₱"
                    min={0}
                    className="neu-input w-full"
                  />
                </div>
              </div>
            </div>

            {loadingTx ? (
              <div className="flex items-center justify-center py-12"><Spinner /></div>
            ) : transactions.length === 0 ? (
              <div className="p-8 text-center">
                <p style={{ color: 'var(--n-text-secondary)' }}>No transactions found for this client in the selected period.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="neu-table">
                  <thead>
                    <tr>
                      <th>Transaction #</th>
                      <th>Date & Time</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th>Cashier</th>
                      <th className="text-right">Subtotal</th>
                      <th className="text-right">Discount</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Paid</th>
                      <th className="text-right">Balance Due</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className={tx.status === 'voided' ? 'opacity-60' : ''}>
                        <td className="font-medium font-mono text-xs">{tx.transaction_number}</td>
                        <td style={{ color: 'var(--n-text-secondary)' }}>
                          {new Date(tx.created_at).toLocaleString()}
                        </td>
                        <td>
                          <Badge variant={tx.fulfillment_type === 'delivery' ? 'info' : 'success'}>
                            {tx.fulfillment_type}
                          </Badge>
                        </td>
                        <td>
                          <Badge
                            variant={
                              tx.status === 'completed' ? 'success'
                              : tx.status === 'pending' ? 'warning'
                              : tx.status === 'voided' ? 'danger'
                              : 'neutral'
                            }
                          >
                            {tx.status}
                          </Badge>
                        </td>
                        <td style={{ color: 'var(--n-text-secondary)', textTransform: 'capitalize' }}>
                          {tx.payments?.map((p) => p.payment_method.replace('_', ' ')).join(', ') || '—'}
                        </td>
                        <td style={{ color: 'var(--n-text-secondary)' }}>{tx.user?.name || 'Unknown'}</td>
                        <td className="text-right" style={{ color: 'var(--n-text-secondary)' }}>
                          {tx.subtotal.toFixed(2)}
                        </td>
                        <td className="text-right" style={{ color: 'var(--n-danger)' }}>
                          {tx.discount_amount.toFixed(2)}
                        </td>
                        <td className="text-right font-semibold">{tx.total_amount.toFixed(2)}</td>
                        <td className="text-right text-green-600">{tx.total_paid.toFixed(2)}</td>
                        <td
                          className="text-right font-semibold"
                          style={{ color: tx.balance_due > 0 ? 'var(--n-danger)' : 'var(--n-success)' }}
                        >
                          {tx.balance_due.toFixed(2)}
                        </td>
                        <td className="text-center">
                          <button
                            onClick={() => handlePrintReceipt(tx.id)}
                            className="neu-btn-icon info"
                            title="Print Receipt"
                          >
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
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="neu-pagination-btn"
                  >
                    <HiChevronLeft className="w-4 h-4" />
                  </button>
                  {getPageNumbers(page, meta.last_page).map((p, i) =>
                    p === null ? (
                      <span key={`dots-${i}`} className="neu-pagination-dots">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`neu-pagination-btn ${page === p ? 'active' : ''}`}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setPage(Math.min(meta.last_page, page + 1))}
                    disabled={page === meta.last_page}
                    className="neu-pagination-btn"
                  >
                    <HiChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
