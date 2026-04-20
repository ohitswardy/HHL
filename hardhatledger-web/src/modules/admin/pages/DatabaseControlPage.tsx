import { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Spinner } from '../../../components/ui/Spinner';
import { Badge } from '../../../components/ui/Badge';
import { HiDatabase, HiExclamation, HiTrash, HiClock, HiCheckCircle, HiShieldExclamation, HiChevronRight } from 'react-icons/hi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import type { EligibleMonth, PurgePreview, DataPurgeLog } from '../../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMonth(year: number, month: number): string {
  return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DatabaseControlPage() {
  const [eligibleMonths, setEligibleMonths] = useState<EligibleMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<EligibleMonth | null>(null);
  const [preview, setPreview] = useState<PurgePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [purgeNotes, setPurgeNotes] = useState('');
  const [executing, setExecuting] = useState(false);
  const [historyModal, setHistoryModal] = useState(false);
  const [history, setHistory] = useState<DataPurgeLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyMeta, setHistoryMeta] = useState<{ current_page: number; last_page: number; total: number }>({ current_page: 1, last_page: 1, total: 0 });

  useEffect(() => {
    fetchEligibleMonths();
  }, []);

  const fetchEligibleMonths = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/database-control/eligible-months');
      setEligibleMonths(data.data);
    } catch {
      toast.error('Failed to load eligible months');
    } finally {
      setLoading(false);
    }
  };

  const handleMonthSelect = async (month: EligibleMonth) => {
    if (month.already_purged) return;
    setSelectedMonth(month);
    setPreview(null);
    setPreviewLoading(true);
    try {
      const { data } = await api.post('/database-control/preview', { year: month.year, month: month.month });
      setPreview(data.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load preview');
      setSelectedMonth(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExecutePurge = async () => {
    if (confirmText !== 'PURGE' || !selectedMonth) return;
    setExecuting(true);
    try {
      await api.post('/database-control/execute', {
        year: selectedMonth.year,
        month: selectedMonth.month,
        confirmation: 'PURGE',
        notes: purgeNotes || null,
      });
      toast.success(`Data for ${selectedMonth.label} has been permanently purged.`);
      setConfirmModal(false);
      setConfirmText('');
      setPurgeNotes('');
      setSelectedMonth(null);
      setPreview(null);
      fetchEligibleMonths();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Purge operation failed');
    } finally {
      setExecuting(false);
    }
  };

  const fetchHistory = async (page = 1) => {
    setHistoryLoading(true);
    try {
      const { data } = await api.get('/database-control/history', { params: { per_page: 10, page } });
      setHistory(data.data);
      setHistoryMeta({ current_page: data.current_page, last_page: data.last_page, total: data.total });
    } catch {
      toast.error('Failed to load purge history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistory = () => {
    setHistoryModal(true);
    fetchHistory(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)' }}
          >
            <HiDatabase className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--n-text)', fontFamily: 'var(--n-font-display)' }}>
              Database Control
            </h1>
            <p className="text-sm" style={{ color: 'var(--n-text-dim)' }}>
              Permanently purge past monthly transaction data
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={openHistory}>
          <HiClock className="w-4 h-4 mr-2" />
          Purge History
        </Button>
      </div>

      {/* ── Warning Banner ────────────────────────────────────────────── */}
      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{
          background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, rgba(234, 179, 8, 0.03) 100%)',
          border: '1px solid rgba(234, 179, 8, 0.25)',
        }}
      >
        <HiShieldExclamation className="w-6 h-6 shrink-0 mt-0.5" style={{ color: '#d97706' }} />
        <div>
          <p className="font-semibold text-sm" style={{ color: '#d97706' }}>Destructive Operation — Irreversible</p>
          <p className="text-sm mt-1" style={{ color: 'var(--n-text-dim)' }}>
            Purging permanently deletes transaction data, purchase orders, and accounting records for the selected month.
            This action cannot be undone. Only months older than 1 month are eligible.
          </p>
        </div>
      </div>

      {/* ── Main Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Month Selector (left) ───────────────────────────────────── */}
        <div className="lg:col-span-2">
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--n-border)' }}>
              <h2 className="font-semibold text-sm" style={{ color: 'var(--n-text)' }}>Select Month to Purge</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--n-text-dim)' }}>Only months 1+ month old shown</p>
            </div>
            <div className="max-h-[460px] overflow-y-auto">
              {eligibleMonths.map((m) => {
                const isSelected = selectedMonth?.year === m.year && selectedMonth?.month === m.month;
                return (
                  <button
                    key={`${m.year}-${m.month}`}
                    onClick={() => handleMonthSelect(m)}
                    disabled={m.already_purged}
                    className="w-full flex items-center justify-between px-5 py-3 text-left transition-all duration-150"
                    style={{
                      background: isSelected
                        ? 'var(--n-accent-glow)'
                        : 'transparent',
                      borderBottom: '1px solid var(--n-border)',
                      opacity: m.already_purged ? 0.5 : 1,
                      cursor: m.already_purged ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <span className="flex items-center gap-3">
                      {m.already_purged ? (
                        <HiCheckCircle className="w-4 h-4" style={{ color: '#16a34a' }} />
                      ) : (
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            border: isSelected ? '4px solid var(--n-accent)' : '2px solid var(--n-border-strong)',
                            background: isSelected ? 'var(--n-accent)' : 'transparent',
                          }}
                        />
                      )}
                      <span className="text-sm font-medium" style={{ color: 'var(--n-text)' }}>{m.label}</span>
                    </span>
                    {m.already_purged ? (
                      <Badge variant="success">Purged</Badge>
                    ) : (
                      <HiChevronRight className="w-4 h-4" style={{ color: 'var(--n-text-dim)' }} />
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ── Preview Panel (right) ───────────────────────────────────── */}
        <div className="lg:col-span-3">
          {!selectedMonth && !previewLoading && (
            <Card className="flex flex-col items-center justify-center py-16">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'var(--n-surface-raised)', border: '2px dashed var(--n-border)' }}
              >
                <HiDatabase className="w-7 h-7" style={{ color: 'var(--n-text-dim)' }} />
              </div>
              <p className="font-medium" style={{ color: 'var(--n-text-dim)' }}>Select a month to preview</p>
              <p className="text-sm mt-1" style={{ color: 'var(--n-text-dim)' }}>
                Choose from the list to see what data will be removed
              </p>
            </Card>
          )}

          {previewLoading && (
            <Card className="flex items-center justify-center py-20">
              <Spinner />
              <span className="ml-3 text-sm" style={{ color: 'var(--n-text-dim)' }}>Calculating records...</span>
            </Card>
          )}

          {preview && !previewLoading && (
            <Card className="p-0 overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--n-border)', background: 'var(--n-surface-raised)' }}>
                <div>
                  <h2 className="font-semibold" style={{ color: 'var(--n-text)' }}>
                    Purge Preview — {preview.month_label}
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--n-text-dim)' }}>
                    Total records to be permanently deleted
                  </p>
                </div>
                <div
                  className="px-3 py-1.5 rounded-lg font-bold text-lg"
                  style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626' }}
                >
                  {preview.total_records.toLocaleString()}
                </div>
              </div>

              <div className="p-5 space-y-3">
                {/* Transaction Data */}
                <div className="rounded-lg p-4" style={{ background: 'var(--n-surface-raised)', border: '1px solid var(--n-border)' }}>
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--n-text)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: '#3b82f6' }} />
                    Transaction Data
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <StatBox label="Sales" value={preview.sales_transactions} />
                    <StatBox label="Sale Items" value={preview.sale_items} />
                    <StatBox label="Payments" value={preview.payments} />
                  </div>
                </div>

                {/* Purchase Orders */}
                <div className="rounded-lg p-4" style={{ background: 'var(--n-surface-raised)', border: '1px solid var(--n-border)' }}>
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--n-text)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: '#8b5cf6' }} />
                    Purchase Orders
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <StatBox label="Orders" value={preview.purchase_orders} />
                    <StatBox label="Line Items" value={preview.po_items} />
                  </div>
                </div>

                {/* Accounting */}
                <div className="rounded-lg p-4" style={{ background: 'var(--n-surface-raised)', border: '1px solid var(--n-border)' }}>
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--n-text)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />
                    Accounting Data
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <StatBox label="Journal Entries" value={preview.journal_entries} />
                    <StatBox label="Journal Lines" value={preview.journal_lines} />
                    <StatBox label="Expenses" value={preview.expenses} />
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="px-5 py-4 flex justify-end" style={{ borderTop: '1px solid var(--n-border)', background: 'var(--n-surface-raised)' }}>
                <Button
                  variant="danger"
                  onClick={() => setConfirmModal(true)}
                  disabled={preview.total_records === 0}
                >
                  <HiTrash className="w-4 h-4 mr-2" />
                  Purge {preview.month_label}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* ── Confirmation Modal ────────────────────────────────────────── */}
      <Modal isOpen={confirmModal} onClose={() => { setConfirmModal(false); setConfirmText(''); setPurgeNotes(''); }} title="Confirm Data Purge" width="md">
        <div className="space-y-5">
          <div
            className="rounded-lg p-4 flex items-start gap-3"
            style={{ background: 'rgba(220, 38, 38, 0.06)', border: '1px solid rgba(220, 38, 38, 0.2)' }}
          >
            <HiExclamation className="w-6 h-6 shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
            <div>
              <p className="font-semibold text-sm" style={{ color: '#dc2626' }}>This action is permanent and irreversible</p>
              <p className="text-sm mt-1" style={{ color: 'var(--n-text-dim)' }}>
                You are about to permanently delete <strong>{preview?.total_records.toLocaleString()}</strong> records
                from <strong>{preview?.month_label}</strong>. This data cannot be recovered.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--n-text)' }}>
              Notes (optional)
            </label>
            <textarea
              className="neu-input w-full"
              rows={2}
              placeholder="Reason for purging..."
              value={purgeNotes}
              onChange={(e) => setPurgeNotes(e.target.value)}
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--n-text)' }}>
              Type <span className="font-mono font-bold" style={{ color: '#dc2626' }}>PURGE</span> to confirm
            </label>
            <input
              type="text"
              className="neu-input w-full font-mono text-center text-lg tracking-widest"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="Type PURGE"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => { setConfirmModal(false); setConfirmText(''); setPurgeNotes(''); }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleExecutePurge}
              disabled={confirmText !== 'PURGE' || executing}
              loading={executing}
            >
              <HiTrash className="w-4 h-4 mr-1" />
              Permanently Delete Data
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── History Modal ─────────────────────────────────────────────── */}
      <Modal isOpen={historyModal} onClose={() => setHistoryModal(false)} title="Purge History" width="xl">
        {historyLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <HiClock className="w-12 h-12 mb-3" style={{ color: 'var(--n-text-dim)' }} />
            <p className="font-medium" style={{ color: 'var(--n-text-dim)' }}>No purge history yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--n-border)' }}>
                    <th className="text-left py-2 px-3 font-semibold" style={{ color: 'var(--n-text-dim)' }}>Month</th>
                    <th className="text-left py-2 px-3 font-semibold" style={{ color: 'var(--n-text-dim)' }}>Purged By</th>
                    <th className="text-right py-2 px-3 font-semibold" style={{ color: 'var(--n-text-dim)' }}>Records</th>
                    <th className="text-left py-2 px-3 font-semibold" style={{ color: 'var(--n-text-dim)' }}>Date</th>
                    <th className="text-left py-2 px-3 font-semibold" style={{ color: 'var(--n-text-dim)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((log) => {
                    const total = log.sales_purged + log.sale_items_purged + log.payments_purged
                      + log.purchase_orders_purged + log.po_items_purged
                      + log.journal_entries_purged + log.journal_lines_purged + log.expenses_purged;
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--n-border)' }}>
                        <td className="py-2.5 px-3 font-medium" style={{ color: 'var(--n-text)' }}>
                          {formatMonth(log.purge_year, log.purge_month)}
                        </td>
                        <td className="py-2.5 px-3" style={{ color: 'var(--n-text-dim)' }}>
                          {log.user?.name || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold" style={{ color: '#dc2626' }}>
                          {total.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3" style={{ color: 'var(--n-text-dim)' }}>
                          {formatDate(log.created_at)}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant={log.status === 'completed' ? 'success' : 'danger'}>
                            {log.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {historyMeta.last_page > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs" style={{ color: 'var(--n-text-dim)' }}>
                  Total: {historyMeta.total} records
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={historyMeta.current_page <= 1}
                    onClick={() => fetchHistory(historyMeta.current_page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={historyMeta.current_page >= historyMeta.last_page}
                    onClick={() => fetchHistory(historyMeta.current_page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center rounded-md py-2 px-2" style={{ background: 'var(--n-surface)' }}>
      <p className="text-lg font-bold font-mono" style={{ color: 'var(--n-text)' }}>
        {value.toLocaleString()}
      </p>
      <p className="text-xs" style={{ color: 'var(--n-text-dim)' }}>{label}</p>
    </div>
  );
}
