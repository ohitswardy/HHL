import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Spinner } from '../../../components/ui/Spinner';
import api from '../../../lib/api';
import { HiPlus, HiPencil, HiTrash, HiDownload, HiPrinter, HiDocumentDuplicate, HiSearch, HiX, HiBookOpen, HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import type { ChartOfAccount } from '../../../types';
import dayjs from 'dayjs';

/* ═══════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════ */

const TYPE_OPTIONS: { value: ChartOfAccount['type']; label: string }[] = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'expense', label: 'Expense' },
];

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: 'Current assets BAL',
  liability: 'Current liabilities BAL',
  equity: "Owner's equity BAL",
  revenue: 'Income P&L',
  expense: 'Expenses P&L',
};

const DETAIL_TYPE_SUGGESTIONS: Record<string, string[]> = {
  asset: [
    'Bank', 'Cash and cash equivalents', 'Accounts Receivable (A/R)',
    'Allowance for bad debts', 'Inventory', 'Prepaid Expenses',
    'Assets available for sale', 'Undeposited Funds',
    'Land', 'Accumulated depreciation on property, plant and equipment',
    'Long-term investments', 'Intangible Assets', 'Goodwill', 'Deferred tax',
    'Assets held for sale',
  ],
  liability: [
    'Accounts payable', 'Accrued liabilities', 'Sales and service tax payable',
    'Income tax payable', 'Dividends payable', 'Other current liabilities',
    'Current Tax Liability', 'Payroll Clearing',
    'Long-term debt', 'Accrued holiday payable', 'Accrued non-current liabilities',
    'Liabilities related to assets held for sale',
  ],
  equity: [
    'Share capital', 'Retained Earnings', 'Dividend disbursed',
    'Other comprehensive income', 'Equity in earnings of subsidiaries',
  ],
  revenue: [
    'Sales - retail', 'Sales - wholesale', 'Revenue - General',
    'Dividend income', 'Interest earned', 'Other operating income',
    'Loss on disposal of assets',
  ],
  expense: [
    'Supplies and materials - COS', 'Payroll Expenses',
    'Office/General Administrative Expenses', 'Utilities',
    'Travel expenses - selling expense', 'Travel expenses - general and admin expenses',
    'Shipping and delivery expense', 'Insurance', 'Bad debts', 'Bank charges',
    'Dues and Subscriptions', 'Equipment rental', 'Interest paid',
    'Legal and professional fees', 'Meals and entertainment',
    'Rent or Lease of Buildings', 'Repair and maintenance',
    'Advertising/Promotional', 'Commissions and fees',
    'Amortization expense', 'Income tax expense',
    'Management compensation', 'Other selling expenses',
  ],
};

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

const fmtAbs = (n: number) =>
  new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Math.abs(n),
  );

const formatPeso = (n: number) => (n < 0 ? `−₱${fmtAbs(n)}` : `₱${fmtAbs(n)}`);

function flattenAccounts(accounts: ChartOfAccount[]): ChartOfAccount[] {
  const result: ChartOfAccount[] = [];
  for (const acct of accounts) {
    result.push(acct);
    if (acct.children?.length) {
      result.push(...flattenAccounts(acct.children));
    }
  }
  return result;
}

const escHtml = (s: string) => {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
};

/* ═══════════════════════════════════════════════════════════
   Account Form Modal
   ═══════════════════════════════════════════════════════════ */

