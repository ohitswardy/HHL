import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { DatePicker } from '../../../components/ui/DatePicker';
import { Spinner } from '../../../components/ui/Spinner';
import api from '../../../lib/api';
import dayjs from 'dayjs';
import { HiPlus, HiTrash } from 'react-icons/hi';

/* ===================================================================
   Types
   =================================================================== */

interface AccountLine {
  code: string;
  name: string;
  balance: number;
}

interface EditableLine {
  id: string;
  code: string;
  name: string;
  balance: number;
  isCustom: boolean;
}

type Section = 'ar' | 'currentAssets' | 'fixedAssets' | 'currentLiabilities' | 'nonCurrentLiabilities' | 'equity';

/* ===================================================================
   Helpers
   =================================================================== */

const ACCOUNT_HINTS: Record<string, string> = {
  '1010': 'All payments where CASH was used',
  '1020': 'All payments where BANKS were used',
  '1100': 'All receipts/invoices not yet paid',
  '1120': 'Allowance for uncollectable receivables',
  '1200': 'Value of inventory currently on hand',
  '1400': 'VAT amounts from COGS VAT (12% from VAT-registered suppliers)',
  '2010': 'Unpaid bills to suppliers',
  '2020': 'Accrued expenses not yet billed',
  '2100': 'VAT amounts from VATable Sales (12% collected, owed to BIR)',
  '2110': 'Income tax payable to BIR',
};

const fmtAbs = (n: number) =>
  new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Math.abs(n),
  );

const formatPeso = (n: number) => (n < 0 ? `−₱${fmtAbs(n)}` : `₱${fmtAbs(n)}`);

let _uid = 1;
const uid = () => `b${_uid++}`;

const toEditable = (lines: AccountLine[], pfx: string): EditableLine[] =>
  lines.map((l, i) => ({
    id: pfx + (l.code || String(i)),
    code: l.code,
    name: l.name,
    balance: l.balance,
    isCustom: false,
  }));

const escHtml = (s: string) => {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
};

/* ===================================================================
   EditableAmount
   =================================================================== */

function EditableAmount({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  const start = () => { setRaw(value.toFixed(2)); setEditing(true); };
  const commit = () => { setEditing(false); const n = parseFloat(raw.replace(/,/g, '')); if (!isNaN(n)) onChange(n); };

  if (editing) {
    return (
      <input autoFocus type="text" value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }}
        className="w-32 text-right text-sm tabular-nums border-b-2 border-amber-500 bg-amber-50 outline-none px-2 py-0.5 rounded-sm"
      />
    );
  }

  return (
    <span role="button" tabIndex={0} onClick={start}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') start(); }}
      className="inline-block min-w-[7rem] text-right text-sm tabular-nums px-2 py-0.5 rounded-sm border-b border-dashed border-gray-300 hover:border-amber-400 hover:bg-amber-50/50 focus:border-amber-400 transition-colors cursor-text outline-none"
      title="Click to edit">
      {formatPeso(value)}
    </span>
  );
}

/* ===================================================================
   EditableName
   =================================================================== */

