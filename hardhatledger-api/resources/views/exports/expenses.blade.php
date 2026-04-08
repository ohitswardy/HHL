<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Expense Report — HardhatLedger</title>
<style>
    /* ── Reset ── */
    * { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Page Setup ── */
    @page { margin: 68px 30px 52px 30px; }

    body {
        font-family: 'DejaVu Sans', sans-serif;
        font-size: 8.5pt;
        color: #2d3748;
        background: #fff;
        line-height: 1.35;
    }

    /* ── Fixed Page Header ── */
    .page-header {
        position: fixed;
        top: -58px;
        left: -30px;
        right: -30px;
        height: 54px;
        background: #1B3A5C;
        padding: 0 30px;
    }
    .page-header table { width: 100%; height: 54px; border-collapse: collapse; }
    .page-header td { vertical-align: middle; }
    .brand-name  { font-size: 13pt; font-weight: bold; color: #fff; letter-spacing: 0.5px; }
    .brand-sub   { font-size: 7.5pt; color: #F5A623; margin-top: 2px; }
    .header-right { text-align: right; }
    .report-title { font-size: 10pt; font-weight: bold; color: #fff; }
    .report-date  { font-size: 7pt; color: rgba(255,255,255,0.6); margin-top: 3px; }

    /* ── Amber accent bar under header ── */
    .accent-bar {
        position: fixed;
        top: -4px;
        left: -30px;
        right: -30px;
        height: 4px;
        background: #F5A623;
    }

    /* ── Fixed Page Footer ── */
    .page-footer {
        position: fixed;
        bottom: -42px;
        left: -30px;
        right: -30px;
        height: 38px;
        border-top: 1px solid #cbd5e0;
        padding: 0 30px;
    }
    .page-footer table { width: 100%; height: 38px; border-collapse: collapse; }
    .page-footer td { vertical-align: middle; font-size: 7pt; color: #a0aec0; }
    .footer-right { text-align: right; }

    /* ── Report Heading Row ── */
    .report-heading {
        border-bottom: 2px solid #1B3A5C;
        padding-bottom: 7px;
        margin-bottom: 10px;
    }
    .report-heading table { width: 100%; border-collapse: collapse; }
    .report-heading td { vertical-align: bottom; }
    .rh-title   { font-size: 15pt; font-weight: bold; color: #1B3A5C; }
    .rh-period  { font-size: 8pt; color: #4a5568; text-align: right; }

    /* ── Info Grid (3 cells) ── */
    .info-grid { margin-bottom: 10px; }
    .info-grid table {
        width: 100%;
        border-collapse: collapse;
        background: #f7fafc;
        border: 1px solid #e2e8f0;
    }
    .info-grid td {
        padding: 7px 12px;
        border-right: 1px solid #e2e8f0;
        width: 33.33%;
    }
    .info-grid td:last-child { border-right: none; }
    .info-label { font-size: 6.5pt; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
    .info-value { font-size: 9.5pt; font-weight: bold; color: #1B3A5C; }

    /* ── Summary Stats Bar ── */
    .stats-bar { margin-bottom: 12px; }
    .stats-bar table { width: 100%; border-collapse: collapse; }
    .stats-cell {
        padding: 9px 14px;
        text-align: center;
        background: #1B3A5C;
        border-right: 1px solid rgba(255,255,255,0.15);
        width: 25%;
    }
    .stats-cell:last-child { border-right: none; }
    .stats-label { font-size: 6.5pt; color: rgba(255,255,255,0.65); text-transform: uppercase; letter-spacing: 0.4px; }
    .stats-value { font-size: 11pt; font-weight: bold; color: #F5A623; margin-top: 3px; }

    /* ── Active Filters ── */
    .filter-row { font-size: 7.5pt; color: #718096; margin-bottom: 10px; }
    .filter-tag {
        display: inline;
        background: #edf2f7;
        border: 1px solid #e2e8f0;
        color: #4a5568;
        font-size: 7pt;
        padding: 1px 5px;
        margin-left: 4px;
    }

    /* ── Data Table ── */
    table.dt { width: 100%; border-collapse: collapse; font-size: 7.5pt; table-layout: fixed; }

    table.dt thead tr { background: #2d3748; }
    table.dt thead th {
        padding: 6px 7px;
        color: #fff;
        font-size: 7pt;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        text-align: left;
        white-space: nowrap;
    }
    table.dt thead th.r { text-align: right; }
    table.dt thead th.c { text-align: center; }

    table.dt tbody tr   { border-bottom: 1px solid #e8ecf0; }
    table.dt tbody tr.even { background: #f7fafc; }
    table.dt tbody tr.draft-row  { background: #fffbeb; }
    table.dt tbody tr.voided-row { opacity: 0.6; }

    table.dt tbody td { padding: 5px 7px; vertical-align: top; }
    table.dt tbody td.r { text-align: right; }
    table.dt tbody td.c { text-align: center; }
    table.dt tbody td.mono { font-family: 'Courier New', monospace; font-size: 7pt; }

    table.dt tfoot tr { background: #1B3A5C; }
    table.dt tfoot td {
        padding: 7px 7px;
        color: #fff;
        font-weight: bold;
        font-size: 8pt;
        border-top: 2px solid #F5A623;
    }
    table.dt tfoot td.r { text-align: right; color: #F5A623; }

    /* ── Badges ── */
    .badge {
        display: inline;
        padding: 1px 5px;
        font-size: 6.5pt;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }
    .b-recorded { background: #c6f6d5; color: #22543d; }
    .b-draft    { background: #feebc8; color: #744210; }
    .b-voided   { background: #fed7d7; color: #742a2a; }

    .src-po {
        display: inline;
        background: #ebf4ff;
        color: #1B3A5C;
        font-size: 6.5pt;
        font-weight: bold;
        padding: 1px 4px;
    }
    .src-manual { font-size: 7pt; color: #a0aec0; }

    .empty-msg { text-align: center; color: #a0aec0; padding: 30px; font-size: 9pt; }
</style>
</head>
<body>

{{-- ── Page Header (fixed, appears on every page) ── --}}
<div class="page-header">
    <table>
        <tr>
            <td>
                <div class="brand-name">HARDHATLEDGER</div>
                <div class="brand-sub">Construction Materials Supplier</div>
            </td>
            <td class="header-right">
                <div class="report-title">Expense Report</div>
                <div class="report-date">Generated: {{ $generatedAt->format('F d, Y  h:i A') }}</div>
            </td>
        </tr>
    </table>
</div>
<div class="accent-bar"></div>

{{-- ── Page Footer (fixed, appears on every page) ── --}}
<div class="page-footer">
    <table>
        <tr>
            <td>HardhatLedger &bull; Expense Report &bull; Confidential</td>
            <td class="footer-right">
                <script type="text/php">
                    if (isset($pdf)) {
                        $w = $pdf->get_width();
                        $h = $pdf->get_height();
                        $pdf->page_text($w - 95, $h - 26, "Page {PAGE_NUM} of {PAGE_COUNT}", null, 7.5, [160, 174, 192]);
                    }
                </script>
            </td>
        </tr>
    </table>
</div>

{{-- ════════════════════════════════════════════════════════════ --}}
{{-- ── Main Content ── --}}
{{-- ════════════════════════════════════════════════════════════ --}}

{{-- ── Report Heading ── --}}
<div class="report-heading">
    <table>
        <tr>
            <td><div class="rh-title">Expense Report</div></td>
            <td>
                <div class="rh-period">
                    @if($filters['from'] || $filters['to'])
                        Period:
                        <strong>{{ $filters['from'] ? \Carbon\Carbon::parse($filters['from'])->format('M d, Y') : 'Beginning' }}</strong>
                        &mdash;
                        <strong>{{ $filters['to'] ? \Carbon\Carbon::parse($filters['to'])->format('M d, Y') : 'Present' }}</strong>
                    @else
                        Period: <strong>All Time</strong>
                    @endif
                </div>
            </td>
        </tr>
    </table>
</div>

{{-- ── Info Grid ── --}}
<div class="info-grid">
    <table>
        <tr>
            <td>
                <div class="info-label">Status Filter</div>
                <div class="info-value">{{ $filters['status'] ? ucfirst($filters['status']) : 'All Statuses' }}</div>
            </td>
            <td>
                <div class="info-label">
                    @if($filters['category']) Category @elseif($filters['search']) Search Query @else Applied Filters @endif
                </div>
                <div class="info-value">
                    @if($filters['category']) {{ $filters['category'] }}
                    @elseif($filters['search']) &ldquo;{{ $filters['search'] }}&rdquo;
                    @else None @endif
                </div>
            </td>
            <td>
                <div class="info-label">Total Records</div>
                <div class="info-value">{{ $expenses->count() }} Expense{{ $expenses->count() !== 1 ? 's' : '' }}</div>
            </td>
        </tr>
    </table>
</div>

{{-- ── Stats Bar ── --}}
<div class="stats-bar">
    <table>
        <tr>
            <td class="stats-cell">
                <div class="stats-label">Total Amount</div>
                <div class="stats-value">&#8369;{{ number_format($totals['total_amount'], 2) }}</div>
            </td>
            <td class="stats-cell">
                <div class="stats-label">Subtotal (excl. VAT)</div>
                <div class="stats-value">&#8369;{{ number_format($totals['subtotal'], 2) }}</div>
            </td>
            <td class="stats-cell">
                <div class="stats-label">Total VAT / Tax</div>
                <div class="stats-value">&#8369;{{ number_format($totals['tax_amount'], 2) }}</div>
            </td>
            <td class="stats-cell">
                <div class="stats-label">Recorded &bull; Draft &bull; Voided</div>
                <div class="stats-value">{{ $totals['recorded_count'] }} &bull; {{ $totals['draft_count'] }} &bull; {{ $totals['voided_count'] }}</div>
            </td>
        </tr>
    </table>
</div>

{{-- ── Data Table ── --}}
@if($expenses->isEmpty())
    <div class="empty-msg">No expenses match the selected filters.</div>
@else
<table class="dt">
    <colgroup>
        <col style="width:20px">   {{-- # --}}
        <col style="width:102px">  {{-- Expense No --}}
        <col style="width:65px">   {{-- Date --}}
        <col>                      {{-- Payee (flex) --}}
        <col style="width:92px">   {{-- Category --}}
        <col style="width:78px">   {{-- Reference --}}
        <col style="width:44px">   {{-- Source --}}
        <col style="width:74px">   {{-- Subtotal --}}
        <col style="width:64px">   {{-- VAT --}}
        <col style="width:78px">   {{-- Total --}}
        <col style="width:52px">   {{-- Status --}}
    </colgroup>
    <thead>
        <tr>
            <th>#</th>
            <th>Expense No.</th>
            <th>Date</th>
            <th>Payee</th>
            <th>Category</th>
            <th>Reference</th>
            <th class="c">Source</th>
            <th class="r">Subtotal</th>
            <th class="r">VAT</th>
            <th class="r">Total</th>
            <th class="c">Status</th>
        </tr>
    </thead>
    <tbody>
        @foreach($expenses as $i => $expense)
        @php
            $rowClass = match($expense->status) {
                'draft'  => 'draft-row',
                'voided' => 'voided-row',
                default  => ($i % 2 === 1 ? 'even' : ''),
            };
        @endphp
        <tr class="{{ $rowClass }}">
            <td style="color:#a0aec0; font-size:7pt;">{{ $i + 1 }}</td>
            <td class="mono">{{ $expense->expense_number }}</td>
            <td>{{ \Carbon\Carbon::parse($expense->date)->format('M d, Y') }}</td>
            <td>
                {{ $expense->payee }}
                @if($expense->supplier && $expense->supplier->name !== $expense->payee)
                    <br><span style="font-size:6.5pt; color:#718096;">{{ $expense->supplier->name }}</span>
                @endif
            </td>
            <td style="font-size:7.5pt;">{{ $expense->category?->name ?? '&mdash;' }}</td>
            <td class="mono">{{ $expense->reference_number ?? '&mdash;' }}</td>
            <td class="c">
                @if($expense->source === 'purchase_order')
                    <span class="src-po">PO</span>
                @else
                    <span class="src-manual">Manual</span>
                @endif
            </td>
            <td class="r">&#8369;{{ number_format((float)$expense->subtotal, 2) }}</td>
            <td class="r">
                @if((float)$expense->tax_amount > 0)
                    &#8369;{{ number_format((float)$expense->tax_amount, 2) }}
                @else
                    &mdash;
                @endif
            </td>
            <td class="r" style="font-weight:bold;">&#8369;{{ number_format((float)$expense->total_amount, 2) }}</td>
            <td class="c">
                <span class="badge b-{{ $expense->status }}">{{ $expense->status }}</span>
            </td>
        </tr>
        @endforeach
    </tbody>
    <tfoot>
        <tr>
            <td colspan="7" style="font-size:7.5pt; letter-spacing:0.5px; color:rgba(255,255,255,0.8);">
                TOTALS &mdash; {{ $expenses->count() }} record{{ $expenses->count() !== 1 ? 's' : '' }}
            </td>
            <td class="r">&#8369;{{ number_format($totals['subtotal'], 2) }}</td>
            <td class="r">&#8369;{{ number_format($totals['tax_amount'], 2) }}</td>
            <td class="r">&#8369;{{ number_format($totals['total_amount'], 2) }}</td>
            <td></td>
        </tr>
    </tfoot>
</table>
@endif

</body>
</html>
