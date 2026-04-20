import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { DateRangePicker, DatePicker } from '../../../components/ui/DatePicker';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Spinner } from '../../../components/ui/Spinner';
import { HiSearch, HiDocumentDownload, HiPrinter, HiChevronLeft, HiChevronRight, HiCheck, HiBan, HiExclamation, HiPencilAlt, HiEye, HiCash, HiCalendar } from 'react-icons/hi';
import { ExportColumnPickerModal } from '../../../components/ui/ExportColumnPickerModal';
import type { ExportFormat } from '../../../components/ui/ExportColumnPickerModal';
import dayjs from 'dayjs';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { SalesTransaction } from '../../../types';
import { Input } from '../../../components/ui/Input';

type ConfirmAction = { type: 'complete' | 'void'; transaction: SalesTransaction } | null;

/** Returns today's date as YYYY-MM-DD using the browser's local timezone. */
function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(localDateStr());
  const [dateTo, setDateTo] = useState(localDateStr());
  const [statusFilter, setStatusFilter] = useState('');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 20 });

  // Export dropdown
  const [exportPickerOpen, setExportPickerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Status update
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  // View transaction details
  const [viewingTx, setViewingTx] = useState<SalesTransaction | null>(null);
  const [loadingView, setLoadingView] = useState(false);

  // Edit transaction
  const [editingTx, setEditingTx] = useState<SalesTransaction | null>(null);
  const [editItems, setEditItems] = useState<Array<{
    id: number; product_name: string; sku: string;
    quantity: number; unit_price: string; discount: string;
  }>>([]);
  const [editNotes, setEditNotes] = useState('');
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  // Record payment
  const [recordingPaymentTx, setRecordingPaymentTx] = useState<SalesTransaction | null>(null);
  const [rpMethod, setRpMethod] = useState('cash');
  const [rpAmount, setRpAmount] = useState('');
  const [rpReference, setRpReference] = useState('');
  const [rpSaving, setRpSaving] = useState(false);
  const [rpNotes, setRpNotes] = useState('');
  // 'full' = pay entire balance, number = target a specific installment payment ID
  const [rpTarget, setRpTarget] = useState<'full' | number>('full');

  // Inline transaction number edit
  const [editingTxNumber, setEditingTxNumber] = useState<number | null>(null);
  const [txNumberDraft, setTxNumberDraft] = useState('');
  const [savingTxNumber, setSavingTxNumber] = useState(false);

  // Update credit due date
  const [updateDueDateTx, setUpdateDueDateTx] = useState<SalesTransaction | null>(null);
  const [updatedDueDates, setUpdatedDueDates] = useState<Record<number, string>>({});
  const [dueDateSaving, setDueDateSaving] = useState(false);

  // Close export dropdown on outside click
  useEffect(() => {
    // noop - modal handles its own close
  }, []);

  const buildExportParams = () => ({
    from: dateFrom, to: dateTo,
    ...(search && { search }),
    ...(statusFilter && { status: statusFilter }),
    ...(fulfillmentFilter && { fulfillment_type: fulfillmentFilter }),
    ...(paymentFilter && { payment_method: paymentFilter }),
  });

  const handleExport = async (format: ExportFormat, columns: string[]) => {
    setExportPickerOpen(false);
    setExporting(true);
    try {
      const params = { ...buildExportParams(), columns, format };
      const res = await api.get('/pos/reports/export', { params, responseType: 'blob' });
      let type = 'application/pdf';
      let ext = 'pdf';
      if (format === 'csv') { type = 'text/csv'; ext = 'csv'; }
      if (format === 'xlsx') { type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; ext = 'xlsx'; }
      downloadBlob(new Blob([res.data], { type }), `transactions-${dateFrom}-${dateTo}.${ext}`);
      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Failed to export');
    } finally {
      setExporting(false);
    }
  };

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo, statusFilter, fulfillmentFilter, paymentFilter]);

  // Fetch transactions whenever page or filters change
  useEffect(() => {
    setLoading(true);
    const params: Record<string, unknown> = { page, per_page: 20, from: dateFrom, to: dateTo };
    if (search) params.search = search;
    if (statusFilter === 'overdue') {
      params.overdue = 1;
    } else if (statusFilter) {
      params.status = statusFilter;
    }
    if (fulfillmentFilter) params.fulfillment_type = fulfillmentFilter;
    if (paymentFilter) params.payment_method = paymentFilter;

    api.get('/pos/sales', { params })
      .then((res) => { setTransactions(res.data.data); setMeta(res.data.meta); })
      .catch(() => toast.error('Failed to load transactions'))
      .finally(() => setLoading(false));
  }, [page, search, dateFrom, dateTo, statusFilter, fulfillmentFilter, paymentFilter]);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {};
  const handleExportCsv = async () => {};
  const handleExportXlsx = async () => {};

  const handleOpenView = async (tx: SalesTransaction) => {
    setLoadingView(true);
    try {
      const res = await api.get(`/pos/sales/${tx.id}`);
      setViewingTx(res.data.data);
    } catch {
      toast.error('Failed to load transaction details');
    } finally {
      setLoadingView(false);
    }
  };

  const handleOpenEdit = async (tx: SalesTransaction) => {
    setLoadingEdit(true);
    try {
      const res = await api.get(`/pos/sales/${tx.id}`);
      const full: SalesTransaction = res.data.data;
      setEditingTx(full);
      setEditNotes(full.notes ?? '');
      setEditItems(
        (full.items ?? []).map((item) => ({
          id: item.id,
          product_name: item.product?.name ?? `Product #${item.product_id}`,
          sku: item.product?.sku ?? '',
          quantity: item.quantity,
          unit_price: item.unit_price.toFixed(2),
          discount: item.discount.toFixed(2),
        }))
      );
    } catch {
      toast.error('Failed to load transaction details');
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingTx) return;
    setSaving(true);
    try {
      const payload = {
        notes: editNotes.trim() || null,
        items: editItems.map((item) => ({
          id: item.id,
          unit_price: parseFloat(item.unit_price) || 0,
          discount: parseFloat(item.discount) || 0,
        })),
      };
      const res = await api.patch(`/pos/sales/${editingTx.id}`, payload);
      setTransactions((prev) =>
        prev.map((t) => (t.id === editingTx.id ? res.data.data : t))
      );
      toast.success('Transaction updated');
      setEditingTx(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const getEditTotals = () => {
    let subtotal = 0, discountTotal = 0;
    editItems.forEach((item) => {
      const up = parseFloat(item.unit_price) || 0;
      const disc = parseFloat(item.discount) || 0;
      subtotal += up * item.quantity;
      discountTotal += disc;
    });
    const deliveryFee = editingTx ? (editingTx.delivery_fee ?? 0) : 0;
    return { subtotal, discountTotal, deliveryFee, total: Math.max(0, subtotal - discountTotal + deliveryFee) };
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

  const handleMarkCompleted = async (transactionId: number) => {
    setConfirmAction(null);
    setUpdatingId(transactionId);
    try {
      const res = await api.patch(`/pos/sales/${transactionId}/complete`);
      setTransactions((prev) => prev.map((t) => t.id === transactionId ? res.data.data : t));
      toast.success('Transaction marked as completed');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleVoidSale = async (transactionId: number) => {
    setConfirmAction(null);
    setUpdatingId(transactionId);
    try {
      const res = await api.post(`/pos/sales/${transactionId}/void`);
      setTransactions((prev) => prev.map((t) => t.id === transactionId ? res.data.data : t));
      toast.success('Transaction voided');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to void transaction');
    } finally {
      setUpdatingId(null);
    }
  };

  const openRecordPayment = async (tx: SalesTransaction) => {
    try {
      const res = await api.get(`/pos/sales/${tx.id}`);
      const full: SalesTransaction = res.data.data;
      setRecordingPaymentTx(full);
      setRpMethod('cash');
      setRpReference('');
      setRpNotes('');
      // Default: if there are installments, pre-select the earliest pending one; else pay full
      const pendingCredits = (full.payments ?? [])
        .filter(p => p.payment_method === 'credit' && p.status === 'pending')
        .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
      if (pendingCredits.length > 1) {
        setRpTarget(pendingCredits[0].id);
        setRpAmount(pendingCredits[0].amount.toFixed(2));
      } else {
        setRpTarget('full');
        setRpAmount((full.balance_due ?? 0).toFixed(2));
      }
    } catch {
      toast.error('Failed to load transaction');
    }
  };

  const handleRecordPayment = async () => {
    if (!recordingPaymentTx) return;
    setRpSaving(true);
    try {
      const payload: Record<string, unknown> = {
        payment_method: rpMethod,
        amount: parseFloat(rpAmount) || 0,
        reference_number: rpReference.trim() || null,
        notes: rpNotes.trim() || null,
      };
      if (typeof rpTarget === 'number') {
        payload.target_payment_id = rpTarget;
      }
      const res = await api.post(`/pos/sales/${recordingPaymentTx.id}/record-payment`, payload);
      const updated = res.data.data;
      setTransactions((prev) => prev.map((t) => t.id === recordingPaymentTx.id ? updated : t));
      if (viewingTx?.id === recordingPaymentTx.id) {
        setViewingTx(updated);
      }
      toast.success(updated.status === 'completed' ? 'Payment recorded — transaction completed!' : 'Payment recorded');
      setRecordingPaymentTx(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setRpSaving(false);
    }
  };

  const openUpdateDueDate = async (tx: SalesTransaction) => {
    try {
      const res = await api.get(`/pos/sales/${tx.id}`);
      const full: SalesTransaction = res.data.data;
      setUpdateDueDateTx(full);
      const initialDates: Record<number, string> = {};
      (full.payments ?? [])
        .filter(p => p.payment_method === 'credit' && p.status === 'pending')
        .forEach(p => { if (p.due_date) initialDates[p.id] = p.due_date; });
      setUpdatedDueDates(initialDates);
    } catch {
      toast.error('Failed to load transaction');
    }
  };

  const handleUpdateDueDates = async () => {
    if (!updateDueDateTx) return;
    setDueDateSaving(true);
    try {
      const creditPayments = (updateDueDateTx.payments ?? [])
        .filter(p => p.payment_method === 'credit' && p.status === 'pending');
      await Promise.all(
        creditPayments.map(p => {
          const newDate = updatedDueDates[p.id];
          if (newDate) {
            return api.patch(`/pos/sales/${updateDueDateTx.id}/credit-due-date`, {
              payment_id: p.id,
              due_date: newDate,
            });
          }
          return Promise.resolve(null);
        })
      );
      const res = await api.get(`/pos/sales/${updateDueDateTx.id}`);
      const updated = res.data.data;
      setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
      if (viewingTx?.id === updated.id) setViewingTx(updated);
      toast.success('Due date updated');
      setUpdateDueDateTx(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update due date');
    } finally {
      setDueDateSaving(false);
    }
  };

  const handleSaveTxNumber = async (txId: number) => {
    const draft = txNumberDraft.trim();
    if (!draft) return;
    setSavingTxNumber(true);
    try {
      const res = await api.patch(`/pos/sales/${txId}/transaction-number`, { transaction_number: draft });
      setTransactions((prev) => prev.map((t) => t.id === txId ? res.data.data : t));
      if (viewingTx?.id === txId) setViewingTx(res.data.data);
      toast.success('Transaction number updated');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update transaction number');
    } finally {
      setSavingTxNumber(false);
      setEditingTxNumber(null);
    }
  };

  // ── Overdue helpers ──
  const getCreditDueDate = (tx: SalesTransaction): string | null =>
    tx.payments?.find(p => p.payment_method === 'credit' && p.status === 'pending')?.due_date ?? null;

  const isTxOverdue = (tx: SalesTransaction): boolean => {
    const d = getCreditDueDate(tx);
    return !!d && d < localDateStr();
  };

  const hasPendingCredit = (tx: SalesTransaction): boolean =>
    (tx.payments ?? []).some(p => p.payment_method === 'credit' && p.status === 'pending');

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
    const range = dateFrom === dateTo
      ? dayjs(dateFrom).format('MMMM D, YYYY')
      : `${dayjs(dateFrom).format('MMM D, YYYY')} \u2013 ${dayjs(dateTo).format('MMM D, YYYY')}`;
    const extras = [statusFilter, fulfillmentFilter, paymentFilter ? paymentFilter.replace('_', ' ') : '']
      .filter(Boolean)
      .map((v) => v.charAt(0).toUpperCase() + v.slice(1));
    return extras.length ? `${range} \u00b7 ${extras.join(' \u00b7 ')}` : range;
  };

  const setPresetToday = () => {
    const t = localDateStr();
    setDateFrom(t); setDateTo(t);
  };
  const setPresetWeek = () => {
    const now = new Date();
    const dow = now.getDay();
    const mon = new Date(now); mon.setDate(now.getDate() - ((dow + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    setDateFrom(mon.toISOString().split('T')[0]);
    setDateTo(sun.toISOString().split('T')[0]);
  };
  const setPresetMonth = () => {
    const now = new Date();
    const y = now.getFullYear(); const m = now.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    setDateFrom(`${y}-${String(m + 1).padStart(2, '0')}-01`);
    setDateTo(`${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`);
  };

  const activePreset = (() => {
    const t = localDateStr();
    if (dateFrom === t && dateTo === t) return 'Today';
    const now = new Date();
    const dow = now.getDay();
    const mon = new Date(now); mon.setDate(now.getDate() - ((dow + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    if (dateFrom === localDateStr(mon) && dateTo === localDateStr(sun)) return 'This Week';
    const y = now.getFullYear(); const mo = now.getMonth();
    const last = new Date(y, mo + 1, 0).getDate();
    if (dateFrom === `${y}-${String(mo + 1).padStart(2, '0')}-01` && dateTo === `${y}-${String(mo + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`) return 'This Month';
    return null;
  })();

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
      <Card className="p-4 space-y-3">
        {/* Row 1: Date range + quick presets */}
        <div className="flex flex-wrap items-center gap-3">
          <div style={{ flex: '0 0 auto' }}>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--n-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date Range</label>
            <DateRangePicker
              inline
              valueFrom={dateFrom}
              valueTo={dateTo}
              onChangeFrom={(e) => setDateFrom(e.target.value)}
              onChangeTo={(e) => setDateTo(e.target.value)}
            />
          </div>
          {/* Quick preset toggle */}
          <div style={{ flex: '0 0 auto', paddingTop: '1.25rem' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'var(--n-inset)',
                borderRadius: 10,
                padding: 3,
                gap: 2,
              }}
            >
              {(['Today', 'This Week', 'This Month'] as const).map((label) => {
                const isActive = activePreset === label;
                return (
                  <button
                    key={label}
                    onClick={label === 'Today' ? setPresetToday : label === 'This Week' ? setPresetWeek : setPresetMonth}
                    style={{
                      padding: '0.3rem 0.65rem',
                      fontSize: '0.72rem',
                      fontWeight: isActive ? 700 : 500,
                      fontFamily: 'var(--n-font-mono)',
                      letterSpacing: '0.04em',
                      border: 'none',
                      borderRadius: 7,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      color: isActive ? 'var(--n-accent)' : 'var(--n-text-dim)',
                      background: isActive ? 'var(--n-surface)' : 'transparent',
                      boxShadow: isActive ? 'var(--n-shadow-sm)' : 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 2: Status + Fulfillment + Search + Export */}
        <div className="flex flex-wrap items-end gap-3">
          <div style={{ minWidth: '140px' }}>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--n-text-secondary)' }}>Status</label>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'pending', label: 'Pending' },
                { value: 'completed', label: 'Completed' },
                { value: 'voided', label: 'Voided' },
                { value: 'overdue', label: '⚠ Overdue Credit' },
              ]}
            />
          </div>
          <div style={{ minWidth: '140px' }}>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--n-text-secondary)' }}>Fulfillment</label>
            <Select
              value={fulfillmentFilter}
              onChange={(e) => setFulfillmentFilter(e.target.value)}
              options={[
                { value: '', label: 'All Types' },
                { value: 'pickup', label: 'Pickup' },
                { value: 'delivery', label: 'Delivery' },
              ]}
            />
          </div>
          <div style={{ minWidth: '150px' }}>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--n-text-secondary)' }}>Payment Method</label>
            <Select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              options={[
                { value: '', label: 'All Methods' },
                { value: 'cash', label: 'Cash' },
                { value: 'card', label: 'Card' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'check', label: 'Check' },
                { value: 'credit', label: 'Credit' },
              ]}
            />
          </div>
          <div className="flex-1" style={{ minWidth: '180px' }}>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--n-text-secondary)' }}>Search</label>
            <div className="relative">
              <HiSearch className="absolute left-3 top-2.5 w-4 h-4" style={{ color: 'var(--n-text-dim)' }} />
              <input
                className="neu-inline-input w-full" style={{ paddingLeft: '2.25rem' }}
                placeholder="Transaction #, client name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="shrink-0">
            <button
              onClick={() => setExportPickerOpen(true)}
              className="neu-btn neu-btn-secondary"
              disabled={exporting || transactions.length === 0}
              style={{ padding: '0.625rem 1rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
            >
              <HiDocumentDownload className="w-4 h-4" />
              Export
            </button>
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
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Cashier</th>
                  <th className="text-right">Subtotal</th>
                  <th className="text-right">Discount</th>
                  <th className="text-right">Total</th>
                  <th>Notes</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => handleOpenView(tx)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="font-medium font-mono text-xs" onClick={(e) => e.stopPropagation()}>
                      {editingTxNumber === tx.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            className="neu-inline-input font-mono text-xs"
                            style={{ width: '10rem' }}
                            value={txNumberDraft}
                            onChange={(e) => setTxNumberDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveTxNumber(tx.id);
                              if (e.key === 'Escape') setEditingTxNumber(null);
                            }}
                            disabled={savingTxNumber}
                          />
                          <button
                            className="neu-btn-icon success"
                            title="Save"
                            onClick={() => handleSaveTxNumber(tx.id)}
                            disabled={savingTxNumber}
                          >
                            {savingTxNumber ? <Spinner size="sm" /> : <HiCheck className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            className="neu-btn-icon danger"
                            title="Cancel"
                            onClick={() => setEditingTxNumber(null)}
                            disabled={savingTxNumber}
                          >
                            <HiBan className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span
                          title="Click to edit transaction number"
                          style={{ cursor: 'text', borderBottom: '1px dashed var(--n-text-dim)', paddingBottom: 1 }}
                          onClick={() => { setEditingTxNumber(tx.id); setTxNumberDraft(tx.transaction_number); }}
                        >
                          {tx.transaction_number}
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--n-text-secondary)' }}>{new Date(tx.created_at).toLocaleString()}</td>
                    <td style={{ color: 'var(--n-text-secondary)' }}>{tx.client?.business_name || 'Walk-in'}</td>
                    <td>
                      <Badge variant={tx.fulfillment_type === 'delivery' ? 'info' : 'success'}>
                        {tx.fulfillment_type}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant={tx.status === 'completed' ? 'success' : tx.status === 'pending' ? 'warning' : tx.status === 'voided' ? 'danger' : 'neutral'}>
                          {tx.status}
                        </Badge>
                        {isTxOverdue(tx) && (
                          <Badge variant="danger">Overdue</Badge>
                        )}
                      </div>
                    </td>
                    <td style={{ color: 'var(--n-text-secondary)', textTransform: 'capitalize' }}>
                      {tx.payments?.map((p) => {
                        const label = p.payment_method.replace('_', ' ');
                        const due   = p.due_date ? ` (due ${p.due_date})` : '';
                        return label + due;
                      }).join(', ') || '—'}
                    </td>
                    <td style={{ color: 'var(--n-text-secondary)' }}>{tx.user?.name || 'Unknown'}</td>
                    <td className="text-right" style={{ color: 'var(--n-text-secondary)' }}>{tx.subtotal.toFixed(2)}</td>
                    <td className="text-right" style={{ color: 'var(--n-danger)' }}>{tx.discount_amount.toFixed(2)}</td>
                    <td className="text-right font-semibold">{tx.total_amount.toFixed(2)}</td>
                    <td
                      style={{ color: 'var(--n-text-secondary)', maxWidth: '160px' }}
                      title={tx.notes ?? undefined}
                    >
                      {tx.notes
                        ? <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.notes}</span>
                        : <span style={{ color: 'var(--n-text-dim)' }}>—</span>
                      }
                    </td>
                    <td className="text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {tx.status === 'pending' && (
                          <>
                            <button
                              onClick={() => openRecordPayment(tx)}
                              className="neu-btn-icon info"
                              title="Record Payment"
                            >
                              <HiCash className="w-4 h-4" />
                            </button>
                            {hasPendingCredit(tx) && (
                              <button
                                onClick={(e) => { e.stopPropagation(); openUpdateDueDate(tx); }}
                                className="neu-btn-icon warning"
                                title="Update Due Date"
                              >
                                <HiCalendar className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => setConfirmAction({ type: 'complete', transaction: tx })}
                              disabled={updatingId === tx.id}
                              className="neu-btn-icon success"
                              title="Mark as Completed"
                            >
                              {updatingId === tx.id ? <Spinner size="sm" /> : <HiCheck className="w-4 h-4" />}
                            </button>
                          </>
                        )}
                        {(tx.status === 'pending' || tx.status === 'completed') && (
                          <button
                            onClick={() => setConfirmAction({ type: 'void', transaction: tx })}
                            disabled={updatingId === tx.id}
                            className="neu-btn-icon danger"
                            title="Void Transaction"
                          >
                            <HiBan className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenView(tx)}
                          disabled={loadingView}
                          className="neu-btn-icon"
                          title="View Details"
                        >
                          <HiEye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handlePrintReceipt(tx.id)} className="neu-btn-icon info" title="Print Receipt">
                          <HiPrinter className="w-4 h-4" />
                        </button>
                        {tx.status !== 'voided' && (
                          <button
                            onClick={() => handleOpenEdit(tx)}
                            disabled={loadingEdit}
                            className="neu-btn-icon warning"
                            title="Edit Transaction"
                          >
                            <HiPencilAlt className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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

      {/* View Transaction Detail Modal */}
      {viewingTx && (
        <Modal
          isOpen={viewingTx !== null}
          onClose={() => setViewingTx(null)}
          title={`Transaction — ${viewingTx.transaction_number}`}
          width="xl"
        >
          {/* Info grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
            <TxInfoCard label="Client" value={viewingTx.client?.business_name || 'Walk-in'} />
            <TxInfoCard label="Status">
              <Badge variant={viewingTx.status === 'completed' ? 'success' : viewingTx.status === 'pending' ? 'warning' : viewingTx.status === 'voided' ? 'danger' : 'neutral'}>
                {viewingTx.status}
              </Badge>
            </TxInfoCard>
            <TxInfoCard label="Total Amount" value={`₱${viewingTx.total_amount.toFixed(2)}`} bold />
            <TxInfoCard label="Cashier" value={viewingTx.user?.name ?? '—'} />
            <TxInfoCard label="Type">
              <Badge variant={viewingTx.fulfillment_type === 'delivery' ? 'info' : 'success'}>
                {viewingTx.fulfillment_type}
              </Badge>
            </TxInfoCard>
            <TxInfoCard label="Date & Time" value={dayjs(viewingTx.created_at).format('MMM D, YYYY h:mm A')} />
          </div>

          {/* Payment rows */}
          {(viewingTx.payments ?? []).length > 0 && (() => {
            const allPayments = viewingTx.payments ?? [];
            // Build "For" labels
            const creditPayments = allPayments
              .filter(p => p.payment_method === 'credit')
              .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
            const isInstallmentSale = creditPayments.length > 1;

            const getCreditLabel = (p: typeof allPayments[0]) => {
              const idx = creditPayments.findIndex(c => c.id === p.id);
              if (isInstallmentSale) return `Installment ${idx + 1}`;
              return 'Credit (full)';
            };

            // Positional fallback: for legacy payments with no settles_payment_id,
            // match unlinked confirmed non-credit payments to confirmed credit installments
            // in order of the credit installment's due date.
            const unlinkedCollected = allPayments.filter(
              p => p.payment_method !== 'credit' && p.settles_payment_id == null
            );
            const confirmedInstallments = creditPayments.filter(c => c.status === 'confirmed');
            // Build a map: collected payment id → installment it positionally matches
            const positionalMap = new Map<number, typeof allPayments[0]>();
            if (unlinkedCollected.length > 0 && confirmedInstallments.length > 0) {
              // Only do positional match when the counts are equal and every amount matches
              const amountsSorted = [...unlinkedCollected].map(p => p.amount).sort((a,b) => a-b);
              const installAmountsSorted = [...confirmedInstallments].map(c => c.amount).sort((a,b) => a-b);
              const allMatch = amountsSorted.length === installAmountsSorted.length &&
                amountsSorted.every((a, i) => Math.abs(a - installAmountsSorted[i]) < 0.01);
              if (allMatch) {
                // Sort both by amount then by id (stable ordering)
                const sortedCollected = [...unlinkedCollected].sort((a,b) => a.amount - b.amount || a.id - b.id);
                const sortedInstallments = [...confirmedInstallments].sort((a,b) => a.amount - b.amount || (a.due_date ?? '').localeCompare(b.due_date ?? ''));
                sortedCollected.forEach((cp, i) => positionalMap.set(cp.id, sortedInstallments[i]));
              }
            }

            const getPaymentLabel = (p: typeof allPayments[0]) => {
              // Credit entries label themselves
              if (p.payment_method === 'credit') return getCreditLabel(p);
              // Collected payments linked to a specific installment (new data with settles_payment_id)
              if (p.settles_payment_id != null) {
                const settled = creditPayments.find(c => c.id === p.settles_payment_id);
                if (settled) {
                  const idx = creditPayments.indexOf(settled);
                  return isInstallmentSale ? `Installment ${idx + 1}` : 'Credit (full)';
                }
              }
              // Legacy data: use positional match if available
              if (positionalMap.has(p.id)) {
                const matched = positionalMap.get(p.id)!;
                const idx = creditPayments.indexOf(matched);
                return isInstallmentSale ? `Installment ${idx + 1}` : 'Credit (full)';
              }
              // Final fallback: down payment (no installments) or generic collection
              const saleDate = viewingTx.created_at?.slice(0, 10);
              const isOriginalPayment = p.paid_at?.slice(0, 10) === saleDate || p.paid_at === null;
              if (isOriginalPayment && creditPayments.length === 0) return 'Down Payment';
              return creditPayments.length > 0 ? 'Full Settlement' : 'Payment Collected';
            };
            return (
              <div className="mb-5 rounded-lg overflow-hidden border border-[var(--n-divider)]">
                <table className="neu-table">
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>For</th>
                      <th className="text-right">Amount</th>
                      <th>Reference #</th>
                      <th>Due Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPayments.map((p) => (
                      <>
                        <tr key={p.id}>
                          <td style={{ textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                            {p.payment_method.replace(/_/g, ' ')}
                          </td>
                          <td style={{ color: 'var(--n-text-secondary)', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                            {getPaymentLabel(p)}
                          </td>
                          <td className="text-right font-semibold">₱{p.amount.toFixed(2)}</td>
                          <td style={{ color: 'var(--n-text-secondary)' }}>{p.reference_number || '—'}</td>
                          <td style={{
                            color: p.due_date && p.due_date < localDateStr() && p.status === 'pending'
                              ? 'var(--n-danger)'
                              : p.due_date ? 'var(--n-accent)' : 'var(--n-text-dim)',
                            fontWeight: p.due_date ? 600 : 400,
                            whiteSpace: 'nowrap',
                          }}>
                            {p.due_date ?? '—'}
                            {p.due_date && p.due_date < localDateStr() && p.status === 'pending' && ' ⚠'}
                          </td>
                          <td>
                            <Badge variant={p.status === 'confirmed' ? 'success' : p.status === 'pending' ? 'warning' : 'danger'}>
                              {p.status}
                            </Badge>
                          </td>
                        </tr>
                        {p.notes && (
                          <tr key={`${p.id}-notes`} style={{ background: 'var(--n-input-bg)' }}>
                            <td colSpan={6} style={{ padding: '4px 12px 6px', fontSize: '0.78rem', color: 'var(--n-text-secondary)', borderTop: 'none' }}>
                              <span style={{ color: 'var(--n-text-dim)', marginRight: 6, fontStyle: 'italic' }}>Note:</span>
                              {p.notes}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Notes */}
          {viewingTx.notes && (
            <div
              className="mb-5 px-3 py-2.5 rounded-lg text-sm"
              style={{ background: 'var(--n-input-bg)', color: 'var(--n-text-secondary)' }}
            >
              <span className="font-semibold" style={{ color: 'var(--n-text)' }}>Notes: </span>
              {viewingTx.notes}
            </div>
          )}

          {/* Line items table */}
          <div className="border border-[var(--n-divider)] rounded-lg overflow-hidden mb-5">
            <table className="neu-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-center">Qty</th>
                  <th className="text-right">Unit Price</th>
                  <th className="text-right">Discount</th>
                  <th className="text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {(viewingTx.items ?? []).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="font-medium">{item.product?.name ?? `Product #${item.product_id}`}</span>
                      <span className="block text-xs font-mono" style={{ color: 'var(--n-text-dim)' }}>{item.product?.sku ?? ''}</span>
                    </td>
                    <td className="text-center" style={{ color: 'var(--n-text-secondary)' }}>{item.quantity}</td>
                    <td className="text-right">₱{item.unit_price.toFixed(2)}</td>
                    <td className="text-right" style={{ color: 'var(--n-danger)' }}>
                      {item.discount > 0 ? `-₱${item.discount.toFixed(2)}` : '—'}
                    </td>
                    <td className="text-right font-semibold">₱{item.line_total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial summary */}
          <div
            className="rounded-lg p-3 space-y-1.5 text-sm mb-5"
            style={{ background: 'var(--n-surface-raised, var(--n-input-bg))' }}
          >
            <div className="flex justify-between">
              <span style={{ color: 'var(--n-text-secondary)' }}>Subtotal</span>
              <span>₱{viewingTx.subtotal.toFixed(2)}</span>
            </div>
            {viewingTx.discount_amount > 0 && (
              <div className="flex justify-between" style={{ color: 'var(--n-danger)' }}>
                <span>Discount</span>
                <span>-₱{viewingTx.discount_amount.toFixed(2)}</span>
              </div>
            )}
            {viewingTx.delivery_fee > 0 && (
              <div className="flex justify-between" style={{ color: 'var(--n-text-secondary)' }}>
                <span>Delivery Fee</span>
                <span>₱{viewingTx.delivery_fee.toFixed(2)}</span>
              </div>
            )}
            {viewingTx.tax_amount > 0 && (
              <div className="flex justify-between" style={{ color: 'var(--n-info)' }}>
                <span>VAT / Sales Tax</span>
                <span>+₱{viewingTx.tax_amount.toFixed(2)}</span>
              </div>
            )}
            <div
              className="flex justify-between font-bold text-base pt-1.5"
              style={{ borderTop: '1px solid var(--n-divider)', fontFamily: 'var(--n-font-display)' }}
            >
              <span>TOTAL</span>
              <span style={{ color: 'var(--n-accent)' }}>₱{viewingTx.total_amount.toFixed(2)}</span>
            </div>
            {(viewingTx.total_paid ?? 0) > 0 && (
              <>
                <div className="flex justify-between text-green-700 font-medium">
                  <span>Paid</span>
                  <span>₱{(viewingTx.total_paid ?? 0).toFixed(2)}</span>
                </div>
                {(viewingTx.balance_due ?? 0) > 0 && (
                  <div className="flex justify-between font-semibold" style={{ color: 'var(--n-danger)' }}>
                    <span>Balance Due</span>
                    <span>₱{(viewingTx.balance_due ?? 0).toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex justify-between items-center pt-2 border-t border-[var(--n-divider)]">
            <Button variant="secondary" onClick={() => handlePrintReceipt(viewingTx.id)}>
              <HiPrinter className="w-4 h-4 mr-2" /> Print Receipt
            </Button>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setViewingTx(null)}>Close</Button>
              {viewingTx.status === 'pending' && (viewingTx.balance_due ?? 0) > 0 && (
                <>
                  {hasPendingCredit(viewingTx) && (
                    <Button
                      variant="outline"
                      onClick={() => { setViewingTx(null); openUpdateDueDate(viewingTx); }}
                    >
                      <HiCalendar className="w-4 h-4 mr-2" /> Update Due Date
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    onClick={() => { setViewingTx(null); openRecordPayment(viewingTx); }}
                  >
                    <HiCash className="w-4 h-4 mr-2" /> Record Payment
                  </Button>
                </>
              )}
              {viewingTx.status !== 'voided' && (
                <Button
                  variant="amber"
                  onClick={() => { setViewingTx(null); handleOpenEdit(viewingTx); }}
                >
                  <HiPencilAlt className="w-4 h-4 mr-2" /> Edit
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Transaction Modal */}
      <Modal
        isOpen={editingTx !== null}
        onClose={() => !saving && setEditingTx(null)}
        title={`Edit Transaction — ${editingTx?.transaction_number ?? ''}`}
        width="xl"
      >
        {editingTx && (() => {
          const totals = getEditTotals();
          return (
            <div className="space-y-5">
              {editingTx.status === 'completed' && (
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                  style={{ background: 'var(--n-warning-glow, #fef9c3)', color: '#92400e' }}
                >
                  <HiExclamation className="w-4 h-4 shrink-0" />
                  Editing a completed transaction will automatically reverse and re-post its journal entries.
                </div>
              )}

              {/* Items table */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--n-text-secondary)' }}>Line Items</p>
                <div className="overflow-x-auto">
                  <table className="neu-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="text-center">Qty</th>
                        <th className="text-right">Unit Price</th>
                        <th className="text-right">Discount</th>
                        <th className="text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editItems.map((item, idx) => {
                        const up   = parseFloat(item.unit_price) || 0;
                        const disc = parseFloat(item.discount) || 0;
                        const lt   = Math.max(0, up * item.quantity - disc);
                        return (
                          <tr key={item.id}>
                            <td>
                              <span className="font-medium">{item.product_name}</span>
                              <span className="block text-xs font-mono" style={{ color: 'var(--n-text-dim)' }}>{item.sku}</span>
                            </td>
                            <td className="text-center" style={{ color: 'var(--n-text-secondary)' }}>{item.quantity}</td>
                            <td className="text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="neu-inline-input text-right"
                                style={{ width: '7rem' }}
                                value={item.unit_price}
                                onChange={(e) => setEditItems((prev) =>
                                  prev.map((it, i) => i === idx ? { ...it, unit_price: e.target.value } : it)
                                )}
                              />
                            </td>
                            <td className="text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="neu-inline-input text-right"
                                style={{ width: '6rem' }}
                                value={item.discount}
                                onChange={(e) => setEditItems((prev) =>
                                  prev.map((it, i) => i === idx ? { ...it, discount: e.target.value } : it)
                                )}
                              />
                            </td>
                            <td className="text-right font-semibold">{lt.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--n-text-secondary)' }}>
                  Notes <span style={{ fontWeight: 400, textTransform: 'none' }}>(e.g. bank name, reference #)</span>
                </label>
                <textarea
                  className="neu-inline-input w-full"
                  style={{ minHeight: '3.5rem', resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="e.g. BDO Transfer — Ref# 20260407-1234"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  maxLength={1000}
                />
              </div>

              {/* Totals summary */}
              <div
                className="rounded-lg p-3 space-y-1 text-sm"
                style={{ background: 'var(--n-surface-raised, var(--n-surface))' }}
              >
                <div className="flex justify-between">
                  <span style={{ color: 'var(--n-text-secondary)' }}>Subtotal</span>
                  <span>{totals.subtotal.toFixed(2)}</span>
                </div>
                {totals.discountTotal > 0 && (
                  <div className="flex justify-between" style={{ color: 'var(--n-danger)' }}>
                    <span>Total Discount</span>
                    <span>-{totals.discountTotal.toFixed(2)}</span>
                  </div>
                )}
                {totals.deliveryFee > 0 && (
                  <div className="flex justify-between" style={{ color: 'var(--n-text-secondary)' }}>
                    <span>Delivery Fee</span>
                    <span>{totals.deliveryFee.toFixed(2)}</span>
                  </div>
                )}
                <div
                  className="flex justify-between font-bold text-base pt-1"
                  style={{ borderTop: '1px solid var(--n-divider)', fontFamily: 'var(--n-font-display)' }}
                >
                  <span>TOTAL</span>
                  <span className="text-amber-dark">{totals.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <Button variant="secondary" className="flex-1" onClick={() => setEditingTx(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button variant="amber" className="flex-1" onClick={handleSaveEdit} loading={saving}>
                  Save Changes
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.type === 'void' ? 'Void Transaction' : 'Mark as Completed'}
        width="sm"
      >
        {confirmAction && (
          <div className="text-center space-y-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
              style={{ background: confirmAction.type === 'void' ? 'var(--n-danger-glow, #fee2e2)' : 'var(--n-success-glow)' }}
            >
              <HiExclamation className="w-7 h-7" style={{ color: confirmAction.type === 'void' ? 'var(--n-danger)' : 'var(--n-success)' }} />
            </div>
            <div>
              <p className="font-semibold text-base">{confirmAction.transaction.transaction_number}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--n-text-secondary)' }}>
                {confirmAction.type === 'void'
                  ? 'This will void the transaction and reverse all inventory and journal entries. This cannot be undone.'
                  : 'This will mark the transaction as completed and confirm the pending payment.'}
              </p>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="secondary" onClick={() => setConfirmAction(null)}>Cancel</Button>
              <Button
                variant={confirmAction.type === 'void' ? 'danger' : 'amber'}
                onClick={() =>
                  confirmAction.type === 'void'
                    ? handleVoidSale(confirmAction.transaction.id)
                    : handleMarkCompleted(confirmAction.transaction.id)
                }
                loading={updatingId === confirmAction.transaction.id}
              >
                {confirmAction.type === 'void' ? 'Yes, Void It' : 'Yes, Mark Completed'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        isOpen={recordingPaymentTx !== null}
        onClose={() => !rpSaving && setRecordingPaymentTx(null)}
        title="Record Payment"
        width="sm"
      >
        {recordingPaymentTx && (() => {
          const pendingCredits = (recordingPaymentTx.payments ?? [])
            .filter(p => p.payment_method === 'credit' && p.status === 'pending')
            .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
          const isInstallmentSale = pendingCredits.length > 1;
          const today = localDateStr();

          const handleTargetChange = (target: 'full' | number) => {
            setRpTarget(target);
            if (target === 'full') {
              setRpAmount((recordingPaymentTx.balance_due ?? 0).toFixed(2));
            } else {
              const inst = pendingCredits.find(p => p.id === target);
              if (inst) setRpAmount(inst.amount.toFixed(2));
            }
          };

          return (
            <div className="space-y-4">
              {/* Transaction summary */}
              <div className="rounded-lg p-3 space-y-1 text-sm" style={{ background: 'var(--n-input-bg)' }}>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--n-text-secondary)' }}>Transaction</span>
                  <span className="font-mono font-semibold">{recordingPaymentTx.transaction_number}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--n-text-secondary)' }}>Total Amount</span>
                  <span>₱{recordingPaymentTx.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--n-text-secondary)' }}>Already Paid</span>
                  <span className="text-green-700">₱{(recordingPaymentTx.total_paid ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold pt-1" style={{ borderTop: '1px solid var(--n-divider)' }}>
                  <span style={{ color: 'var(--n-danger)' }}>Balance Due</span>
                  <span style={{ color: 'var(--n-danger)' }}>₱{(recordingPaymentTx.balance_due ?? 0).toFixed(2)}</span>
                </div>
              </div>

              {/* ── Installment / Payment target selector ── */}
              {isInstallmentSale ? (
                <div>
                  <label className="neu-label">What is being paid?</label>
                  <div className="space-y-2">
                    {pendingCredits.map((p, idx) => {
                      const overdue = p.due_date && p.due_date < today;
                      const selected = rpTarget === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleTargetChange(p.id)}
                          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-left transition-all"
                          style={{
                            background: selected ? 'var(--n-primary-glow, rgba(27,58,92,0.15))' : 'var(--n-input-bg)',
                            border: selected ? '2px solid var(--n-primary)' : '2px solid var(--n-border)',
                          }}
                        >
                          <span
                            className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                            style={{
                              borderColor: selected ? 'var(--n-primary)' : 'var(--n-border)',
                              background: selected ? 'var(--n-primary)' : 'transparent',
                            }}
                          >
                            {selected && <span className="w-2 h-2 rounded-full bg-white block" />}
                          </span>
                          <span className="flex-1">
                            <span className="font-semibold">Installment {idx + 1}</span>
                            {overdue && (
                              <span className="ml-2 text-xs font-bold" style={{ color: 'var(--n-danger)' }}>⚠ OVERDUE</span>
                            )}
                            <span className="block text-xs mt-0.5" style={{ color: 'var(--n-text-secondary)' }}>
                              Due {p.due_date ?? '—'}
                            </span>
                          </span>
                          <span className="font-bold" style={{ color: overdue ? 'var(--n-danger)' : 'var(--n-accent)' }}>
                            ₱{p.amount.toFixed(2)}
                          </span>
                        </button>
                      );
                    })}
                    {/* Pay in full option */}
                    <button
                      type="button"
                      onClick={() => handleTargetChange('full')}
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-left transition-all"
                      style={{
                        background: rpTarget === 'full' ? 'var(--n-primary-glow, rgba(27,58,92,0.15))' : 'var(--n-input-bg)',
                        border: rpTarget === 'full' ? '2px solid var(--n-primary)' : '2px solid var(--n-border)',
                      }}
                    >
                      <span
                        className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                        style={{
                          borderColor: rpTarget === 'full' ? 'var(--n-primary)' : 'var(--n-border)',
                          background: rpTarget === 'full' ? 'var(--n-primary)' : 'transparent',
                        }}
                      >
                        {rpTarget === 'full' && <span className="w-2 h-2 rounded-full bg-white block" />}
                      </span>
                      <span className="flex-1">
                        <span className="font-semibold">Pay Full Balance</span>
                        <span className="block text-xs mt-0.5" style={{ color: 'var(--n-text-secondary)' }}>
                          Settles all remaining installments at once
                        </span>
                      </span>
                      <span className="font-bold" style={{ color: 'var(--n-success)' }}>
                        ₱{(recordingPaymentTx.balance_due ?? 0).toFixed(2)}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Single credit — show due date info only */
                pendingCredits.length === 1 && (
                  <div className="rounded-lg p-3 text-sm"
                    style={{ background: 'var(--n-surface-raised, var(--n-surface))', border: '1px solid var(--n-accent)' }}>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--n-text-secondary)' }}>Due Date</span>
                      <span style={{
                        fontWeight: 600,
                        color: pendingCredits[0].due_date && pendingCredits[0].due_date < today
                          ? 'var(--n-danger)' : 'var(--n-text)',
                      }}>
                        {pendingCredits[0].due_date ?? '—'}
                        {pendingCredits[0].due_date && pendingCredits[0].due_date < today ? ' ⚠ OVERDUE' : ''}
                      </span>
                    </div>
                  </div>
                )
              )}

              {/* Payment method */}
              <Select
                label="Payment Method"
                value={rpMethod}
                onChange={(e) => setRpMethod(e.target.value)}
                options={[
                  { value: 'cash', label: 'Cash' },
                  { value: 'card', label: 'Card' },
                  { value: 'bank_transfer', label: 'Bank Transfer' },
                  { value: 'check', label: 'Check' },
                  { value: 'business_bank', label: 'Business Bank' },
                ]}
              />

              {/* Amount — editable but pre-filled from selection */}
              <Input
                label="Amount"
                type="number"
                min="0.01"
                step="0.01"
                max={(recordingPaymentTx.balance_due ?? 0).toFixed(2)}
                value={rpAmount}
                onChange={(e) => setRpAmount(e.target.value)}
                placeholder="0.00"
              />

              {/* Reference number */}
              {(rpMethod === 'bank_transfer' || rpMethod === 'check' || rpMethod === 'business_bank') && (
                <Input
                  label="Reference Number"
                  value={rpReference}
                  onChange={(e) => setRpReference(e.target.value)}
                  placeholder="e.g. BDO Transfer Ref# 12345"
                />
              )}

              {/* Notes */}
              <div>
                <label className="neu-label">
                  Notes <span style={{ color: 'var(--n-text-dim)', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  className="neu-inline-input w-full"
                  style={{ minHeight: '2.5rem', resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="e.g. Check no. 0012, partial payment per agreement"
                  value={rpNotes}
                  onChange={(e) => setRpNotes(e.target.value)}
                  maxLength={500}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-2">
                <Button variant="secondary" onClick={() => setRecordingPaymentTx(null)}>Cancel</Button>
                <Button
                  variant="primary"
                  onClick={handleRecordPayment}
                  loading={rpSaving}
                  disabled={!rpAmount || parseFloat(rpAmount) <= 0}
                >
                  <HiCash className="w-4 h-4 mr-2" /> Record Payment
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Update Credit Due Date Modal */}
      <Modal
        isOpen={updateDueDateTx !== null}
        onClose={() => !dueDateSaving && setUpdateDueDateTx(null)}
        title="Update Payment Due Date"
        width="sm"
      >
        {updateDueDateTx && (() => {
          const creditPayments = (updateDueDateTx.payments ?? [])
            .filter(p => p.payment_method === 'credit' && p.status === 'pending');
          return (
            <div className="space-y-4">
              <div className="rounded-lg p-3 text-sm" style={{ background: 'var(--n-input-bg)' }}>
                <div className="flex justify-between mb-1">
                  <span style={{ color: 'var(--n-text-secondary)' }}>Transaction</span>
                  <span className="font-mono font-semibold">{updateDueDateTx.transaction_number}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--n-text-secondary)' }}>Outstanding</span>
                  <span style={{ color: 'var(--n-danger)', fontWeight: 700 }}>₱{(updateDueDateTx.balance_due ?? 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-3">
                {creditPayments.map((p, idx) => (
                  <div key={p.id}>
                    {creditPayments.length > 1 && (
                      <p className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--n-text-secondary)' }}>
                        Installment {idx + 1} — ₱{p.amount.toFixed(2)}
                      </p>
                    )}
                    <DatePicker
                      label={creditPayments.length === 1
                        ? `New Due Date (current: ${p.due_date ?? 'not set'})`
                        : `Due Date (current: ${p.due_date ?? 'not set'})`
                      }
                      value={updatedDueDates[p.id] ?? p.due_date ?? ''}
                      onChange={(e) => setUpdatedDueDates(prev => ({ ...prev, [p.id]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button variant="secondary" onClick={() => setUpdateDueDateTx(null)}>Cancel</Button>
                <Button variant="amber" onClick={handleUpdateDueDates} loading={dueDateSaving}>
                  <HiCalendar className="w-4 h-4 mr-2" /> Save Changes
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Export Column Picker */}
      <ExportColumnPickerModal
        isOpen={exportPickerOpen}
        onClose={() => setExportPickerOpen(false)}
        exportKey="transactions"
        formats={['pdf', 'csv', 'xlsx']}
        onExport={handleExport}
        exporting={exporting}
      />
    </div>
  );
}

/* ── Helper component used inside the view detail modal ── */
function TxInfoCard({ label, value, bold, children }: {
  label: string; value?: string; bold?: boolean; children?: import('react').ReactNode;
}) {
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: 'var(--n-input-bg)' }}>
      <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--n-text-secondary)' }}>{label}</p>
      {children ?? (
        <p className={`text-sm ${bold ? 'font-bold' : ''}`} style={{ color: bold ? 'var(--n-text)' : 'var(--n-text)' }}>{value}</p>
      )}
    </div>
  );
}