function EditableName({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const [editing, setEditing] = useState(!value);
  const [raw, setRaw] = useState(value);

  const commit = () => { setEditing(false); if (raw.trim()) onChange(raw.trim()); };

  if (editing || !value) {
    return (
      <input autoFocus type="text" value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="w-full text-sm border-b-2 border-amber-500 bg-amber-50 outline-none px-1 py-0.5 rounded-sm"
        placeholder="Enter account name..."
      />
    );
  }

  return (
    <span role="button" tabIndex={0}
      onClick={() => { setRaw(value); setEditing(true); }}
      className="text-sm px-1 py-0.5 rounded-sm border-b border-dashed border-transparent hover:border-gray-300 transition-colors cursor-text">
      {value}
    </span>
  );
}

/* ===================================================================
   Main component
   =================================================================== */

export function BalanceSheetPage() {
  const [asOf, setAsOf] = useState(dayjs().format('YYYY-MM-DD'));

  const [asOfDate, setAsOfDate] = useState<string | null>(null);
  const [ar, setAr] = useState<EditableLine[]>([]);
  const [currentAssets, setCurrentAssets] = useState<EditableLine[]>([]);
  const [fixedAssets, setFixedAssets] = useState<EditableLine[]>([]);
  const [currentLiabilities, setCurrentLiabilities] = useState<EditableLine[]>([]);
  const [nonCurrentLiabilities, setNonCurrentLiabilities] = useState<EditableLine[]>([]);
  const [equity, setEquity] = useState<EditableLine[]>([]);
  const [netIncome, setNetIncome] = useState(0);
  const [origSnapshot, setOrigSnapshot] = useState('');

  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  /* Computed totals */
  const totalAR = ar.reduce((s, l) => s + l.balance, 0);
  const totalOtherCurrent = currentAssets.reduce((s, l) => s + l.balance, 0);
  const totalCurrentAssets = totalAR + totalOtherCurrent;
  const totalFixedAssets = fixedAssets.reduce((s, l) => s + l.balance, 0);
  const totalAssets = totalCurrentAssets + totalFixedAssets;

  const totalCurrentLiab = currentLiabilities.reduce((s, l) => s + l.balance, 0);
  const totalNonCurrentLiab = nonCurrentLiabilities.reduce((s, l) => s + l.balance, 0);
  const totalLiabilities = totalCurrentLiab + totalNonCurrentLiab;

  const totalEquityAccts = equity.reduce((s, l) => s + l.balance, 0);
  const totalEquity = totalEquityAccts + netIncome;
  const totalLiabEquity = totalLiabilities + totalEquity;
  const isBalanced = Math.abs(totalAssets - totalLiabEquity) < 0.01;

  const hasData = asOfDate !== null;
  const isModified = hasData && JSON.stringify({ ar, currentAssets, fixedAssets, currentLiabilities, nonCurrentLiabilities, equity, netIncome }) !== origSnapshot;

  /* Section updaters */
  const setterOf = (s: Section) => {
    switch (s) {
      case 'ar': return setAr;
      case 'currentAssets': return setCurrentAssets;
      case 'fixedAssets': return setFixedAssets;
      case 'currentLiabilities': return setCurrentLiabilities;
      case 'nonCurrentLiabilities': return setNonCurrentLiabilities;
      case 'equity': return setEquity;
    }
  };

  const updateBalance = (sec: Section, id: string, balance: number) =>
    setterOf(sec)((prev) => prev.map((l) => (l.id === id ? { ...l, balance } : l)));
  const updateName = (sec: Section, id: string, name: string) =>
    setterOf(sec)((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)));
  const addLine = (sec: Section) =>
    setterOf(sec)((prev) => [...prev, { id: uid(), code: '', name: '', balance: 0, isCustom: true }]);
  const removeLine = (sec: Section, id: string) =>
    setterOf(sec)((prev) => prev.filter((l) => l.id !== id));

  /* Generate from API */
  const generate = () => {
    setLoading(true);
    api.get('/accounting/reports/balance-sheet', { params: { as_of_date: asOf } })
      .then((res) => {
        const d = res.data;
        setAsOfDate(d.as_of_date);
        const arData = toEditable(d.accounts_receivable, 'ar');
        const caData = toEditable(d.other_current_assets, 'ca');
        const faData = toEditable(d.fixed_assets, 'fa');
        const clData = toEditable(d.current_liabilities, 'cl');
        const nclData = toEditable(d.non_current_liabilities, 'ncl');
        const eqData = toEditable(d.equity_accounts, 'eq');
        const ni = d.net_income;
        setAr(arData); setCurrentAssets(caData); setFixedAssets(faData);
        setCurrentLiabilities(clData); setNonCurrentLiabilities(nclData);
        setEquity(eqData); setNetIncome(ni);
        setOrigSnapshot(JSON.stringify({ ar: arData, currentAssets: caData, fixedAssets: faData, currentLiabilities: clData, nonCurrentLiabilities: nclData, equity: eqData, netIncome: ni }));
      })
      .finally(() => setLoading(false));
  };

  const reset = () => {
    if (!origSnapshot) return;
    const orig = JSON.parse(origSnapshot);
    setAr(orig.ar); setCurrentAssets(orig.currentAssets); setFixedAssets(orig.fixedAssets);
    setCurrentLiabilities(orig.currentLiabilities); setNonCurrentLiabilities(orig.nonCurrentLiabilities);
    setEquity(orig.equity); setNetIncome(orig.netIncome);
  };

  const buildPayload = () => ({
    as_of_date: asOfDate,
    accounts_receivable: ar.filter((l) => l.name).map(({ name, balance }) => ({ name, balance })),
    total_accounts_receivable: totalAR,
    other_current_assets: currentAssets.filter((l) => l.name).map(({ name, balance }) => ({ name, balance })),
    total_current_assets: totalCurrentAssets,
    fixed_assets: fixedAssets.filter((l) => l.name).map(({ name, balance }) => ({ name, balance })),
    total_fixed_assets: totalFixedAssets,
    total_assets: totalAssets,
    current_liabilities: currentLiabilities.filter((l) => l.name).map(({ name, balance }) => ({ name, balance })),
    total_current_liabilities: totalCurrentLiab,
    non_current_liabilities: nonCurrentLiabilities.filter((l) => l.name).map(({ name, balance }) => ({ name, balance })),
    total_non_current_liabilities: totalNonCurrentLiab,
    total_liabilities: totalLiabilities,
    equity_accounts: equity.filter((l) => l.name).map(({ name, balance }) => ({ name, balance })),
    net_income: netIncome,
    total_equity: totalEquity,
    total_liabilities_equity: totalLiabEquity,
  });

  const downloadPdf = () => {
    setPdfLoading(true);
    api.post('/accounting/reports/balance-sheet/pdf', buildPayload(), { responseType: 'blob' })
      .then((res) => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url; a.download = 'balance-sheet-as-of-' + asOfDate + '.pdf'; a.click();
        window.URL.revokeObjectURL(url);
      })
      .finally(() => setPdfLoading(false));
  };

  /* Print */
  const handlePrint = () => {
    if (!asOfDate) return;
    const p = buildPayload();
    const fmtBal = (n: number) => (n < 0 ? '\u2212\u20B1' + fmtAbs(n) : '\u20B1' + fmtAbs(n));
    const line = (name: string, bal: number, indent = '28px') =>
      '<tr class="row"><td style="padding-left:' + indent + '">' + escHtml(name) + '</td><td class="amount' + (bal < 0 ? ' negative' : '') + '">' + fmtBal(bal) + '</td></tr>';
    const indentLine = (name: string, bal: number) => line(name, bal, '40px');
    const subTotalRow = (label: string, bal: number) =>
      '<tr class="sub-total"><td>' + escHtml(label) + '</td><td class="amount">' + fmtBal(bal) + '</td></tr>';
    const totalRow = (label: string, bal: number) =>
      '<tr class="total-row"><td>' + escHtml(label) + '</td><td class="amount">' + fmtBal(bal) + '</td></tr>';
    const spacer = '<tr class="spacer"><td colspan="2"></td></tr>';

    let rows = '';
    rows += '<tr class="section"><td colspan="2">Assets</td></tr>';
    rows += '<tr class="sub-section"><td colspan="2">Current Assets</td></tr>';
    if (p.accounts_receivable.length > 0) {
      rows += '<tr class="sub-sub"><td colspan="2">Accounts Receivable</td></tr>';
      p.accounts_receivable.forEach((a) => { rows += indentLine(a.name, a.balance); });
      rows += subTotalRow('Total for Accounts Receivable', p.total_accounts_receivable);
    }
    p.other_current_assets.forEach((a) => { rows += line(a.name, a.balance); });
    rows += totalRow('Total for Current Assets', p.total_current_assets);
    rows += spacer;
    if (p.fixed_assets.length > 0) {
      rows += '<tr class="sub-section"><td colspan="2">Fixed Assets</td></tr>';
      p.fixed_assets.forEach((a) => { rows += line(a.name, a.balance); });
      rows += totalRow('Total for Fixed Assets', p.total_fixed_assets);
      rows += spacer;
    }
    rows += '<tr class="section-total"><td>Total for Assets</td><td class="amount">' + fmtBal(p.total_assets) + '</td></tr>';
    rows += spacer;
    rows += '<tr class="section"><td colspan="2">Liabilities and Shareholder\'s Equity</td></tr>';
    if (p.current_liabilities.length > 0) {
      rows += '<tr class="sub-section"><td colspan="2">Current Liabilities</td></tr>';
      p.current_liabilities.forEach((a) => { rows += line(a.name, a.balance); });
      rows += subTotalRow('Total for Current Liabilities', p.total_current_liabilities);
      rows += spacer;
    }
    rows += '<tr class="sub-section"><td colspan="2">Non-current Liabilities</td></tr>';
    if (p.non_current_liabilities.length > 0) {
      p.non_current_liabilities.forEach((a) => { rows += line(a.name, a.balance); });
      rows += subTotalRow('Total for Non-current Liabilities', p.total_non_current_liabilities);
    }
    rows += spacer;
    rows += '<tr class="sub-section"><td colspan="2">Shareholder\'s Equity</td></tr>';
    p.equity_accounts.forEach((a) => { rows += line(a.name, a.balance); });
    rows += '<tr class="sub-sub"><td colspan="2">Retained Earnings</td></tr>';
    rows += indentLine('Net Income', p.net_income);
    rows += subTotalRow('Total for Shareholder\'s Equity', p.total_equity);
    rows += spacer;
    rows += '<tr class="grand-total"><td>Total for Liabilities and Shareholder\'s Equity</td><td class="amount">' + fmtBal(p.total_liabilities_equity) + '</td></tr>';

    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Balance Sheet</title><style>'
      + '* { margin:0; padding:0; box-sizing:border-box; }'
      + 'body { font-family:"Segoe UI",Arial,sans-serif; font-size:12px; color:#111; padding:32px 48px; }'
      + 'h1 { font-size:20px; font-weight:400; text-align:center; margin-bottom:4px; }'
      + 'h2 { font-size:14px; font-weight:700; text-align:center; text-transform:uppercase; margin-bottom:4px; }'
      + 'h3 { font-size:11px; text-align:center; color:#555; margin-bottom:20px; }'
      + 'table { width:100%; border-collapse:collapse; }'
      + '.col-hdr { text-align:right; font-size:9px; font-weight:700; color:#555; text-transform:uppercase; padding-bottom:6px; border-bottom:1px solid #ccc; }'
      + '.section td { font-weight:700; font-size:11px; padding:10px 0 3px; color:#222; }'
      + '.sub-section td { font-weight:600; font-size:10.5px; padding:4px 0 2px 12px; color:#333; }'
      + '.sub-sub td { font-weight:600; font-size:10px; padding:3px 0 2px 24px; color:#444; }'
      + '.row td { padding:3px 0 3px 28px; color:#444; font-size:11px; }'
      + '.amount { text-align:right; font-variant-numeric:tabular-nums; color:#222; }'
      + '.sub-total td { font-weight:600; padding:4px 0; border-top:1px solid #ddd; font-size:10.5px; }'
      + '.sub-total .amount { text-align:right; }'
      + '.total-row td { font-weight:700; padding:5px 0; border-top:1px solid #bbb; font-size:11px; }'
      + '.total-row .amount { text-align:right; }'
      + '.section-total td { font-weight:700; font-size:12px; padding:7px 0; border-top:1px solid #999; }'
      + '.grand-total td { font-weight:700; font-size:13px; padding:8px 0; border-top:2px solid #111; border-bottom:3px double #111; }'
      + '.spacer td { height:6px; }'
      + '.negative { color:#c0392b; }'
      + '.footer { margin-top:28px; font-size:9px; color:#999; text-align:center; }'
      + '</style></head><body>'
      + '<h1>Balance Sheet</h1>'
      + '<h2>HardhatLedger</h2>'
      + '<h3>As of ' + dayjs(asOfDate).format('D MMMM, YYYY') + '</h3>'
      + '<table><tr><td style="width:60%"></td><td class="col-hdr" style="width:40%">TOTAL</td></tr>'
      + rows
      + '</table>'
      + '<div class="footer">Accrual Basis \u00A0 ' + dayjs().format('dddd, DD MMMM YYYY hh:mm A') + ' GMTZ' + (isModified ? ' \u00A0\u2022\u00A0 Contains user adjustments' : '') + '</div>'
      + '</body></html>';

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

  /* Render editable section rows */
  const renderRows = (sec: Section, lines: EditableLine[], indent = 'pl-7') =>
    lines.map((line) => (
      <tr key={line.id}>
        <td className={'py-1 text-sm ' + indent} style={{ color: 'var(--n-text-secondary)' }}>
          {line.isCustom ? (
            <EditableName value={line.name} onChange={(n) => updateName(sec, line.id, n)} />
          ) : (
            <span title={ACCOUNT_HINTS[line.code] || ''}>{line.name}</span>
          )}
          {ACCOUNT_HINTS[line.code] && !line.isCustom && (
            <span className="block text-xs opacity-50 pl-1">{ACCOUNT_HINTS[line.code]}</span>
          )}
        </td>
        <td className="py-1 text-right">
          <EditableAmount value={line.balance} onChange={(n) => updateBalance(sec, line.id, n)} />
        </td>
        <td className="py-1 pl-2 w-8">
          {line.isCustom && (
            <button onClick={() => removeLine(sec, line.id)}
              className="text-red-400 hover:text-red-600 transition-colors" title="Remove">
              <HiTrash className="w-3.5 h-3.5" />
            </button>
          )}
        </td>
      </tr>
    ));

  const renderAddBtn = (sec: Section, indent = 'pl-7') => (
    <tr>
      <td colSpan={3} className="pt-1 pb-2">
        <button onClick={() => addLine(sec)}
          className={'flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium ' + indent + ' transition-colors'}>
          <HiPlus className="w-3 h-3" /> Add line
        </button>
      </td>
    </tr>
  );

  /* JSX */
  return (
    <div>
      <h1 className="neu-page-title" style={{ marginBottom: '1.5rem' }}>Balance Sheet</h1>

      {/* Controls */}
      <Card className="p-4 mb-4">
        <div className="flex gap-4 items-end flex-wrap">
          <DatePicker label="As of Date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          <Button variant="amber" onClick={generate} loading={loading}>Generate</Button>
          {hasData && (
            <>
              <Button variant="outline" onClick={handlePrint}>Print</Button>
              <Button variant="outline" onClick={downloadPdf} loading={pdfLoading}>Download PDF</Button>
              {isModified && <Button variant="secondary" onClick={reset}>Reset</Button>}
            </>
          )}
        </div>
      </Card>

      {/* How to Read */}
      {hasData && (
        <Card className="p-4 mb-4" style={{ background: 'var(--n-surface-alt, #f8f9fb)' }}>
          <button onClick={() => setShowHelp(!showHelp)}
            className="flex items-center gap-2 text-sm font-semibold w-full text-left"
            style={{ color: 'var(--n-text)' }}>
            <span className="text-amber-500 text-base">{'\u2139'}</span>
            How to Read This Report
            <span className="ml-auto text-xs opacity-60">{showHelp ? '\u25B2 Hide' : '\u25BC Show'}</span>
          </button>
          {showHelp && (
            <div className="mt-3 text-sm space-y-2" style={{ color: 'var(--n-text-secondary)' }}>
              <p><strong>Accounts Receivable</strong> = All customer invoices/receipts <em>NOT YET PAID</em></p>
              <p><strong>Cash and Cash Equivalents</strong> = All payments where <em>CASH</em> was used</p>
              <p><strong>Banks</strong> = All payments where <em>BANKS</em> were used</p>
              <p className="text-xs opacity-70 pl-4">{'\uD83D\uDCA1'} Use &quot;+ Add line&quot; to list individual bank accounts with their last 4 digits (e.g., &quot;BDO - 2074&quot;)</p>
              <p><strong>VAT on Purchases</strong> (Input VAT) = 12% VAT from purchases with VAT-registered suppliers {'\u2014'} claimable from BIR</p>
              <p><strong>VAT Payable</strong> (under Liabilities) = 12% VAT collected on VATable sales {'\u2014'} owed to BIR</p>
              <div className="pl-4 rounded p-3 text-xs"
                style={{ background: 'rgba(255,255,255,0.6)', border: '1px dashed var(--n-border, #ddd)' }}>
                <strong>Example:</strong> 1 box blind rivet sold at {'\u20B1'}460
                <br />{'\u2022'} {'\u20B1'}410.71 goes to Income Statement revenue
                <br />{'\u2022'} <strong>{'\u20B1'}49.29</strong> VAT goes to <em>VAT Payable</em> here on the Balance Sheet
              </div>
              <p><strong>Net Income</strong> = Your total profit from the Income Statement (Revenue {'\u2212'} Cost of Sales {'\u2212'} Expenses)</p>
              <p className="font-semibold">{'\u2696\uFE0F'} Total Assets <em>MUST</em> equal Total Liabilities + Shareholder&apos;s Equity</p>
              <p className="text-xs opacity-80 pt-1">{'\uD83D\uDCA1'} Click any amount to adjust it before printing. Use &quot;+ Add line&quot; for manual adjustments. Totals update automatically.</p>
            </div>
          )}
        </Card>
      )}

      {loading && <Spinner />}

      {/* Report */}
      {hasData && (
        <Card className="p-6">
          {isModified && (
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">{'\u25CF'} Modified</span>
              <span className="text-xs" style={{ color: 'var(--n-text-secondary)' }}>Values have been adjusted {'\u2014'} PDF and Print will use the modified values</span>
            </div>
          )}

          {!isBalanced && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
              {'\u26A0\uFE0F'} <strong>Out of balance:</strong> Total Assets ({formatPeso(totalAssets)}) {'\u2260'} Liabilities + Equity ({formatPeso(totalLiabEquity)}) {'\u2014'} Difference: {formatPeso(totalAssets - totalLiabEquity)}
            </div>
          )}

          <h1 className="text-xl text-center mb-1" style={{ fontWeight: 400, color: 'var(--n-text)' }}>Balance Sheet</h1>
          <h2 className="text-sm font-bold text-center uppercase mb-1" style={{ color: 'var(--n-text)' }}>HardhatLedger</h2>
          <h3 className="text-xs text-center mb-6" style={{ color: 'var(--n-text-secondary)' }}>As of {dayjs(asOfDate).format('D MMM, YYYY')}</h3>

          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <td style={{ width: '55%' }}></td>
                <td className="text-right text-xs font-bold uppercase pb-1.5 border-b" style={{ width: '35%', color: 'var(--n-text-secondary)', borderColor: 'var(--n-border)' }}>TOTAL</td>
                <td style={{ width: '10%' }}></td>
              </tr>
            </thead>
            <tbody>
              {/* ASSETS */}
              <tr><td colSpan={3} className="font-bold text-sm pt-4 pb-1" style={{ color: 'var(--n-text)' }}>Assets</td></tr>
              <tr><td colSpan={3} className="font-semibold text-sm pl-3 pt-1 pb-0.5" style={{ color: 'var(--n-text)' }}>Current Assets</td></tr>

              {/* AR sub-group */}
              {ar.length > 0 && (
                <>
                  <tr><td colSpan={3} className="font-semibold text-xs pl-6 pt-1" style={{ color: 'var(--n-text-secondary)' }}>Accounts Receivable</td></tr>
                  {renderRows('ar', ar, 'pl-10')}
                  {renderAddBtn('ar', 'pl-10')}
                  <tr className="border-t" style={{ borderColor: 'var(--n-border)' }}>
                    <td className="pl-6 py-1 text-sm font-semibold" style={{ color: 'var(--n-text)' }}>Total for Accounts Receivable</td>
                    <td className="py-1 text-sm text-right font-semibold tabular-nums">{formatPeso(totalAR)}</td>
                    <td></td>
                  </tr>
                </>
              )}
              {ar.length === 0 && renderAddBtn('ar', 'pl-10')}

              {/* Other Current Assets */}
              {renderRows('currentAssets', currentAssets)}
              {renderAddBtn('currentAssets')}

              <tr className="border-t" style={{ borderColor: 'var(--n-border)' }}>
                <td className="pl-3 py-1.5 text-sm font-bold" style={{ color: 'var(--n-text)' }}>Total for Current Assets</td>
                <td className="py-1.5 text-sm text-right font-bold tabular-nums">{formatPeso(totalCurrentAssets)}</td>
                <td></td>
              </tr>

              <tr><td colSpan={3} className="h-2" /></tr>

              {/* Fixed Assets */}
              <tr><td colSpan={3} className="font-semibold text-sm pl-3 pt-1 pb-0.5" style={{ color: 'var(--n-text)' }}>Fixed Assets</td></tr>
              {renderRows('fixedAssets', fixedAssets)}
              {renderAddBtn('fixedAssets')}
              {fixedAssets.length > 0 && (
                <tr className="border-t" style={{ borderColor: 'var(--n-border)' }}>
                  <td className="pl-3 py-1.5 text-sm font-bold" style={{ color: 'var(--n-text)' }}>Total for Fixed Assets</td>
                  <td className="py-1.5 text-sm text-right font-bold tabular-nums">{formatPeso(totalFixedAssets)}</td>
                  <td></td>
                </tr>
              )}

              <tr><td colSpan={3} className="h-2" /></tr>

              {/* Total Assets */}
              <tr className="border-t" style={{ borderColor: 'var(--n-border)' }}>
                <td className="py-2 font-bold text-base" style={{ color: 'var(--n-text)' }}>Total for Assets</td>
                <td className="py-2 font-bold text-base text-right tabular-nums">{formatPeso(totalAssets)}</td>
                <td></td>
              </tr>

              <tr><td colSpan={3} className="h-4" /></tr>

              {/* LIABILITIES & EQUITY */}
              <tr><td colSpan={3} className="font-bold text-sm pt-2 pb-1" style={{ color: 'var(--n-text)' }}>Liabilities and Shareholder&apos;s Equity</td></tr>

              {/* Current Liabilities */}
              <tr><td colSpan={3} className="font-semibold text-sm pl-3 pt-1 pb-0.5" style={{ color: 'var(--n-text)' }}>Current Liabilities</td></tr>
              {renderRows('currentLiabilities', currentLiabilities)}
              {renderAddBtn('currentLiabilities')}
              {currentLiabilities.length > 0 && (
                <tr className="border-t" style={{ borderColor: 'var(--n-border)' }}>
                  <td className="pl-3 py-1.5 text-sm font-bold" style={{ color: 'var(--n-text)' }}>Total for Current Liabilities</td>
                  <td className="py-1.5 text-sm text-right font-bold tabular-nums">{formatPeso(totalCurrentLiab)}</td>
                  <td></td>
                </tr>
              )}

              <tr><td colSpan={3} className="h-2" /></tr>

              {/* Non-current Liabilities */}
              <tr><td colSpan={3} className="font-semibold text-sm pl-3 pt-1 pb-0.5" style={{ color: 'var(--n-text)' }}>Non-current Liabilities</td></tr>
              {renderRows('nonCurrentLiabilities', nonCurrentLiabilities)}
              {renderAddBtn('nonCurrentLiabilities')}
              {nonCurrentLiabilities.length > 0 && (
                <tr className="border-t" style={{ borderColor: 'var(--n-border)' }}>
                  <td className="pl-3 py-1.5 text-sm font-bold" style={{ color: 'var(--n-text)' }}>Total for Non-current Liabilities</td>
                  <td className="py-1.5 text-sm text-right font-bold tabular-nums">{formatPeso(totalNonCurrentLiab)}</td>
                  <td></td>
                </tr>
              )}

              <tr><td colSpan={3} className="h-2" /></tr>

              {/* Shareholder's Equity */}
              <tr><td colSpan={3} className="font-semibold text-sm pl-3 pt-1 pb-0.5" style={{ color: 'var(--n-text)' }}>Shareholder&apos;s Equity</td></tr>
              {renderRows('equity', equity)}
              {renderAddBtn('equity')}

              {/* Net Income */}
              <tr><td colSpan={3} className="font-semibold text-xs pl-6 pt-1" style={{ color: 'var(--n-text-secondary)' }}>Retained Earnings</td></tr>
              <tr>
                <td className="pl-10 py-1 text-sm" style={{ color: 'var(--n-text-secondary)' }}>
                  <span title="Profit from Income Statement">Net Income</span>
                  <span className="block text-xs opacity-50 pl-1">From Income Statement (Revenue {'\u2212'} Cost of Sales {'\u2212'} Expenses)</span>
                </td>
                <td className="py-1 text-right"><EditableAmount value={netIncome} onChange={setNetIncome} /></td>
                <td></td>
              </tr>

              <tr className="border-t" style={{ borderColor: 'var(--n-border)' }}>
                <td className="pl-3 py-1.5 text-sm font-bold" style={{ color: 'var(--n-text)' }}>Total for Shareholder&apos;s Equity</td>
                <td className="py-1.5 text-sm text-right font-bold tabular-nums">{formatPeso(totalEquity)}</td>
                <td></td>
              </tr>

              <tr><td colSpan={3} className="h-4" /></tr>

              {/* GRAND TOTAL */}
              <tr style={{ borderTop: '2px solid var(--n-text)', borderBottom: '3px double var(--n-text)' }}>
                <td className="py-3 font-bold text-lg">Total for Liabilities and Shareholder&apos;s Equity</td>
                <td className={'py-3 font-bold text-lg text-right tabular-nums' + (!isBalanced ? ' text-red-700' : '')}>{formatPeso(totalLiabEquity)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <div className="mt-6 text-center text-xs" style={{ color: 'var(--n-text-secondary)' }}>
            Accrual Basis &nbsp; {dayjs().format('dddd, DD MMMM YYYY hh:mm A')} GMTZ
            {isModified && <span className="ml-2 text-amber-600 font-medium">{'\u2022'} Contains user adjustments</span>}
          </div>
        </Card>
      )}
    </div>
  );
}
