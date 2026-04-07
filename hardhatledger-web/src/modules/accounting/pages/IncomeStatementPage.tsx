import { useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Spinner } from '../../../components/ui/Spinner';
import api from '../../../lib/api';
import dayjs from 'dayjs';

interface IncomeStatementData {
  period: { start: string; end: string };
  sales_vatable: number;
  sales_non_vat: number;
  total_income: number;
  cogs_non_vat: number;
  cogs_vatable: number;
  total_cogs: number;
  gross_profit: number;
  other_expense_accounts: { code: string; name: string; amount: number }[];
  total_other_expenses: number;
  reconciliation: number;
  total_expenses: number;
  net_income: number;
}

const peso = (n: number) =>
  new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export function IncomeStatementPage() {
  const [startDate, setStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [data, setData] = useState<IncomeStatementData | null>(null);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const generate = () => {
    setLoading(true);
    api
      .get('/accounting/reports/income-statement', {
        params: { start_date: startDate, end_date: endDate },
      })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const html = `<!DOCTYPE html>
<html>
  <head>
    <title>Income Statement</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #111; padding: 32px 48px; }
      h1 { font-size: 18px; font-weight: 700; text-align: center; margin-bottom: 2px; }
      h2 { font-size: 13px; font-weight: 400; text-align: center; color: #555; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; }
      .section-header td { font-weight: 700; font-size: 11px; text-transform: uppercase;
        letter-spacing: 0.06em; padding: 10px 0 4px; color: #1B3A5C; border-bottom: 1px solid #1B3A5C; }
      .row td { padding: 4px 0; }
      .row td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
      .row td:first-child { padding-left: 16px; color: #444; }
      .subtotal td { font-weight: 600; padding: 6px 0; border-top: 1px solid #ddd; }
      .subtotal td:last-child { text-align: right; }
      .net-income td { font-weight: 700; font-size: 15px; padding: 10px 0; border-top: 2px solid #111; border-bottom: 3px double #111; }
      .net-income td:last-child { text-align: right; }
      .spacer td { height: 8px; }
    </style>
  </head>
  <body>${content}</body>
</html>`;

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

  return (
    <div>
      <h1 className="neu-page-title" style={{ marginBottom: '1.5rem' }}>Income Statement</h1>

      <Card className="p-4 mb-4">
        <div className="flex gap-4 items-end flex-wrap">
          <DatePicker label="From" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <DatePicker label="To" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <Button variant="amber" onClick={generate} loading={loading}>
            Generate
          </Button>
          {data && (
            <Button variant="outline" onClick={handlePrint}>
              Print / PDF
            </Button>
          )}
        </div>
      </Card>

      {loading && <Spinner />}

      {data && (
        <Card className="p-6">
          {/* Printable region */}
          <div ref={printRef}>
            <h1 className="text-xl font-bold text-center text-[var(--n-text)] mb-0.5">HardhatLedger</h1>
            <h2 className="text-sm text-center text-[var(--n-text-secondary)] mb-6">
              Income Statement &mdash;{' '}
              {dayjs(data.period.start).format('MMM D, YYYY')} to{' '}
              {dayjs(data.period.end).format('MMM D, YYYY')}
            </h2>

            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              {/* ── INCOME ── */}
              <tbody>
                <tr className="section-header">
                  <td colSpan={2} className="font-bold text-xs uppercase tracking-wide pb-1 border-b border-[var(--n-navy)] text-[var(--n-navy)] pt-2">
                    Income
                  </td>
                </tr>
                <tr className="row">
                  <td className="pl-4 py-1 text-sm text-[var(--n-text-secondary)]">Sales (VATable)</td>
                  <td className="py-1 text-sm text-right tabular-nums">₱{peso(data.sales_vatable)}</td>
                </tr>
                <tr className="row">
                  <td className="pl-4 py-1 text-sm text-[var(--n-text-secondary)]">Sales (Non-VAT)</td>
                  <td className="py-1 text-sm text-right tabular-nums">₱{peso(data.sales_non_vat)}</td>
                </tr>
                <tr className="subtotal border-t border-[var(--n-border)]">
                  <td className="py-1.5 font-semibold text-sm">Total for Income</td>
                  <td className="py-1.5 font-semibold text-sm text-right tabular-nums">₱{peso(data.total_income)}</td>
                </tr>

                <tr className="spacer"><td colSpan={2} className="h-3" /></tr>

                {/* ── COST OF SALES ── */}
                <tr className="section-header">
                  <td colSpan={2} className="font-bold text-xs uppercase tracking-wide pb-1 border-b border-[var(--n-navy)] text-[var(--n-navy)] pt-2">
                    Cost of Sales
                  </td>
                </tr>
                <tr className="row">
                  <td className="pl-4 py-1 text-sm text-[var(--n-text-secondary)]">COGS Non-VATable</td>
                  <td className="py-1 text-sm text-right tabular-nums">₱{peso(data.cogs_non_vat)}</td>
                </tr>
                <tr className="row">
                  <td className="pl-4 py-1 text-sm text-[var(--n-text-secondary)]">COGS VATable</td>
                  <td className="py-1 text-sm text-right tabular-nums">₱{peso(data.cogs_vatable)}</td>
                </tr>
                <tr className="row">
                  <td className="pl-4 py-1 text-sm text-[var(--n-text-secondary)]">Cost of Sales</td>
                  <td className="py-1 text-sm text-right tabular-nums">₱{peso(data.total_cogs)}</td>
                </tr>
                <tr className="subtotal border-t border-[var(--n-border)]">
                  <td className="py-1.5 font-semibold text-sm">Total for Cost of Sales</td>
                  <td className="py-1.5 font-semibold text-sm text-right tabular-nums">₱{peso(data.total_cogs)}</td>
                </tr>

                <tr className="spacer"><td colSpan={2} className="h-3" /></tr>

                {/* ── GROSS PROFIT ── */}
                <tr className="border-t-2 border-[var(--n-navy)]">
                  <td className="py-2 font-bold text-base text-[var(--n-navy)]">Gross Profit ₱</td>
                  <td className={`py-2 font-bold text-base text-right tabular-nums ${data.gross_profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    ₱{peso(data.gross_profit)}
                  </td>
                </tr>

                <tr className="spacer"><td colSpan={2} className="h-3" /></tr>

                {/* ── EXPENSES ── */}
                <tr className="section-header">
                  <td colSpan={2} className="font-bold text-xs uppercase tracking-wide pb-1 border-b border-[var(--n-navy)] text-[var(--n-navy)] pt-2">
                    Expenses
                  </td>
                </tr>

                {/* Other Expenses sub-section */}
                <tr>
                  <td colSpan={2} className="pl-2 pt-2 pb-0.5 text-xs font-semibold text-[var(--n-text-secondary)] uppercase tracking-wide">
                    Other Expenses
                  </td>
                </tr>
                {data.other_expense_accounts.length === 0 ? (
                  <tr className="row">
                    <td colSpan={2} className="pl-4 py-1 text-sm text-[var(--n-text-secondary)] italic">No expense accounts</td>
                  </tr>
                ) : (
                  data.other_expense_accounts.map((a) => (
                    <tr key={a.code} className="row">
                      <td className="pl-4 py-1 text-sm text-[var(--n-text-secondary)]">{a.code} {a.name}</td>
                      <td className="py-1 text-sm text-right tabular-nums">₱{peso(a.amount)}</td>
                    </tr>
                  ))
                )}

                {/* Reconciliation Discrepancies */}
                <tr className="row">
                  <td className="pl-4 py-1 text-sm text-[var(--n-text-secondary)]">Reconciliation Discrepancies</td>
                  <td className={`py-1 text-sm text-right tabular-nums ${data.reconciliation < 0 ? 'text-red-600' : ''}`}>
                    ₱{peso(data.reconciliation)}
                  </td>
                </tr>

                <tr className="subtotal border-t border-[var(--n-border)]">
                  <td className="py-1.5 font-semibold text-sm">Total for Other Expenses</td>
                  <td className="py-1.5 font-semibold text-sm text-right tabular-nums">₱{peso(data.total_other_expenses + data.reconciliation)}</td>
                </tr>

                <tr className="spacer"><td colSpan={2} className="h-3" /></tr>

                {/* ── NET EARNINGS ── */}
                <tr className="border-t-2 border-b-[3px] border-double border-[var(--n-text)]" style={{ borderBottomStyle: 'double', borderBottomWidth: 3 }}>
                  <td className="py-3 font-bold text-lg">Net Earnings</td>
                  <td className={`py-3 font-bold text-lg text-right tabular-nums ${data.net_income >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    ₱{peso(data.net_income)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
