import { useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  HiArrowTrendingUp, HiArrowTrendingDown, HiBanknotes, HiArrowPath,
} from 'react-icons/hi2';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Spinner } from '../../../components/ui/Spinner';
import api from '../../../lib/api';
import dayjs from 'dayjs';

// ── Types ────────────────────────────────────────────────────────────────────

interface CfItem {
  label: string;
  amount: number;
  type: 'inflow' | 'outflow';
}

interface CfSection {
  items: CfItem[];
  net: number;
}

interface PaymentBreakdown {
  method: string;
  total: number;
  count: number;
}

interface CashFlowData {
  period: { start: string; end: string };
  cash_inflows: number;
  cash_outflows: number;
  net_cash_flow: number;
  cash_opening: number;
  cash_closing: number;
  operating: CfSection;
  investing: CfSection;
  financing: CfSection;
  net_change_from_sections: number;
  payment_breakdown: PaymentBreakdown[];
  total_collected: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const peso = (n: number, showSign = false) => {
  const formatted = new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  if (showSign && n < 0) return `(₱${formatted})`;
  return `₱${formatted}`;
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  check: 'Check',
  credit: 'Credit',
};

const PAYMENT_COLORS: Record<string, string> = {
  cash: '#22c55e',
  card: '#3b82f6',
  bank_transfer: '#8b5cf6',
  check: '#f59e0b',
  credit: '#ef4444',
};

// ── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  positive,
  neutral,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  positive?: boolean;
  neutral?: boolean;
}) {
  const color = neutral
    ? 'text-[var(--n-text)]'
    : positive
    ? 'text-green-600'
    : value >= 0
    ? 'text-green-600'
    : 'text-red-600';

  return (
    <Card className="p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-[var(--n-bg)] flex items-center justify-center text-[var(--n-navy)] text-xl flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs text-[var(--n-text-secondary)] mb-0.5">{label}</p>
        <p className={`text-lg font-bold tabular-nums ${color}`}>{peso(value, true)}</p>
      </div>
    </Card>
  );
}

