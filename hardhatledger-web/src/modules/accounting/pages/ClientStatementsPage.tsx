import { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Spinner } from '../../../components/ui/Spinner';
import { HiPrinter, HiChevronLeft, HiChevronRight, HiDocumentDownload, HiSearch, HiX } from 'react-icons/hi';
import { ExportColumnPickerModal } from '../../../components/ui/ExportColumnPickerModal';
import type { ExportFormat } from '../../../components/ui/ExportColumnPickerModal';
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
  const [startDate, setStartDate] = useState(dayjs().startOf('year').format('YYYY-MM-DD'));
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

  const [exportPickerOpen, setExportPickerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

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
    const params: Record<string, unknown> = { client_id: clientId, page, per_page: 20 };
    if (startDate) params.from = startDate;
    if (endDate) params.to = endDate;
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
    api.get('/accounting/reports/client-statement', { params: { client_id: clientId, start_date: startDate || '2000-01-01', end_date: endDate || dayjs().format('YYYY-MM-DD') } })
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

  const handleExport = async (format: ExportFormat, columns: string[], filtered: boolean) => {
    setExportPickerOpen(false);
    if (!clientId) return;
    setExporting(true);
    const slug = (selectedClient?.business_name ?? clientId).replace(/\s+/g, '-');
    try {
      if (format === 'pdf') {
        const effectiveStart = filtered ? (startDate || '2000-01-01') : '2000-01-01';
        const effectiveEnd = filtered ? (endDate || dayjs().format('YYYY-MM-DD')) : dayjs().format('YYYY-MM-DD');
        const params: Record<string, unknown> = { client_id: clientId, start_date: effectiveStart, end_date: effectiveEnd, columns };
        if (filtered && statusFilter) params.status = statusFilter;
        const res = await api.get('/accounting/reports/client-statement/pdf', { params, responseType: 'blob' });
        const suffix = filtered ? `${effectiveStart}-to-${effectiveEnd}` : 'all-transactions';
        downloadBlob(new Blob([res.data], { type: 'application/pdf' }), `${slug}-${suffix}.pdf`);
        toast.success(`${filtered ? 'Filtered' : 'All'} transactions exported as PDF`);
      } else {
        const params: Record<string, unknown> = { client_id: clientId, per_page: 9999, page: 1 };
        if (filtered) {
          if (startDate) params.from = startDate;
          if (endDate) params.to = endDate;
          if (statusFilter) params.status = statusFilter;
          if (paymentMethodFilter) params.payment_method = paymentMethodFilter;
          if (searchTx.trim()) params.search = searchTx.trim();
          if (minAmount !== '') params.min_amount = minAmount;
          if (maxAmount !== '') params.max_amount = maxAmount;
        }
        const res = await api.get('/pos/sales', { params });
        const allTx: SalesTransaction[] = res.data.data;
        const effectiveStart = filtered ? (startDate || '2000-01-01') : '2000-01-01';
        const effectiveEnd = filtered ? (endDate || dayjs().format('YYYY-MM-DD')) : dayjs().format('YYYY-MM-DD');
        const periodLabel = filtered ? `${effectiveStart} to ${effectiveEnd}` : 'All Time';
        const csv = buildCSV(allTx, periodLabel, columns);
        const suffix = filtered ? `${effectiveStart}-to-${effectiveEnd}` : 'all-transactions';
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${slug}-${suffix}.csv`);
        toast.success(`${filtered ? 'Filtered' : 'All'} transactions exported as CSV`);
      }
    } catch {
      toast.error('Failed to export');
    } finally {
      setExporting(false);
    }
  };

  const buildCSV = (txList: SalesTransaction[], periodLabel: string, columns: string[]): string => {
    const has = (col: string) => columns.includes(col);
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows: string[] = [];

    // Document header
    rows.push('CLIENT STATEMENT');
    rows.push(`Client,${esc(selectedClient?.business_name ?? clientId)}`);
    if (selectedClient?.phone) rows.push(`Phone,${esc(selectedClient.phone)}`);
    if (selectedClient?.email) rows.push(`Email,${esc(selectedClient.email)}`);
    if (summary?.client.tier) rows.push(`Tier,${esc(summary.client.tier)}`);
    rows.push(`Period,${esc(periodLabel)}`);
    rows.push(`Generated,${esc(dayjs().format('YYYY-MM-DD HH:mm'))}`);
    rows.push('');

    // Summary block
    if (summary) {
      rows.push('SUMMARY');
      rows.push(`Total Charges (non-voided),${esc('₱' + summary.total_charges.toFixed(2))}`);
      rows.push(`Total Payments (confirmed),${esc('₱' + summary.total_payments.toFixed(2))}`);
      rows.push(`Period Balance (charges - payments),${esc('₱' + summary.balance.toFixed(2))}`);
      rows.push(`Outstanding Balance (all time),${esc('₱' + summary.client.outstanding_balance.toFixed(2))}`);
      rows.push('');
    }

    // Column headers (filtered by selection)
    const colHeaders: string[] = [];
    if (has('transaction_number')) colHeaders.push('Transaction #');
    if (has('date')) colHeaders.push('Date');
    if (has('time')) colHeaders.push('Time');
    if (has('fulfillment_type')) colHeaders.push('Fulfillment Type');
    if (has('status')) colHeaders.push('Status');
    if (has('payment_method')) colHeaders.push('Payment Method(s)');
    if (has('cashier')) colHeaders.push('Cashier');
    if (has('subtotal')) colHeaders.push('Subtotal (₱)');
    if (has('discount')) colHeaders.push('Discount (₱)');
    if (has('tax')) colHeaders.push('VAT (₱)');
    if (has('total')) colHeaders.push('Total (₱)');
    if (has('paid')) colHeaders.push('Paid (₱)');
    if (has('balance_due')) colHeaders.push('Balance Due (₱)');
    rows.push(colHeaders.map(esc).join(','));

    // Data rows
    for (const tx of txList) {
      const dt = new Date(tx.created_at);
      const paymentMethods = tx.payments?.map((p) => p.payment_method.replace(/_/g, ' ')).join('; ') || '—';
      const row: (string | number)[] = [];
      if (has('transaction_number')) row.push(tx.transaction_number);
      if (has('date')) row.push(dayjs(dt).format('YYYY-MM-DD'));
      if (has('time')) row.push(dayjs(dt).format('HH:mm:ss'));
      if (has('fulfillment_type')) row.push(tx.fulfillment_type);
      if (has('status')) row.push(tx.status);
      if (has('payment_method')) row.push(paymentMethods);
      if (has('cashier')) row.push(tx.user?.name || 'Unknown');
      if (has('subtotal')) row.push(tx.subtotal.toFixed(2));
      if (has('discount')) row.push(tx.discount_amount.toFixed(2));
      if (has('tax')) row.push((tx.tax_amount ?? 0).toFixed(2));
      if (has('total')) row.push(tx.total_amount.toFixed(2));
      if (has('paid')) row.push(tx.total_paid.toFixed(2));
      if (has('balance_due')) row.push(tx.balance_due.toFixed(2));
      rows.push(row.map(esc).join(','));
    }

    // BOM for Excel UTF-8 recognition
    return '\uFEFF' + rows.join('\r\n');
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
        <button
          onClick={() => setExportPickerOpen(true)}
          disabled={!clientId || exporting}
          className="neu-btn neu-btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
        >
          {exporting ? <Spinner size="sm" /> : <HiDocumentDownload className="w-4 h-4" />}
          Export
        </button>
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
          <DatePicker label="From" value={startDate} onChange={(e) => changeStartDate(e.target.value)} placeholder="All time" />
          <DatePicker label="To" value={endDate} onChange={(e) => changeEndDate(e.target.value)} placeholder="Today" />
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
                      {startDate && endDate
                        ? `${dayjs(startDate).format('MMM D')} – ${dayjs(endDate).format('MMM D, YYYY')}`
                        : startDate
                        ? `${dayjs(startDate).format('MMM D, YYYY')} – Present`
                        : endDate
                        ? `All Time – ${dayjs(endDate).format('MMM D, YYYY')}`
                        : 'All Time'}
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
                      <th className="text-right">VAT</th>
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
                        <td className="text-right" style={{ color: (tx.tax_amount ?? 0) > 0 ? 'var(--n-info)' : 'var(--n-text-dim)' }}>
                          {(tx.tax_amount ?? 0) > 0 ? (tx.tax_amount ?? 0).toFixed(2) : '—'}
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

      <ExportColumnPickerModal
        isOpen={exportPickerOpen}
        onClose={() => setExportPickerOpen(false)}
        exportKey="client-statements"
        formats={['pdf', 'csv']}
        hasFilterOption
        isFiltered={!!(startDate || endDate || statusFilter || paymentMethodFilter || searchTx || minAmount || maxAmount)}
        onExport={handleExport}
        exporting={exporting}
      />
    </div>
  );
}
