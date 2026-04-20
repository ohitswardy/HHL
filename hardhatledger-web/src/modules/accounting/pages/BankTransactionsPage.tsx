import { useEffect, useState, useCallback } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { Spinner } from '../../../components/ui/Spinner';
import { DatePicker } from '../../../components/ui/DatePicker';
import {
  HiSearch, HiDownload, HiPencil, HiCheck, HiX,
  HiChevronLeft, HiChevronRight, HiCurrencyDollar,
  HiArrowUp, HiArrowDown, HiDocumentDownload,
} from 'react-icons/hi';
import { ExportColumnPickerModal } from '../../../components/ui/ExportColumnPickerModal';
import type { ExportFormat } from '../../../components/ui/ExportColumnPickerModal';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { BankTransaction, BankTransactionSummary } from '../../../types';
import dayjs from 'dayjs';

/* ─── helpers ─────────────────────────────────────────────────────────────── */

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/* ─── additional-notes localStorage persistence ─────────────────────────── */

const NOTES_KEY = 'hhl_bank_additional_notes';

const loadSavedNotes = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}'); }
  catch { return {}; }
};

const saveNotes = (txns: BankTransaction[]): void => {
  const map = loadSavedNotes();
  txns.forEach((t) => {
    if (t.additional_notes) map[t.ref_no] = t.additional_notes;
    else delete map[t.ref_no];
  });
  localStorage.setItem(NOTES_KEY, JSON.stringify(map));
};

const mergeNotes = (txns: BankTransaction[]): BankTransaction[] => {
  const saved = loadSavedNotes();
  return txns.map((t) => ({ ...t, additional_notes: saved[t.ref_no] ?? '' }));
};