interface AccountFormProps {
  account: Partial<ChartOfAccount> | null;
  parentOptions: { id: number; code: string; name: string }[];
  onSave: (data: AccountFormData) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

interface AccountFormData {
  code: string;
  name: string;
  type: ChartOfAccount['type'];
  detail_type: string;
  parent_id: number | null;
  is_active: boolean;
}

function AccountFormModal({ account, parentOptions, onSave, onClose, saving }: AccountFormProps) {
  const isEditing = account?.id != null;
  const [form, setForm] = useState<AccountFormData>({
    code: account?.code ?? '',
    name: account?.name ?? '',
    type: account?.type ?? 'asset',
    detail_type: account?.detail_type ?? '',
    parent_id: account?.parent_id ?? null,
    is_active: account?.is_active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.code.trim()) e.code = 'Code is required';
    if (!form.name.trim()) e.name = 'Name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await onSave(form);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const resp = (err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } }).response;
        if (resp?.data?.errors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(resp.data.errors)) {
            mapped[k] = Array.isArray(v) ? v[0] : String(v);
          }
          setErrors(mapped);
        } else if (resp?.data?.message) {
          setErrors({ _general: resp.data.message });
        }
      }
    }
  };

  const suggestions = DETAIL_TYPE_SUGGESTIONS[form.type] ?? [];

  // Filter parent options: only top-level (parent_id=null) of matching type or no filter
  const filteredParents = parentOptions.filter(
    (p) => p.id !== account?.id
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <Card className="w-full max-w-lg p-6 mx-4" onClick={() => {}}>
        <div onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="neu-section-title">{isEditing ? 'Edit Account' : 'Add Account'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <HiX className="w-5 h-5" />
          </button>
        </div>

        {errors._general && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {errors._general}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Code & Name */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--n-text-secondary)' }}>Code</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="neu-input w-full"
                placeholder="e.g. 1010"
              />
              {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--n-text-secondary)' }}>Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="neu-input w-full"
                placeholder="Account name"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--n-text-secondary)' }}>Account Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as ChartOfAccount['type'], detail_type: '' })}
              className="neu-input w-full"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Detail Type */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--n-text-secondary)' }}>Detail Type</label>
            <input
              type="text"
              list="detail-type-suggestions"
              value={form.detail_type}
              onChange={(e) => setForm({ ...form, detail_type: e.target.value })}
              className="neu-input w-full"
              placeholder="e.g. Bank, Inventory, Payroll Expenses"
            />
            <datalist id="detail-type-suggestions">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {/* Parent Account */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--n-text-secondary)' }}>Parent Account</label>
            <select
              value={form.parent_id ?? ''}
              onChange={(e) => setForm({ ...form, parent_id: e.target.value ? Number(e.target.value) : null })}
              className="neu-input w-full"
            >
              <option value="">None (Top-level)</option>
              {filteredParents.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            Active
          </label>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner size="sm" /> : isEditing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Account Ledger Modal — audit trail per account
   ═══════════════════════════════════════════════════════════ */

interface LedgerLine {
  id: number;
  journal_entry_id: number;
  date: string;
  description: string;
  reference_type: string | null;
  reference_id: number | null;
  debit: number;
  credit: number;
  running_balance: number;
  recorded_by: string | null;
}

interface LedgerMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

const REFERENCE_LABELS: Record<string, string> = {
  sale: 'Sale',
  sale_reversal: 'Sale Reversal',
  expense: 'Expense',
  expense_reversal: 'Expense Reversal',
  purchase: 'Purchase',
  purchase_order: 'Purchase Order',
  payment: 'Payment',
  journal: 'Journal',
};

const TYPE_BADGE: Record<ChartOfAccount['type'], { bg: string; text: string }> = {
  asset:     { bg: 'bg-blue-100',   text: 'text-blue-700' },
  liability: { bg: 'bg-red-100',    text: 'text-red-700' },
  equity:    { bg: 'bg-purple-100', text: 'text-purple-700' },
  revenue:   { bg: 'bg-green-100',  text: 'text-green-700' },
  expense:   { bg: 'bg-amber-100',  text: 'text-amber-700' },
};

function AccountLedgerModal({
  account,
  onClose,
}: {
  account: ChartOfAccount;
  onClose: () => void;
}) {
  const today = dayjs().format('YYYY-MM-DD');
  const startOfYear = dayjs().startOf('year').format('YYYY-MM-DD');

  const [from, setFrom] = useState(startOfYear);
  const [to, setTo] = useState(today);
  const [page, setPage] = useState(1);
  const [lines, setLines] = useState<LedgerLine[]>([]);
  const [meta, setMeta] = useState<LedgerMeta>({ current_page: 1, last_page: 1, per_page: 50, total: 0 });
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const fetchLedger = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/accounting/chart-of-accounts/${account.id}/ledger`, {
        params: { from, to, page: p, per_page: 50 },
      });
      setLines(res.data.data);
      setMeta(res.data.meta);
      setOpeningBalance(res.data.opening_balance);
      setPage(p);
      tableRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  }, [account.id, from, to]);

  useEffect(() => { fetchLedger(1); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const badge = TYPE_BADGE[account.type];
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));

  const balanceColor = (b: number) =>
    b >= 0 ? 'text-[var(--n-success)]' : 'text-[var(--n-danger)]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card
        className="w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: 'var(--n-border)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-[var(--n-info-glow)] text-[var(--n-info)] shrink-0">
              <HiBookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--n-inset)', color: 'var(--n-text-secondary)' }}>
                  {account.code}
                </span>
                <h2 className="neu-section-title truncate">{account.name}</h2>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${badge.bg} ${badge.text}`}>
                  {account.type}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--n-text-secondary)' }}>
                Account Ledger — transactions that affect this account
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[var(--n-inset)] shrink-0 ml-3" style={{ color: 'var(--n-text-secondary)' }}>
            <HiX className="w-5 h-5" />
          </button>
        </div>

        {/* ── Date filter bar ── */}
        <div className="flex flex-wrap items-end gap-3 px-5 py-3 border-b" style={{ borderColor: 'var(--n-border)', background: 'var(--n-inset)' }}>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--n-text-secondary)' }}>From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="neu-inline-input text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--n-text-secondary)' }}>To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="neu-inline-input text-sm"
            />
          </div>
          <Button size="sm" variant="secondary" onClick={() => fetchLedger(1)} disabled={loading}>
            {loading ? <Spinner size="sm" /> : 'Apply'}
          </Button>
          <div className="ml-auto text-right">
            <p className="text-xs font-semibold" style={{ color: 'var(--n-text-secondary)' }}>Current Balance</p>
            <p className={`text-lg font-bold tabular-nums ${balanceColor(account.balance)}`}>
              {account.balance < 0 ? '−' : ''}₱{fmt(account.balance)}
            </p>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-y-auto" ref={tableRef}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0" style={{ background: 'var(--n-surface)', zIndex: 1 }}>
                <tr className="border-b-2" style={{ borderColor: 'var(--n-border)' }}>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--n-text-secondary)', width: '90px' }}>Date</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--n-text-secondary)', width: '110px' }}>Ref Type</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--n-text-secondary)' }}>Description</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--n-text-secondary)', width: '90px' }}>By</th>
                  <th className="text-right p-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--n-text-secondary)', width: '100px' }}>Debit</th>
                  <th className="text-right p-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--n-text-secondary)', width: '100px' }}>Credit</th>
                  <th className="text-right p-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--n-text-secondary)', width: '120px' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening balance row */}
                {page === 1 && (
                  <tr style={{ background: 'var(--n-inset)' }}>
                    <td className="p-3 text-xs font-medium" style={{ color: 'var(--n-text-secondary)' }}>
                      {from ? dayjs(from).subtract(1, 'day').format('MMM D') : 'Start'}
                    </td>
                    <td className="p-3" colSpan={5}>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: 'var(--n-border)', color: 'var(--n-text-secondary)' }}>
                        Opening Balance
                      </span>
                    </td>
                    <td className={`p-3 text-right tabular-nums font-bold text-sm ${balanceColor(openingBalance)}`}>
                      {openingBalance < 0 ? '−' : ''}₱{fmt(openingBalance)}
                    </td>
                  </tr>
                )}

                {lines.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-sm" style={{ color: 'var(--n-text-secondary)' }}>
                      No transactions found for this period.
                    </td>
                  </tr>
                )}

                {lines.map((line) => (
                  <tr
                    key={line.id}
                    className="border-b hover:bg-[var(--n-inset)] transition-colors"
                    style={{ borderColor: 'var(--n-border)' }}
                  >
                    <td className="p-3 text-xs tabular-nums" style={{ color: 'var(--n-text-secondary)' }}>
                      {dayjs(line.date).format('MMM D, YYYY')}
                    </td>
                    <td className="p-3">
                      {line.reference_type ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-[var(--n-inset)]" style={{ color: 'var(--n-text-secondary)' }}>
                          {REFERENCE_LABELS[line.reference_type] ?? line.reference_type}
                          {line.reference_id ? ` #${line.reference_id}` : ''}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--n-text-dim)' }}>—</span>
                      )}
                    </td>
                    <td className="p-3 font-medium" style={{ color: 'var(--n-text)' }}>
                      {line.description}
                    </td>
                    <td className="p-3 text-xs" style={{ color: 'var(--n-text-secondary)' }}>
                      {line.recorded_by ?? '—'}
                    </td>
                    <td className="p-3 text-right tabular-nums text-sm">
                      {line.debit > 0 ? (
                        <span className="text-[var(--n-info)] font-medium">₱{fmt(line.debit)}</span>
                      ) : (
                        <span style={{ color: 'var(--n-text-dim)' }}>—</span>
                      )}
                    </td>
                    <td className="p-3 text-right tabular-nums text-sm">
                      {line.credit > 0 ? (
                        <span className="text-[var(--n-danger)] font-medium">₱{fmt(line.credit)}</span>
                      ) : (
                        <span style={{ color: 'var(--n-text-dim)' }}>—</span>
                      )}
                    </td>
                    <td className={`p-3 text-right tabular-nums font-semibold text-sm ${balanceColor(line.running_balance)}`}>
                      {line.running_balance < 0 ? '−' : ''}₱{fmt(line.running_balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Footer: summary + pagination ── */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t flex-wrap" style={{ borderColor: 'var(--n-border)', background: 'var(--n-inset)' }}>
          <p className="text-xs" style={{ color: 'var(--n-text-secondary)' }}>
            {meta.total > 0
              ? `Showing ${(meta.current_page - 1) * meta.per_page + 1}–${Math.min(meta.current_page * meta.per_page, meta.total)} of ${meta.total} transaction${meta.total !== 1 ? 's' : ''}`
              : 'No transactions'}
          </p>

          {meta.last_page > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => fetchLedger(page - 1)}
                disabled={page === 1 || loading}
                className="neu-pagination-btn"
              >
                <HiChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs px-2" style={{ color: 'var(--n-text-secondary)' }}>
                Page {meta.current_page} of {meta.last_page}
              </span>
              <button
                onClick={() => fetchLedger(page + 1)}
                disabled={page === meta.last_page || loading}
                className="neu-pagination-btn"
              >
                <HiChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Import Modal — copy lines from Income Statement / Balance Sheet
   ═══════════════════════════════════════════════════════════ */

interface ImportLine {
  code: string;
  name: string;
  amount: number;
  type: ChartOfAccount['type'];
  detailType: string;
  selected: boolean;
}

interface ImportModalProps {
  existingCodes: Set<string>;
  onImport: (accounts: AccountFormData[]) => Promise<void>;
  onClose: () => void;
}

function ImportModal({ existingCodes, onImport, onClose }: ImportModalProps) {
  const [source, setSource] = useState<'income' | 'balance'>('income');
  const [lines, setLines] = useState<ImportLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchIncomeStatement = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const startOfYear = `${now.getFullYear()}-01-01`;
      const today = now.toISOString().split('T')[0];
      const res = await api.get('/accounting/reports/income-statement', {
        params: { start_date: startOfYear, end_date: today },
      });
      const d = res.data;

      const importLines: ImportLine[] = [];

      // Income lines → revenue accounts
      for (const line of d.income || []) {
        importLines.push({
          code: line.code,
          name: line.name,
          amount: line.amount,
          type: 'revenue',
          detailType: 'Sales - retail',
          selected: !existingCodes.has(line.code),
        });
      }

      // COGS lines → expense accounts
      for (const line of d.cost_of_sales || []) {
        importLines.push({
          code: line.code,
          name: line.name,
          amount: line.amount,
          type: 'expense',
          detailType: 'Supplies and materials - COS',
          selected: !existingCodes.has(line.code),
        });
      }

      // Other expenses → expense accounts
      for (const line of d.other_expense_accounts || []) {
        importLines.push({
          code: line.code,
          name: line.name,
          amount: line.amount,
          type: 'expense',
          detailType: 'Office/General Administrative Expenses',
          selected: !existingCodes.has(line.code),
        });
      }

      setLines(importLines);
      setFetched(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalanceSheet = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await api.get('/accounting/reports/balance-sheet', {
        params: { as_of_date: today },
      });
      const d = res.data;

      const importLines: ImportLine[] = [];

      const addLines = (arr: { code: string; name: string; balance: number }[], type: ChartOfAccount['type'], detailType: string) => {
        for (const line of arr || []) {
          importLines.push({
            code: line.code,
            name: line.name,
            amount: line.balance,
            type,
            detailType,
            selected: !existingCodes.has(line.code),
          });
        }
      };

      addLines(d.accounts_receivable, 'asset', 'Accounts Receivable (A/R)');
      addLines(d.current_assets, 'asset', 'Cash and cash equivalents');
      addLines(d.fixed_assets, 'asset', 'Land');
      addLines(d.current_liabilities, 'liability', 'Accrued liabilities');
      addLines(d.non_current_liabilities, 'liability', 'Long-term debt');
      addLines(d.equity, 'equity', 'Retained Earnings');

      setLines(importLines);
      setFetched(true);
    } finally {
      setLoading(false);
    }
  };

  const fetch = () => {
    setFetched(false);
    setLines([]);
    if (source === 'income') fetchIncomeStatement();
    else fetchBalanceSheet();
  };

  const toggleLine = (idx: number) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, selected: !l.selected } : l)));
  };

  const toggleAll = () => {
    const anySelected = lines.some((l) => l.selected);
    setLines((prev) => prev.map((l) => ({ ...l, selected: !anySelected })));
  };

  const handleImport = async () => {
    const selected = lines.filter((l) => l.selected && !existingCodes.has(l.code));
    if (selected.length === 0) return;

    setImporting(true);
    try {
      await onImport(
        selected.map((l) => ({
          code: l.code,
          name: l.name,
          type: l.type,
          detail_type: l.detailType,
          parent_id: null,
          is_active: true,
        })),
      );
      onClose();
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = lines.filter((l) => l.selected && !existingCodes.has(l.code)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <Card className="w-full max-w-2xl p-6 mx-4 max-h-[85vh] flex flex-col" onClick={() => {}}>
        <div className="flex flex-col flex-1 min-h-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="neu-section-title">Import from Reports</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><HiX className="w-5 h-5" /></button>
        </div>

        {/* Source selector */}
        <div className="flex gap-2 mb-4">
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${source === 'income' ? 'bg-[var(--n-primary)] text-white' : 'bg-[var(--n-inset)]'}`}
            onClick={() => { setSource('income'); setFetched(false); setLines([]); }}
          >
            Income Statement
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${source === 'balance' ? 'bg-[var(--n-primary)] text-white' : 'bg-[var(--n-inset)]'}`}
            onClick={() => { setSource('balance'); setFetched(false); setLines([]); }}
          >
            Balance Sheet
          </button>
          <Button variant="secondary" size="sm" onClick={fetch} disabled={loading}>
            {loading ? <Spinner size="sm" /> : 'Fetch'}
          </Button>
        </div>

        {/* Lines list */}
        {fetched && (
          <div className="flex-1 overflow-y-auto border rounded-lg">
            {lines.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: 'var(--n-text-secondary)' }}>
                No accounts found in the report.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: 'var(--n-surface)' }}>
                  <tr className="border-b">
                    <th className="p-2 w-8">
                      <input type="checkbox" checked={lines.every((l) => l.selected)} onChange={toggleAll} />
                    </th>
                    <th className="p-2 text-left font-semibold">Code</th>
                    <th className="p-2 text-left font-semibold">Name</th>
                    <th className="p-2 text-left font-semibold">Type</th>
                    <th className="p-2 text-right font-semibold">Amount</th>
                    <th className="p-2 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const alreadyExists = existingCodes.has(line.code);
                    return (
                      <tr
                        key={line.code + idx}
                        className={`border-b last:border-0 ${alreadyExists ? 'opacity-50' : 'hover:bg-[var(--n-inset)]'}`}
                      >
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={line.selected}
                            onChange={() => toggleLine(idx)}
                            disabled={alreadyExists}
                          />
                        </td>
                        <td className="p-2 font-mono text-xs">{line.code}</td>
                        <td className="p-2">{line.name}</td>
                        <td className="p-2 capitalize">{line.type}</td>
                        <td className="p-2 text-right tabular-nums">{formatPeso(line.amount)}</td>
                        <td className="p-2 text-center">
                          {alreadyExists ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100" style={{ color: 'var(--n-text-secondary)' }}>
                              Exists
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700">New</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Import button */}
        {fetched && lines.length > 0 && (
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleImport} disabled={importing || selectedCount === 0}>
              {importing ? <Spinner size="sm" /> : `Import ${selectedCount} Account${selectedCount !== 1 ? 's' : ''}`}
            </Button>
          </div>
        )}
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */

export function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('');

  // Modal state
  const [formAccount, setFormAccount] = useState<Partial<ChartOfAccount> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ChartOfAccount | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [ledgerAccount, setLedgerAccount] = useState<ChartOfAccount | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/chart-of-accounts');
      const flatList = flattenAccounts(res.data.data || []);
      setAccounts(flatList);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Filter & search
  const filtered = accounts.filter((a) => {
    if (a.parent_id === null) return false; // skip top-level group headers
    const matchesType = !filterType || a.type === filterType;
    const matchesSearch =
      !searchTerm ||
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.detail_type ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Parent options for the form
  const parentOptions = accounts
    .filter((a) => a.parent_id === null)
    .map((a) => ({ id: a.id, code: a.code, name: a.name }));

  const existingCodes = new Set(accounts.map((a) => a.code));

  /* ── CRUD handlers ── */
  const handleSave = async (data: AccountFormData) => {
    setSaving(true);
    try {
      if (formAccount?.id) {
        await api.put(`/accounting/chart-of-accounts/${formAccount.id}`, data);
      } else {
        await api.post('/accounting/chart-of-accounts', data);
      }
      setShowForm(false);
      setFormAccount(null);
      await fetchAccounts();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/accounting/chart-of-accounts/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      await fetchAccounts();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const resp = (err as { response?: { data?: { message?: string } } }).response;
        alert(resp?.data?.message ?? 'Failed to delete account.');
      }
    }
  };

  const handleImport = async (importAccounts: AccountFormData[]) => {
    for (const acct of importAccounts) {
      try {
        await api.post('/accounting/chart-of-accounts', acct);
      } catch {
        // Skip accounts that fail (e.g. duplicate code)
      }
    }
    await fetchAccounts();
  };

  /* ── PDF download ── */
  const downloadPdf = async () => {
    setPdfLoading(true);
    try {
      const res = await api.get('/accounting/chart-of-accounts/pdf', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chart-of-accounts.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setPdfLoading(false);
    }
  };

  /* ── Print ── */
  const handlePrint = () => {
    const line = (a: ChartOfAccount) =>
      `<tr>
        <td>${escHtml(a.name)}</td>
        <td>${escHtml(ACCOUNT_TYPE_LABELS[a.type] ?? a.type)}</td>
        <td>${escHtml(a.detail_type ?? '—')}</td>
        <td class="amount">${formatPeso(a.balance)}</td>
      </tr>`;

    // Group by type
    const grouped: Record<string, ChartOfAccount[]> = {};
    for (const a of filtered) {
      if (!grouped[a.type]) grouped[a.type] = [];
      grouped[a.type].push(a);
    }

    let rows = '';
    const typeOrder = ['asset', 'liability', 'equity', 'revenue', 'expense'];
    for (const type of typeOrder) {
      const group = grouped[type];
      if (!group?.length) continue;
      rows += `<tr class="type-header"><td colspan="4"><strong>${type.charAt(0).toUpperCase() + type.slice(1)}</strong></td></tr>`;
      for (const a of group) {
        rows += line(a);
      }
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Chart of Accounts</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #222; padding: 40px 50px; }
  .title { font-size: 16px; font-weight: 700; text-align: center; text-transform: uppercase; margin-bottom: 4px; }
  .subtitle { text-align: center; font-size: 13px; margin-bottom: 4px; }
  .date { text-align: center; font-size: 10px; color: #555; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  th { border-bottom: 2px solid #333; padding: 6px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  th.amount { text-align: right; }
  td { padding: 5px 10px; font-size: 10px; border-bottom: 1px solid #eee; }
  td.amount { text-align: right; font-variant-numeric: tabular-nums; }
  .type-header td { font-weight: 700; background: #f5f5f5; padding-top: 10px; border-bottom: 1px solid #ccc; }
  @media print { body { padding: 20px; } }
</style></head><body>
  <div class="title">TRI-MILLENNIUM HARDWARE TRADING</div>
  <div class="subtitle">Chart of Accounts</div>
  <div class="date">Generated on: ${new Date().toLocaleDateString('en-US')}</div>
  <table>
    <thead><tr><th>Name</th><th>Account Type</th><th>Detail Type</th><th class="amount">Balance</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;

    const frame = document.createElement('iframe');
    frame.style.display = 'none';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        frame.contentWindow?.print();
        setTimeout(() => document.body.removeChild(frame), 1000);
      }, 300);
    }
  };

  /* ── Render ── */
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="neu-page-title">Chart of Accounts</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
            <HiDocumentDuplicate className="w-4 h-4 mr-1" />
            Import from Reports
          </Button>
          <Button variant="secondary" size="sm" onClick={handlePrint}>
            <HiPrinter className="w-4 h-4 mr-1" />
            Print
          </Button>
          <Button variant="secondary" size="sm" onClick={downloadPdf} disabled={pdfLoading}>
            {pdfLoading ? <Spinner size="sm" /> : <HiDownload className="w-4 h-4 mr-1" />}
            PDF
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setFormAccount({});
              setShowForm(true);
            }}
          >
            <HiPlus className="w-4 h-4 mr-1" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <HiSearch
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--n-text-secondary)' }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, code, or detail type…"
              className="neu-input w-full pl-9"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="neu-input w-full sm:w-48"
          >
            <option value="">All Types</option>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--n-text-secondary)' }}>
            {accounts.length === 0
              ? 'No accounts found. Add your first account or import from reports.'
              : 'No accounts match the current filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2" style={{ borderColor: 'var(--n-border)' }}>
                  <th className="text-left p-3 font-semibold" style={{ color: 'var(--n-text-secondary)' }}>Name</th>
                  <th className="text-left p-3 font-semibold" style={{ color: 'var(--n-text-secondary)' }}>Account Type</th>
                  <th className="text-left p-3 font-semibold" style={{ color: 'var(--n-text-secondary)' }}>Detail Type</th>
                  <th className="text-right p-3 font-semibold" style={{ color: 'var(--n-text-secondary)' }}>Balance</th>
                  <th className="p-3 w-32"></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let currentType = '';
                  const rows: React.ReactNode[] = [];

                  for (const a of filtered) {
                    if (a.type !== currentType) {
                      currentType = a.type;
                      rows.push(
                        <tr key={`header-${a.type}`} style={{ background: 'var(--n-inset)' }}>
                          <td colSpan={5} className="p-2 px-3 font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--n-text-secondary)' }}>
                            {a.type}
                          </td>
                        </tr>,
                      );
                    }
                    rows.push(
                      <tr key={a.id} className="border-b hover:bg-[var(--n-inset)] transition-colors" style={{ borderColor: 'var(--n-border)' }}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--n-inset)', color: 'var(--n-text-secondary)' }}>
                              {a.code}
                            </span>
                            <span className="font-medium">{a.name}</span>
                            {!a.is_active && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600">Inactive</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3" style={{ color: 'var(--n-text-secondary)' }}>
                          {ACCOUNT_TYPE_LABELS[a.type] ?? a.type}
                        </td>
                        <td className="p-3" style={{ color: 'var(--n-text-secondary)' }}>{a.detail_type || '—'}</td>
                        <td className="p-3 text-right tabular-nums font-medium">
                          {formatPeso(a.balance)}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => setLedgerAccount(a)}
                              className="p-1.5 rounded hover:bg-blue-50 transition-colors"
                              style={{ color: 'var(--n-info)' }}
                              title="View ledger / audit trail"
                            >
                              <HiBookOpen className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setFormAccount(a);
                                setShowForm(true);
                              }}
                              className="p-1.5 rounded hover:bg-amber-50 transition-colors"
                              style={{ color: 'var(--n-accent)' }}
                              title="Edit"
                            >
                              <HiPencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(a)}
                              className="p-1.5 rounded hover:bg-red-50 transition-colors text-red-500"
                              title="Delete"
                            >
                              <HiTrash className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>,
                    );
                  }

                  return rows;
                })()}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary Row */}
        {!loading && filtered.length > 0 && (
          <div className="p-3 border-t text-xs flex justify-between" style={{ borderColor: 'var(--n-border)', color: 'var(--n-text-secondary)' }}>
            <span>{filtered.length} account{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </Card>

      {/* Account Ledger Modal */}
      {ledgerAccount && (
        <AccountLedgerModal
          account={ledgerAccount}
          onClose={() => setLedgerAccount(null)}
        />
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <AccountFormModal
          account={formAccount}
          parentOptions={parentOptions}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setFormAccount(null);
          }}
          saving={saving}
        />
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportModal
          existingCodes={existingCodes}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteConfirm(null)}>
          <Card className="w-full max-w-sm p-6 mx-4" onClick={() => {}}>
            <div onClick={(e) => e.stopPropagation()}>
            <h3 className="neu-section-title mb-2">Delete Account</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--n-text-secondary)' }}>
              Are you sure you want to delete <strong>{deleteConfirm.code} — {deleteConfirm.name}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Delete</Button>
            </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
