import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Spinner } from '../../../components/ui/Spinner';
import api from '../../../lib/api';
import dayjs from 'dayjs';
import { HiPlus, HiTrash } from 'react-icons/hi';

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

interface AccountLine {
  code: string;
  name: string;
  amount: number;
  source?: 'journal' | 'expenses';
  count?: number;
}

interface ApiResponse {
  period: { start: string; end: string };
  income: AccountLine[];
  total_income: number;
  cost_of_sales: AccountLine[];
  total_cost_of_sales: number;
  gross_profit: number;
  other_expense_accounts: AccountLine[];
  total_other_expenses: number;
  net_income: number;
}

interface EditableLine {
  id: string;
  code: string;
  name: string;
  amount: number;
  isCustom: boolean;
  source?: 'journal' | 'expenses';
  count?: number;
}

type Section = 'income' | 'cos' | 'expenses';

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

const ACCOUNT_HINTS: Record<string, string> = {
  '4010': 'Actual receipt amount — no tax deducted',
  '4020': 'Net of 12% VAT (sale amount ÷ 1.12)',
  '5010': 'Cost of VATable goods sold',
  '5011': 'Cost of non-VAT goods sold',
  '5060': 'Direct cost of sales',
};

const fmtAbs = (n: number) =>
  new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Math.abs(n),
  );

const formatPeso = (n: number) => (n < 0 ? `−₱${fmtAbs(n)}` : `₱${fmtAbs(n)}`);

let _uid = 1;
const uid = () => `c${_uid++}`;

const toEditable = (lines: AccountLine[], pfx: string): EditableLine[] =>
  lines.map((l, i) => ({
    id: `${pfx}${l.code || i}`,
    code: l.code,
    name: l.name,
    amount: l.amount,
    isCustom: false,
    source: l.source,
    count: l.count,
  }));

const escHtml = (s: string) => {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
};

/* ═══════════════════════════════════════════════════════════
   EditableAmount — click‑to‑edit peso cell
   ═══════════════════════════════════════════════════════════ */