const TYPE_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = {
  Deposit: 'success',
  Expense: 'danger',
  'Purchase Order': 'warning',
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

export function BankTransactionsPage() {
  /* ── state ── */
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [summary, setSummary] = useState<BankTransactionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportPickerOpen, setExportPickerOpen] = useState(false);

  /* close export dropdown on outside click */
  useEffect(() => {
    // noop - modal handles its own close
  }, []);

  const handleExport = async (format: ExportFormat, columns: string[], filtered: boolean) => {
    setExportPickerOpen(false);
    setExporting(true);

    let dataToExport = transactions;
    if (editMode) {
      dataToExport = editedTransactions;
      saveNotes(editedTransactions);
      setTransactions(editedTransactions);
      setEditMode(false);
    }

    try {
      const payload: Record<string, unknown> = { columns };
      if (filtered) {
        if (dateFrom) payload.from = dateFrom;
        if (dateTo) payload.to = dateTo;
        if (search.trim()) payload.search = search.trim();
        payload.transactions = buildTransactionPayload(dataToExport);
      } else {
        const allRes = await api.get('/accounting/bank-transactions');
        payload.transactions = buildTransactionPayload(mergeNotes(allRes.data.data));
      }

      const response = await api.post(`/accounting/bank-transactions/export/${format}`, payload, { responseType: 'blob' });
      const suffix = filtered ? `-filtered-${dayjs().format('YYYY-MM-DD')}` : `-all-${dayjs().format('YYYY-MM-DD')}`;
      const mimeType = format === 'pdf' ? 'application/pdf' : 'text/csv';
      downloadBlob(new Blob([response.data], { type: mimeType }), `bank-transactions${suffix}.${format}`);
      toast.success(`${filtered ? 'Filtered' : 'All'} transactions exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Failed to export');
    } finally {
      setExporting(false);
    }
  };

  /* ── edit mode ── */
  const [editMode, setEditMode] = useState(false);
  const [editedTransactions, setEditedTransactions] = useState<BankTransaction[]>([]);

  /* ── pagination (client-side) ── */
  const PER_PAGE = 25;
  const [page, setPage] = useState(1);

  /* ── debounced search ── */
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  /* ── fetch ── */
  const fetchTransactions = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.to = dateTo;
    if (search.trim()) params.search = search.trim();
    api.get('/accounting/bank-transactions', { params })
      .then((r) => {
        setTransactions(mergeNotes(r.data.data));
        setSummary(r.data.summary);
        setEditMode(false);
      })
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, search]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  /* ── pagination ── */
  const allData = editMode ? editedTransactions : transactions;
  const totalPages = Math.max(1, Math.ceil(allData.length / PER_PAGE));
  const paginated = allData.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  /* ── enter edit mode ── */
  const enterEditMode = () => {
    setEditedTransactions(JSON.parse(JSON.stringify(transactions)));
    setEditMode(true);
  };

  /* ── edit handler ── */
  const updateField = (index: number, field: keyof BankTransaction, value: string | number) => {
    setEditedTransactions((prev) => {
      const updated = [...prev];
      const globalIdx = (page - 1) * PER_PAGE + index;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (updated[globalIdx] as any)[field] = value;

      // Recalculate running balance
      let balance = 0;
      for (let i = 0; i < updated.length; i++) {
        balance += (updated[i].deposit_amount || 0) - (updated[i].payment_amount || 0);
        updated[i] = { ...updated[i], balance: Math.round(balance * 100) / 100 };
      }
      return updated;
    });
  };

  /* ── export helpers ── */
  const buildTransactionPayload = (data: BankTransaction[]) =>
    data.map((t) => ({
      date: t.date, ref_no: t.ref_no, type: t.type,
      payee_account: t.payee_account, memo: t.memo,
      additional_notes: t.additional_notes ?? '',
      payment_amount: t.payment_amount, deposit_amount: t.deposit_amount,
      tax: t.tax, balance: t.balance,
    }));

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.setAttribute('download', filename);
    document.body.appendChild(link); link.click();
    link.remove(); window.URL.revokeObjectURL(url);
  };

  /* ── export PDF ── */
  const handleExportPdf = async (filtered: boolean) => {
    setExportOpen(false);
    setExporting(true);

    // Auto-apply any pending edits
    let dataToExport = transactions;
    if (editMode) {
      dataToExport = editedTransactions;
      saveNotes(editedTransactions);
      setTransactions(editedTransactions);
      setEditMode(false);
    }

    try {
      const payload: Record<string, unknown> = {};
      if (filtered) {
        if (dateFrom) payload.from = dateFrom;
        if (dateTo) payload.to = dateTo;
        if (search.trim()) payload.search = search.trim();
        // Filtered: use current view data which already has notes merged
        payload.transactions = buildTransactionPayload(dataToExport);
      } else {
        // All: fetch every transaction, then merge localStorage notes so they appear in the PDF
        const allRes = await api.get('/accounting/bank-transactions');
        payload.transactions = buildTransactionPayload(mergeNotes(allRes.data.data));
      }

      const response = await api.post('/accounting/bank-transactions/export/pdf', payload, { responseType: 'blob' });
      const suffix = filtered ? `-filtered-${dayjs().format('YYYY-MM-DD')}` : `-all-${dayjs().format('YYYY-MM-DD')}`;
      downloadBlob(new Blob([response.data]), `bank-transactions${suffix}.pdf`);
      toast.success(`${filtered ? 'Filtered' : 'All'} transactions exported as PDF`);
    } catch {
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  /* ── export CSV ── */
  const handleExportCsv = async (filtered: boolean) => {
    setExportOpen(false);
    setExporting(true);

    let dataToExport = transactions;
    if (editMode) {
      dataToExport = editedTransactions;
      saveNotes(editedTransactions);
      setTransactions(editedTransactions);
      setEditMode(false);
    }

    try {
      const payload: Record<string, unknown> = {};
      if (filtered) {
        if (dateFrom) payload.from = dateFrom;
        if (dateTo) payload.to = dateTo;
        if (search.trim()) payload.search = search.trim();
        payload.transactions = buildTransactionPayload(dataToExport);
      } else {
        // All: fetch every transaction, then merge localStorage notes so they appear in the CSV
        const allRes = await api.get('/accounting/bank-transactions');
        payload.transactions = buildTransactionPayload(mergeNotes(allRes.data.data));
      }

      const response = await api.post('/accounting/bank-transactions/export/csv', payload, { responseType: 'blob' });
      const suffix = filtered ? `-filtered-${dayjs().format('YYYY-MM-DD')}` : `-all-${dayjs().format('YYYY-MM-DD')}`;
      downloadBlob(new Blob([response.data], { type: 'text/csv' }), `bank-transactions${suffix}.csv`);
      toast.success(`${filtered ? 'Filtered' : 'All'} transactions exported as CSV`);
    } catch {
      toast.error('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <h1 className="neu-page-title" style={{ marginBottom: '1.5rem' }}>
        Summary of Business Bank Transactions
      </h1>

      {/* ── Summary Cards ── */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-green-50 text-green-600"><HiArrowDown className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-[var(--n-text-secondary)] uppercase font-semibold">Total Deposits</p>
                <p className="text-lg font-bold text-green-700">₱{fmt(summary.total_deposits)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-50 text-red-600"><HiArrowUp className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-[var(--n-text-secondary)] uppercase font-semibold">Total Payments</p>
                <p className="text-lg font-bold text-red-700">₱{fmt(summary.total_payments)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600"><HiCurrencyDollar className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-[var(--n-text-secondary)] uppercase font-semibold">Total Tax</p>
                <p className="text-lg font-bold text-amber-700">₱{fmt(summary.total_tax)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50 text-[var(--n-primary)]"><HiCurrencyDollar className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-[var(--n-text-secondary)] uppercase font-semibold">Net Balance</p>
                <p className="text-lg font-bold text-[var(--n-primary)]">₱{fmt(summary.net_balance)}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── Filters & Actions ── */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">From</label>
            <DatePicker
              inline
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              placeholder="From"
              max={dateTo || undefined}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">To</label>
            <DatePicker
              inline
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              placeholder="To"
              min={dateFrom || undefined}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-[var(--n-text-secondary)] mb-1">Search</label>
            <div className="relative">
              <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--n-text-dim)]" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search ref no, payee..."
                style={{ paddingLeft: '2rem' }}
              />
            </div>
          </div>
            <div className="flex gap-2">
            {!editMode ? (
              <Button variant="outline" onClick={enterEditMode} disabled={transactions.length === 0}>
                <HiPencil className="w-4 h-4 mr-1" /> Edit
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setEditMode(false)}>
                  <HiX className="w-4 h-4 mr-1" /> Cancel
                </Button>
                <Button variant="amber" onClick={() => {
                  saveNotes(editedTransactions);
                  setTransactions(editedTransactions);
                  setEditMode(false);
                  toast.success('Changes applied');
                }}>
                  <HiCheck className="w-4 h-4 mr-1" /> Apply Changes
                </Button>
              </>
            )}
            {/* ── Export ── */}
            <div className="shrink-0">
              <Button variant="amber" onClick={() => setExportPickerOpen(true)} disabled={exporting || transactions.length === 0}>
                {exporting ? <Spinner size="sm" /> : <HiDocumentDownload className="w-4 h-4 mr-1" />}
                Export
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Data Table ── */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner /></div>
        ) : paginated.length === 0 ? (
          <div className="text-center py-20 text-[var(--n-text-dim)]">
            <HiCurrencyDollar className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-semibold">No business bank transactions found</p>
            <p className="text-sm mt-1">Transactions paid via "Business Bank" will appear here.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="neu-table w-full">
                <thead>
                  <tr>
                    <th className="w-10">#</th>
                    <th>Date</th>
                    <th>Ref No.</th>
                    <th>Type</th>
                    <th>Payee / Account</th>
                    <th>Bank / Check Details</th>
                    <th>Additional Notes</th>
                    <th className="text-right">Payment</th>
                    <th className="text-right">Deposit</th>
                    <th className="text-right">Tax</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((txn, idx) => {
                    const globalIdx = (page - 1) * PER_PAGE + idx;
                    return (
                      <tr key={txn.id}>
                        <td className="text-[var(--n-text-dim)] text-xs">{globalIdx + 1}</td>
                        <td className="whitespace-nowrap">{dayjs(txn.date).format('MMM D, YYYY')}</td>
                        <td className="font-mono text-xs">{txn.ref_no}</td>
                        <td><Badge variant={TYPE_VARIANT[txn.type] ?? 'info'}>{txn.type}</Badge></td>
                        <td>
                          {editMode ? (
                            <input
                              className="neu-inline-input w-full text-sm"
                              value={(editedTransactions[globalIdx] ?? txn).payee_account}
                              onChange={(e) => updateField(idx, 'payee_account', e.target.value)}
                            />
                          ) : txn.payee_account}
                        </td>
                        <td>
                          {editMode ? (
                            <input
                              className="neu-inline-input w-full text-sm"
                              value={(editedTransactions[globalIdx] ?? txn).memo}
                              onChange={(e) => updateField(idx, 'memo', e.target.value)}
                            />
                          ) : (
                            <span className="text-sm text-[var(--n-text-secondary)]">{txn.memo}</span>
                          )}
                        </td>
                        <td>
                          {editMode ? (
                            <input
                              className="neu-inline-input w-full text-sm"
                              placeholder="Add notes…"
                              value={(editedTransactions[globalIdx] ?? txn).additional_notes ?? ''}
                              onChange={(e) => updateField(idx, 'additional_notes', e.target.value)}
                            />
                          ) : (
                            <span className="text-sm text-[var(--n-text-secondary)]">{txn.additional_notes}</span>
                          )}
                        </td>
                        <td className="text-right">
                          {editMode ? (
                            <input
                              type="number" step="0.01" min="0"
                              className="neu-inline-input w-24 text-right text-sm"
                              value={(editedTransactions[globalIdx] ?? txn).payment_amount}
                              onChange={(e) => updateField(idx, 'payment_amount', parseFloat(e.target.value) || 0)}
                            />
                          ) : txn.payment_amount > 0 ? (
                            <span className="text-red-600 font-medium">₱{fmt(txn.payment_amount)}</span>
                          ) : null}
                        </td>
                        <td className="text-right">
                          {editMode ? (
                            <input
                              type="number" step="0.01" min="0"
                              className="neu-inline-input w-24 text-right text-sm"
                              value={(editedTransactions[globalIdx] ?? txn).deposit_amount}
                              onChange={(e) => updateField(idx, 'deposit_amount', parseFloat(e.target.value) || 0)}
                            />
                          ) : txn.deposit_amount > 0 ? (
                            <span className="text-green-600 font-medium">₱{fmt(txn.deposit_amount)}</span>
                          ) : null}
                        </td>
                        <td className="text-right">
                          {editMode ? (
                            <input
                              type="number" step="0.01" min="0"
                              className="neu-inline-input w-20 text-right text-sm"
                              value={(editedTransactions[globalIdx] ?? txn).tax}
                              onChange={(e) => updateField(idx, 'tax', parseFloat(e.target.value) || 0)}
                            />
                          ) : txn.tax > 0 ? (
                            <span className="text-amber-600">₱{fmt(txn.tax)}</span>
                          ) : null}
                        </td>
                        <td className="text-right font-bold whitespace-nowrap">
                          <span className={txn.balance >= 0 ? 'text-[var(--n-primary)]' : 'text-red-600'}>
                            ₱{fmt(txn.balance)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--n-divider)]">
                <span className="text-sm text-[var(--n-text-secondary)]">
                  Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, allData.length)} of {allData.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg hover:bg-[var(--n-inset)] disabled:opacity-30"
                  >
                    <HiChevronLeft className="w-4 h-4" />
                  </button>
                  {getPageNumbers(page, totalPages).map((p, i) =>
                    p === null ? (
                      <span key={`dot-${i}`} className="px-1 text-[var(--n-text-dim)]">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium ${
                          p === page
                            ? 'bg-[var(--n-primary)] text-white'
                            : 'hover:bg-[var(--n-inset)] text-[var(--n-text-secondary)]'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg hover:bg-[var(--n-inset)] disabled:opacity-30"
                  >
                    <HiChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Export Column Picker */}
      <ExportColumnPickerModal
        isOpen={exportPickerOpen}
        onClose={() => setExportPickerOpen(false)}
        exportKey="bank-transactions"
        formats={['pdf', 'csv']}
        hasFilterOption
        isFiltered={!!(dateFrom || dateTo || search.trim())}
        onExport={handleExport}
        exporting={exporting}
      />
    </div>
  );
}