function SectionTable({ title, color, items, net }: {
  title: string;
  color: string;
  items: CfItem[];
  net: number;
}) {
  return (
    <div>
      <h3 className={`font-bold text-xs uppercase tracking-wide pb-1 border-b mb-1 ${color}`}>
        {title}
      </h3>
      {items.map((item, i) => (
        <div key={i} className="flex justify-between text-sm py-1">
          <span className="text-[var(--n-text-secondary)] pl-3">{item.label}</span>
          <span className={`tabular-nums ${item.amount < 0 ? 'text-red-600' : ''}`}>
            {item.amount < 0 ? `(${peso(item.amount)})` : peso(item.amount)}
          </span>
        </div>
      ))}
      <div className={`flex justify-between font-semibold text-sm pt-1.5 border-t border-dashed ${color}`}>
        <span>Net {title}</span>
        <span className={`tabular-nums ${net < 0 ? 'text-red-600' : 'text-green-700'}`}>
          {net < 0 ? `(${peso(net)})` : peso(net)}
        </span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function CashFlowPage() {
  const [startDate, setStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const generate = () => {
    setLoading(true);
    api
      .get('/accounting/reports/cash-flow', {
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
    <title>Cash Flow Statement</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #111; padding: 32px 48px; }
      h1 { font-size: 18px; font-weight: 700; text-align: center; margin-bottom: 2px; }
      h2 { font-size: 13px; font-weight: 400; text-align: center; color: #555; margin-bottom: 24px; }
      .kpis { display: flex; gap: 16px; margin-bottom: 24px; }
      .kpi { border: 1px solid #ddd; border-radius: 6px; padding: 10px 16px; flex: 1; }
      .kpi-label { font-size: 10px; color: #777; margin-bottom: 2px; }
      .kpi-value { font-size: 15px; font-weight: 700; }
      .green { color: #16a34a; } .red { color: #dc2626; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      .section-header td { font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: .06em;
        color: #1B3A5C; border-bottom: 1px solid #1B3A5C; padding: 8px 0 3px; }
      .row td { padding: 3px 0; font-size: 12px; }
      .row td:first-child { padding-left: 12px; color: #555; }
      .row td:last-child, .subtotal td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
      .subtotal td { font-weight: 600; padding: 5px 0; border-top: 1px dashed #ccc; }
      .net-change td { font-weight: 700; font-size: 14px; padding: 8px 0; border-top: 2px solid #1B3A5C; }
      .net-change td:last-child { text-align: right; }
      .closing td { font-weight: 700; font-size: 15px; padding: 10px 0; border-top: 2px solid #111; border-bottom: 3px double #111; }
      .closing td:last-child { text-align: right; }
      .spacer td { height: 8px; }
      .payment-section { margin-top: 20px; border-top: 1px solid #ddd; padding-top: 16px; }
      .payment-section h3 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #1B3A5C; margin-bottom: 8px; }
      .payment-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
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

  // Chart data: inflows vs outflows by section
  const chartData = data
    ? [
        {
          section: 'Operating',
          Inflows: data.operating.items.filter((i) => i.amount > 0).reduce((s, i) => s + i.amount, 0),
          Outflows: Math.abs(data.operating.items.filter((i) => i.amount < 0).reduce((s, i) => s + i.amount, 0)),
        },
        {
          section: 'Investing',
          Inflows: data.investing.items.filter((i) => i.amount > 0).reduce((s, i) => s + i.amount, 0),
          Outflows: Math.abs(data.investing.items.filter((i) => i.amount < 0).reduce((s, i) => s + i.amount, 0)),
        },
        {
          section: 'Financing',
          Inflows: data.financing.items.filter((i) => i.amount > 0).reduce((s, i) => s + i.amount, 0),
          Outflows: Math.abs(data.financing.items.filter((i) => i.amount < 0).reduce((s, i) => s + i.amount, 0)),
        },
      ]
    : [];

  return (
    <div>
      <h1 className="neu-page-title" style={{ marginBottom: '1.5rem' }}>Cash Flow Statement</h1>

      {/* Controls */}
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
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <KpiCard
              label="Total Cash Inflows"
              value={data.cash_inflows}
              icon={<HiArrowTrendingUp />}
              positive
            />
            <KpiCard
              label="Total Cash Outflows"
              value={data.cash_outflows}
              icon={<HiArrowTrendingDown />}
            />
            <KpiCard
              label="Net Cash Flow"
              value={data.net_cash_flow}
              icon={<HiBanknotes />}
            />
            <KpiCard
              label="Closing Cash Balance"
              value={data.cash_closing}
              icon={<HiArrowPath />}
              neutral
            />
          </div>

          {/* Chart + Payment Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card className="p-4 md:col-span-2">
              <h2 className="text-sm font-semibold text-[var(--n-text)] mb-3">Cash Flow by Activity</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--n-border)" />
                  <XAxis dataKey="section" tick={{ fontSize: 12, fill: 'var(--n-text-secondary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--n-text-secondary)' }}
                    tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number, name: string) => [peso(value), name]}
                    contentStyle={{ fontSize: 12, background: 'var(--n-surface)', border: '1px solid var(--n-border)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Inflows" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Outflows" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4">
              <h2 className="text-sm font-semibold text-[var(--n-text)] mb-3">
                Collections by Payment Method
              </h2>
              {data.payment_breakdown.length === 0 ? (
                <p className="text-sm text-[var(--n-text-secondary)] italic">No payment data</p>
              ) : (
                <div className="space-y-3">
                  {data.payment_breakdown.map((p) => {
                    const pct = data.total_collected > 0
                      ? (p.total / data.total_collected) * 100
                      : 0;
                    const color = PAYMENT_COLORS[p.method] ?? '#6b7280';
                    return (
                      <div key={p.method}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium" style={{ color }}>
                            {PAYMENT_LABELS[p.method] ?? p.method}
                          </span>
                          <span className="text-[var(--n-text-secondary)] tabular-nums">
                            {peso(p.total)} ({p.count} txn)
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--n-bg)] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct.toFixed(1)}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-between font-bold text-sm pt-2 border-t border-[var(--n-border)]">
                    <span>Total Collected</span>
                    <span className="tabular-nums text-green-600">{peso(data.total_collected)}</span>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Printable Statement */}
          <Card className="p-6">
            <div ref={printRef}>
              <h1 className="text-xl font-bold text-center text-[var(--n-text)] mb-0.5">
                HardhatLedger
              </h1>
              <h2 className="text-sm text-center text-[var(--n-text-secondary)] mb-6">
                Cash Flow Statement &mdash;{' '}
                {dayjs(data.period.start).format('MMM D, YYYY')} to{' '}
                {dayjs(data.period.end).format('MMM D, YYYY')}
              </h2>

              {/* Opening balance */}
              <div className="max-w-lg mx-auto">
                <div className="flex justify-between text-sm pb-2 border-b border-[var(--n-border)] mb-3">
                  <span className="text-[var(--n-text-secondary)]">Opening Cash Balance</span>
                  <span className="tabular-nums font-medium">{peso(data.cash_opening)}</span>
                </div>

                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <tbody>
                    {/* ── Operating ── */}
                    <tr className="section-header">
                      <td colSpan={2} className="font-bold text-xs uppercase tracking-wide text-[var(--n-navy)] border-b border-[var(--n-navy)] pb-1 pt-2">
                        Operating Activities
                      </td>
                    </tr>
                    {data.operating.items.map((item, i) => (
                      <tr key={i} className="row">
                        <td className="pl-4 py-1 text-sm text-[var(--n-text-secondary)]">{item.label}</td>
                        <td className={`py-1 text-sm text-right tabular-nums ${item.amount < 0 ? 'text-red-600' : ''}`}>
                          {item.amount < 0 ? `(${peso(item.amount)})` : peso(item.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-dashed border-[var(--n-border)]">
                      <td className="py-1.5 font-semibold text-sm">Net Cash from Operating</td>
                      <td className={`py-1.5 font-semibold text-sm text-right tabular-nums ${data.operating.net < 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {data.operating.net < 0 ? `(${peso(data.operating.net)})` : peso(data.operating.net)}
                      </td>
                    </tr>

                    <tr><td colSpan={2} className="h-3" /></tr>

                    {/* ── Investing ── */}
                    <tr className="section-header">
                      <td colSpan={2} className="font-bold text-xs uppercase tracking-wide text-[var(--n-navy)] border-b border-[var(--n-navy)] pb-1 pt-2">
                        Investing Activities
                      </td>
                    </tr>
                    {data.investing.items.map((item, i) => (
                      <tr key={i} className="row">
                        <td className="pl-4 py-1 text-sm text-[var(--n-text-secondary)]">{item.label}</td>
                        <td className={`py-1 text-sm text-right tabular-nums ${item.amount < 0 ? 'text-red-600' : ''}`}>
                          {item.amount < 0 ? `(${peso(item.amount)})` : peso(item.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-dashed border-[var(--n-border)]">
                      <td className="py-1.5 font-semibold text-sm">Net Cash from Investing</td>
                      <td className={`py-1.5 font-semibold text-sm text-right tabular-nums ${data.investing.net < 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {data.investing.net < 0 ? `(${peso(data.investing.net)})` : peso(data.investing.net)}
                      </td>
                    </tr>

                    <tr><td colSpan={2} className="h-3" /></tr>

                    {/* ── Financing ── */}
                    <tr className="section-header">
                      <td colSpan={2} className="font-bold text-xs uppercase tracking-wide text-[var(--n-navy)] border-b border-[var(--n-navy)] pb-1 pt-2">
                        Financing Activities
                      </td>
                    </tr>
                    {data.financing.items.map((item, i) => (
                      <tr key={i} className="row">
                        <td className="pl-4 py-1 text-sm text-[var(--n-text-secondary)]">{item.label}</td>
                        <td className={`py-1 text-sm text-right tabular-nums ${item.amount < 0 ? 'text-red-600' : ''}`}>
                          {item.amount < 0 ? `(${peso(item.amount)})` : peso(item.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-dashed border-[var(--n-border)]">
                      <td className="py-1.5 font-semibold text-sm">Net Cash from Financing</td>
                      <td className={`py-1.5 font-semibold text-sm text-right tabular-nums ${data.financing.net < 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {data.financing.net < 0 ? `(${peso(data.financing.net)})` : peso(data.financing.net)}
                      </td>
                    </tr>

                    <tr><td colSpan={2} className="h-3" /></tr>

                    {/* ── Net Change ── */}
                    <tr className="border-t-2 border-[var(--n-navy)]">
                      <td className="py-2 font-bold text-base text-[var(--n-navy)]">
                        Net Increase / (Decrease) in Cash
                      </td>
                      <td className={`py-2 font-bold text-base text-right tabular-nums ${data.net_cash_flow < 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {data.net_cash_flow < 0 ? `(${peso(data.net_cash_flow)})` : peso(data.net_cash_flow)}
                      </td>
                    </tr>

                    <tr>
                      <td className="py-1 text-sm text-[var(--n-text-secondary)]">Opening Cash Balance</td>
                      <td className="py-1 text-sm text-right tabular-nums">{peso(data.cash_opening)}</td>
                    </tr>

                    {/* ── Closing Balance ── */}
                    <tr className="border-t-2 border-b-[3px]" style={{ borderBottomStyle: 'double', borderBottomWidth: 3, borderColor: 'var(--n-text)' }}>
                      <td className="py-3 font-bold text-lg">Closing Cash Balance</td>
                      <td className={`py-3 font-bold text-lg text-right tabular-nums ${data.cash_closing < 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {peso(data.cash_closing)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Payment Method Breakdown in print */}
                {data.payment_breakdown.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-[var(--n-border)]">
                    <h3 className="font-bold text-xs uppercase tracking-wide text-[var(--n-navy)] mb-2">
                      Collections by Payment Method
                    </h3>
                    {data.payment_breakdown.map((p) => (
                      <div key={p.method} className="flex justify-between text-sm py-1">
                        <span className="text-[var(--n-text-secondary)] pl-3">
                          {PAYMENT_LABELS[p.method] ?? p.method} ({p.count} transactions)
                        </span>
                        <span className="tabular-nums">{peso(p.total)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold text-sm pt-1.5 border-t border-dashed border-[var(--n-border)]">
                      <span>Total Collected</span>
                      <span className="tabular-nums text-green-700">{peso(data.total_collected)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