function EditableAmount({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  const start = () => {
    setRaw(value.toFixed(2));
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    const n = parseFloat(raw.replace(/,/g, ''));
    if (!isNaN(n)) onChange(n);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-32 text-right text-sm tabular-nums border-b-2 border-amber-500 bg-amber-50 outline-none px-2 py-0.5 rounded-sm"
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={start}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') start();
      }}
      className="inline-block min-w-[7rem] text-right text-sm tabular-nums px-2 py-0.5 rounded-sm border-b border-dashed border-gray-300 hover:border-amber-400 hover:bg-amber-50/50 focus:border-amber-400 transition-colors cursor-text outline-none"
      title="Click to edit"
    >
      {formatPeso(value)}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   EditableName — click‑to‑edit label for custom lines
   ═══════════════════════════════════════════════════════════ */

function EditableName({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const [editing, setEditing] = useState(!value);
  const [raw, setRaw] = useState(value);

  const commit = () => {
    setEditing(false);
    if (raw.trim()) onChange(raw.trim());
  };

  if (editing || !value) {
    return (
      <input
        autoFocus
        type="text"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="w-full text-sm border-b-2 border-amber-500 bg-amber-50 outline-none px-1 py-0.5 rounded-sm"
        placeholder="Enter description..."
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => {
        setRaw(value);
        setEditing(true);
      }}
      className="text-sm px-1 py-0.5 rounded-sm border-b border-dashed border-transparent hover:border-gray-300 transition-colors cursor-text"
    >
      {value}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════════ */

export function IncomeStatementPage() {
  /* ── Date range ── */
  const [startDate, setStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));

  /* ── Editable report data ── */
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [income, setIncome] = useState<EditableLine[]>([]);
  const [cos, setCos] = useState<EditableLine[]>([]);
  const [expenses, setExpenses] = useState<EditableLine[]>([]);
  const [origSnapshot, setOrigSnapshot] = useState('');

  /* ── UI state ── */
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  /* ── Computed totals ── */
  const totalIncome = income.reduce((s, l) => s + l.amount, 0);
  const totalCos = cos.reduce((s, l) => s + l.amount, 0);
  const grossProfit = totalIncome - totalCos;
  const totalExpenses = expenses.reduce((s, l) => s + l.amount, 0);
  const netIncome = grossProfit - totalExpenses;
  const hasData = period !== null;
  const isModified = hasData && JSON.stringify({ income, cos, expenses }) !== origSnapshot;

  /* ── Section updaters ── */
  const setterOf = (s: Section) => (s === 'income' ? setIncome : s === 'cos' ? setCos : setExpenses);

  const updateAmount = (sec: Section, id: string, amount: number) =>
    setterOf(sec)((prev) => prev.map((l) => (l.id === id ? { ...l, amount } : l)));

  const updateName = (sec: Section, id: string, name: string) =>
    setterOf(sec)((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)));

  const addLine = (sec: Section) =>
    setterOf(sec)((prev) => [...prev, { id: uid(), code: '', name: '', amount: 0, isCustom: true }]);

  const removeLine = (sec: Section, id: string) =>
    setterOf(sec)((prev) => prev.filter((l) => l.id !== id));

  /* ── Generate from API ── */
  const generate = () => {
    setLoading(true);
    api
      .get('/accounting/reports/income-statement', {
        params: { start_date: startDate, end_date: endDate },
      })
      .then((res) => {
        const d: ApiResponse = res.data;
        setPeriod(d.period);
        const inc = toEditable(d.income, 'i');
        const c = toEditable(d.cost_of_sales, 'c');
        const exp = toEditable(d.other_expense_accounts, 'e');
        setIncome(inc);
        setCos(c);
        setExpenses(exp);
        setOrigSnapshot(JSON.stringify({ income: inc, cos: c, expenses: exp }));
      })
      .finally(() => setLoading(false));
  };

  /* ── Reset edits ── */
  const reset = () => {
    if (!origSnapshot) return;
    const orig = JSON.parse(origSnapshot);
    setIncome(orig.income);
    setCos(orig.cos);
    setExpenses(orig.expenses);
  };

  /* ── Build payload for PDF / print ── */
  const buildPayload = () => ({
    period,
    income: income.filter((l) => l.name).map(({ code, name, amount }) => ({ code, name, amount })),
    total_income: totalIncome,
    cost_of_sales: cos.filter((l) => l.name).map(({ code, name, amount }) => ({ code, name, amount })),
    total_cost_of_sales: totalCos,
    gross_profit: grossProfit,
    other_expense_accounts: expenses
      .filter((l) => l.name)
      .map(({ code, name, amount }) => ({ code, name, amount })),
    total_other_expenses: totalExpenses,
    net_income: netIncome,
  });

  /* ── Download PDF (POST with current data) ── */
  const downloadPdf = () => {
    setPdfLoading(true);
    api
      .post('/accounting/reports/income-statement/pdf', buildPayload(), { responseType: 'blob' })
      .then((res) => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `income-statement-${period?.start}-to-${period?.end}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .finally(() => setPdfLoading(false));
  };

  /* ── Print (generate clean HTML from data) ── */
  const handlePrint = () => {
    if (!period) return;
    const p = buildPayload();

    const line = (name: string, amt: number) =>
      `<tr class="row"><td>${escHtml(name || 'Adjustment')}</td><td class="amount${amt < 0 ? ' negative' : ''}">${formatPeso(amt)}</td></tr>`;
    const total = (label: string, amt: number) =>
      `<tr class="total-row"><td>${escHtml(label)}</td><td class="amount">${formatPeso(amt)}</td></tr>`;
    const spacer = '<tr class="spacer"><td colspan="2"></td></tr>';

    let rows = '';
    rows += '<tr class="section-header"><td colspan="2">Income</td></tr>';
    p.income.forEach((l) => (rows += line(l.name, l.amount)));
    rows += total('Total for Income', p.total_income);
    rows += spacer;

    rows += '<tr class="section-header"><td colspan="2">Cost of Sales</td></tr>';
    p.cost_of_sales.forEach((l) => (rows += line(l.name, l.amount)));
    rows += total('Total for Cost of Sales', p.total_cost_of_sales);
    rows += spacer;

    rows += `<tr class="gross-profit"><td>Gross Profit</td><td class="amount">${formatPeso(p.gross_profit)}</td></tr>`;
    rows += spacer;

    if (p.other_expense_accounts.length > 0) {
      rows += '<tr class="section-header"><td colspan="2">Expenses</td></tr>';
      rows += '<tr class="sub-section"><td colspan="2">Other Expenses</td></tr>';
      p.other_expense_accounts.forEach((l) => (rows += line(l.name, l.amount)));
      rows += total('Total for Other Expenses', p.total_other_expenses);
      rows += spacer;
    }

    rows += `<tr class="net-income"><td>Net earnings</td><td class="amount">${formatPeso(p.net_income)}</td></tr>`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Income Statement</title><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:12px; color:#111; padding:32px 48px; }
  h1 { font-size:20px; font-weight:400; text-align:center; margin-bottom:4px; }
  h2 { font-size:14px; font-weight:700; text-align:center; text-transform:uppercase; margin-bottom:4px; }
  h3 { font-size:11px; text-align:center; color:#555; margin-bottom:20px; }
  table { width:100%; border-collapse:collapse; }
  .col-hdr { text-align:right; font-size:9px; font-weight:700; color:#555; text-transform:uppercase; padding-bottom:6px; border-bottom:1px solid #ccc; }
  .section-header td { font-weight:700; font-size:11px; padding:10px 0 3px; color:#222; }
  .sub-section td { font-weight:600; font-size:10px; padding:4px 0 2px 12px; color:#333; }
  .row td { padding:3px 0 3px 16px; color:#444; font-size:11px; }
  .amount { text-align:right; font-variant-numeric:tabular-nums; color:#222; }
  .total-row td { font-weight:700; padding:5px 0; border-top:1px solid #bbb; font-size:11px; }
  .total-row .amount { text-align:right; }
  .gross-profit td { font-weight:700; font-size:12px; padding:7px 0; border-top:1px solid #999; }
  .net-income td { font-weight:700; font-size:13px; padding:8px 0; border-top:2px solid #111; border-bottom:3px double #111; }
  .spacer td { height:8px; }
  .negative { color:#c0392b; }
  .footer { margin-top:28px; font-size:9px; color:#999; text-align:center; }
</style></head><body>
  <h1>Profit and Loss</h1>
  <h2>HardhatLedger</h2>
  <h3>${dayjs(period.start).format('D MMMM')}\u2013${dayjs(period.end).format('D MMMM, YYYY')}</h3>
  <table>
    <tr><td style="width:65%"></td><td class="col-hdr" style="width:35%">TOTAL</td></tr>
    ${rows}
  </table>
  <div class="footer">Accrual Basis &nbsp; ${dayjs().format('dddd, DD MMMM YYYY hh:mm A')} GMTZ${isModified ? ' &nbsp;\u2022&nbsp; Contains user adjustments' : ''}</div>
</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none';
    document.body.appendChild(iframe);
    iframe.srcdoc = html;
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
  };

  /* ── JSX ── */
  return (
    <div>
      <h1 className="neu-page-title" style={{ marginBottom: '1.5rem' }}>Income Statement</h1>

      {/* ── Controls ── */}
      <Card className="p-4 mb-4">
        <div className="flex gap-4 items-end flex-wrap">
          <DatePicker label="From" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <DatePicker label="To" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <Button variant="amber" onClick={generate} loading={loading}>
            Generate
          </Button>
          {hasData && (
            <>
              <Button variant="outline" onClick={handlePrint}>
                Print
              </Button>
              <Button variant="outline" onClick={downloadPdf} loading={pdfLoading}>
                Download PDF
              </Button>
              {isModified && (
                <Button variant="secondary" onClick={reset}>
                  Reset
                </Button>
              )}
            </>
          )}
        </div>
      </Card>

      {/* ── How to Read This Report ── */}
      {hasData && (
        <Card className="p-4 mb-4" style={{ background: 'var(--n-surface-alt, #f8f9fb)' }}>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="flex items-center gap-2 text-sm font-semibold w-full text-left"
            style={{ color: 'var(--n-text)' }}
          >
            <span className="text-amber-500 text-base">ℹ</span>
            How to Read This Report
            <span className="ml-auto text-xs opacity-60">{showHelp ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {showHelp && (
            <div className="mt-3 text-sm space-y-2" style={{ color: 'var(--n-text-secondary)' }}>
              <p>
                <strong>NON-VAT Sales</strong> (account 4010): Shows the <em>actual receipt amount</em>{' '}
                from retail / walk-in customers — no tax deducted.
              </p>
              <p>
                <strong>VATable Sales</strong> (account 4020): Shows the <em>net amount</em> after
                removing 12% VAT (sale ÷ 1.12).
              </p>
              <div
                className="pl-4 rounded p-3 text-xs"
                style={{
                  background: 'rgba(255,255,255,0.6)',
                  border: '1px dashed var(--n-border, #ddd)',
                }}
              >
                <strong>Example:</strong> 1 box blind rivet at ₱460/box
                <br />
                • NON-VAT sale → <strong>₱460.00</strong> appears under Income
                <br />
                • VATable sale → <strong>₱410.71</strong> appears under Income (₱460 ÷ 1.12)
                <br />
                &nbsp;&nbsp;The <strong>₱49.29</strong> VAT appears on Balance Sheet → Liabilities →
                VAT Payable
              </div>
              <p className="text-xs opacity-80 pt-1">
                💡 Click any amount to adjust it before printing. Use &quot;+ Add line&quot; for
                manual adjustments. Totals update automatically.
              </p>
            </div>
          )}
        </Card>
      )}

      {loading && <Spinner />}

      {/* ── Report ── */}
      {hasData && (
        <Card className="p-6">
          {/* Modified badge */}
          {isModified && (
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                ● Modified
              </span>
              <span className="text-xs" style={{ color: 'var(--n-text-secondary)' }}>
                Values have been adjusted — PDF and Print will use the modified values
              </span>
            </div>
          )}

          <h1 className="text-xl text-center mb-1" style={{ fontWeight: 400, color: 'var(--n-text)' }}>
            Profit and Loss
          </h1>
          <h2 className="text-sm font-bold text-center uppercase mb-1" style={{ color: 'var(--n-text)' }}>
            HardhatLedger
          </h2>
          <h3 className="text-xs text-center mb-6" style={{ color: 'var(--n-text-secondary)' }}>
            {dayjs(period!.start).format('D MMMM')}&ndash;{dayjs(period!.end).format('D MMMM, YYYY')}
          </h3>

          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <td style={{ width: '58%' }}></td>
                <td
                  className="text-right text-xs font-bold uppercase pb-1.5 border-b"
                  style={{ width: '32%', color: 'var(--n-text-secondary)', borderColor: 'var(--n-border)' }}
                >
                  TOTAL
                </td>
                <td style={{ width: '10%' }}></td>
              </tr>
            </thead>
            <tbody>
              {/* ── INCOME ── */}
              <tr>
                <td colSpan={3} className="font-bold text-sm pt-4 pb-1" style={{ color: 'var(--n-text)' }}>
                  Income
                </td>
              </tr>
              {income.map((line) => (
                <tr key={line.id}>
                  <td className="pl-4 py-1 text-sm" style={{ color: 'var(--n-text-secondary)' }}>
                    {line.isCustom ? (
                      <EditableName value={line.name} onChange={(n) => updateName('income', line.id, n)} />
                    ) : (
                      <span title={ACCOUNT_HINTS[line.code] || ''}>{line.name}</span>
                    )}
                    {ACCOUNT_HINTS[line.code] && !line.isCustom && (
                      <span className="block text-xs opacity-50 pl-1">{ACCOUNT_HINTS[line.code]}</span>
                    )}
                  </td>
                  <td className="py-1 text-right">
                    <EditableAmount value={line.amount} onChange={(n) => updateAmount('income', line.id, n)} />
                  </td>
                  <td className="py-1 pl-2 w-8">
                    {line.isCustom && (
                      <button
                        onClick={() => removeLine('income', line.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        title="Remove"
                      >
                        <HiTrash className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className="pt-1 pb-2">
                  <button
                    onClick={() => addLine('income')}
                    className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium pl-4 transition-colors"
                  >
                    <HiPlus className="w-3 h-3" /> Add line
                  </button>
                </td>
              </tr>
              <tr className="border-t" style={{ borderColor: 'var(--n-border)' }}>
                <td className="py-1.5 font-bold text-sm">Total for Income</td>
                <td className="py-1.5 font-bold text-sm text-right tabular-nums">{formatPeso(totalIncome)}</td>
                <td></td>
              </tr>

              <tr>
                <td colSpan={3} className="h-3" />
              </tr>

              {/* ── COST OF SALES ── */}
              <tr>
                <td colSpan={3} className="font-bold text-sm pt-2 pb-1" style={{ color: 'var(--n-text)' }}>
                  Cost of Sales
                </td>
              </tr>
              {cos.map((line) => (
                <tr key={line.id}>
                  <td className="pl-4 py-1 text-sm" style={{ color: 'var(--n-text-secondary)' }}>
                    {line.isCustom ? (
                      <EditableName value={line.name} onChange={(n) => updateName('cos', line.id, n)} />
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <span title={ACCOUNT_HINTS[line.code] || ''}>{line.name}</span>
                        {line.source === 'expenses' && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                            title={`Auto-synced from ${line.count ?? ''} expense record${(line.count ?? 0) !== 1 ? 's' : ''} in the Expenses module`}
                          >
                            {line.count ?? ''} record{(line.count ?? 0) !== 1 ? 's' : ''}
                          </span>
                        )}
                      </span>
                    )}
                    {ACCOUNT_HINTS[line.code] && !line.isCustom && (
                      <span className="block text-xs opacity-50 pl-1">{ACCOUNT_HINTS[line.code]}</span>
                    )}
                  </td>
                  <td className="py-1 text-right">
                    <EditableAmount value={line.amount} onChange={(n) => updateAmount('cos', line.id, n)} />
                  </td>
                  <td className="py-1 pl-2 w-8">
                    {line.isCustom && (
                      <button
                        onClick={() => removeLine('cos', line.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        title="Remove"
                      >
                        <HiTrash className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className="pt-1 pb-2">
                  <button
                    onClick={() => addLine('cos')}
                    className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium pl-4 transition-colors"
                  >
                    <HiPlus className="w-3 h-3" /> Add line
                  </button>
                </td>
              </tr>
              <tr className="border-t" style={{ borderColor: 'var(--n-border)' }}>
                <td className="py-1.5 font-bold text-sm">Total for Cost of Sales</td>
                <td className="py-1.5 font-bold text-sm text-right tabular-nums">{formatPeso(totalCos)}</td>
                <td></td>
              </tr>

              <tr>
                <td colSpan={3} className="h-3" />
              </tr>

              {/* ── GROSS PROFIT ── */}
              <tr className="border-t" style={{ borderColor: 'var(--n-border)' }}>
                <td className="py-2 font-bold text-base" style={{ color: 'var(--n-text)' }}>
                  Gross Profit
                </td>
                <td
                  className={`py-2 font-bold text-base text-right tabular-nums ${grossProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}
                >
                  {formatPeso(grossProfit)}
                </td>
                <td></td>
              </tr>

              <tr>
                <td colSpan={3} className="h-3" />
              </tr>

              {/* ── EXPENSES ── */}
              <tr>
                <td colSpan={3} className="font-bold text-sm pt-2 pb-0.5" style={{ color: 'var(--n-text)' }}>
                  Expenses
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="pb-1">
                  <span className="text-xs" style={{ color: 'var(--n-text-secondary)' }}>
                    Auto-synced from the{' '}
                    <span className="font-medium" style={{ color: 'var(--n-text)' }}>Expenses module</span>
                  </span>
                </td>
              </tr>
              {expenses.length > 0 && (
                <>
                  <tr>
                    <td
                      colSpan={3}
                      className="pl-3 pt-1 pb-0.5 text-xs font-semibold"
                      style={{ color: 'var(--n-text-secondary)' }}
                    >
                      Other Expenses
                    </td>
                  </tr>
                  {expenses.map((line) => (
                    <tr key={line.id}>
                      <td className="pl-4 py-1 text-sm" style={{ color: 'var(--n-text-secondary)' }}>
                        {line.isCustom ? (
                          <EditableName
                            value={line.name}
                            onChange={(n) => updateName('expenses', line.id, n)}
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <span>{line.name}</span>
                            {line.source === 'expenses' && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                                title={`Auto-synced from ${line.count ?? ''} expense record${(line.count ?? 0) !== 1 ? 's' : ''} in the Expenses module`}
                              >
                                {line.count ?? ''} record{(line.count ?? 0) !== 1 ? 's' : ''}
                              </span>
                            )}
                            {line.source === 'journal' && line.count !== undefined && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200"
                                title={`${line.count} expense record${line.count !== 1 ? 's' : ''} — posted to journal`}
                              >
                                {line.count} record{line.count !== 1 ? 's' : ''}
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="py-1 text-right">
                        <EditableAmount
                          value={line.amount}
                          onChange={(n) => updateAmount('expenses', line.id, n)}
                        />
                      </td>
                      <td className="py-1 pl-2 w-8">
                        {line.isCustom && (
                          <button
                            onClick={() => removeLine('expenses', line.id)}
                            className="text-red-400 hover:text-red-600 transition-colors"
                            title="Remove"
                          >
                            <HiTrash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </>
              )}
              <tr>
                <td colSpan={3} className="pt-1 pb-2">
                  <button
                    onClick={() => addLine('expenses')}
                    className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium pl-4 transition-colors"
                  >
                    <HiPlus className="w-3 h-3" /> Add line
                  </button>
                </td>
              </tr>
              {expenses.length > 0 && (
                <tr className="border-t" style={{ borderColor: 'var(--n-border)' }}>
                  <td className="py-1.5 font-bold text-sm">Total for Expenses</td>
                  <td className="py-1.5 font-bold text-sm text-right tabular-nums">
                    {formatPeso(totalExpenses)}
                  </td>
                  <td></td>
                </tr>
              )}

              <tr>
                <td colSpan={3} className="h-3" />
              </tr>

              {/* ── NET EARNINGS ── */}
              <tr
                style={{
                  borderTop: '2px solid var(--n-text)',
                  borderBottom: '3px double var(--n-text)',
                }}
              >
                <td className="py-3 font-bold text-lg">Net earnings</td>
                <td
                  className={`py-3 font-bold text-lg text-right tabular-nums ${netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}
                >
                  {formatPeso(netIncome)}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <div className="mt-6 text-center text-xs" style={{ color: 'var(--n-text-secondary)' }}>
            Accrual Basis &nbsp; {dayjs().format('dddd, DD MMMM YYYY hh:mm A')} GMTZ
            {isModified && (
              <span className="ml-2 text-amber-600 font-medium">• Contains user adjustments</span>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
