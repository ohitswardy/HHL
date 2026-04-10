@extends('layouts.pdf')

@section('title', 'Profit and Loss — HardhatLedger')

@section('doc-title', 'Profit and Loss')

@section('doc-meta')
{{ \Carbon\Carbon::parse($period['start'])->format('M d') }}&ndash;{{ \Carbon\Carbon::parse($period['end'])->format('M d, Y') }}
@endsection

@section('extra-styles')
<style>
        body {
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 11px;
            color: #222;
            background: #fff;
        }
        .page { padding: 6px 8px; }

        /* ── Header ── */
        .report-title {
            font-size: 20px;
            font-weight: 400;
            text-align: center;
            color: #222;
            margin-bottom: 6px;
        }
        .company-name {
            font-size: 13px;
            font-weight: 700;
            text-align: center;
            color: #222;
            text-transform: uppercase;
            margin-bottom: 4px;
        }
        .report-period {
            font-size: 10px;
            text-align: center;
            color: #555;
            margin-bottom: 24px;
        }

        /* ── Table ── */
        .report-table {
            width: 100%;
            border-collapse: collapse;
        }
        .report-table td {
            padding: 4px 0;
            font-size: 10.5px;
            vertical-align: top;
        }

        /* Column header */
        .col-header {
            text-align: right;
            font-size: 9px;
            font-weight: 700;
            color: #555;
            text-transform: uppercase;
            padding-bottom: 6px;
            border-bottom: 1px solid #ccc;
        }

        /* Section header (Income, Cost of Sales, etc.) */
        .section-header td {
            font-weight: 700;
            font-size: 10.5px;
            color: #222;
            padding-top: 10px;
            padding-bottom: 3px;
        }

        /* Sub-section header (Other Expenses) */
        .sub-section td {
            font-weight: 600;
            font-size: 10px;
            color: #333;
            padding-top: 4px;
            padding-left: 12px;
        }

        /* Account line item */
        .line-item td {
            padding: 3px 0 3px 16px;
            color: #444;
        }
        .line-item td.amount {
            text-align: right;
            font-variant-numeric: tabular-nums;
            padding-left: 0;
            color: #222;
        }

        /* Total row */
        .total-row td {
            font-weight: 700;
            font-size: 10.5px;
            padding: 5px 0;
            border-top: 1px solid #bbb;
        }
        .total-row td.amount {
            text-align: right;
            font-variant-numeric: tabular-nums;
        }

        /* Gross Profit row */
        .gross-profit td {
            font-weight: 700;
            font-size: 11px;
            padding: 7px 0;
            border-top: 1px solid #999;
        }
        .gross-profit td.amount {
            text-align: right;
            font-variant-numeric: tabular-nums;
        }

        /* Net Income row */
        .net-income td {
            font-weight: 700;
            font-size: 12px;
            padding: 8px 0;
            border-top: 2px solid #222;
            border-bottom: 3px double #222;
        }
        .net-income td.amount {
            text-align: right;
            font-variant-numeric: tabular-nums;
        }

        /* Spacer */
        .spacer td { height: 6px; }

        .negative { color: #c0392b; }
</style>
@endsection

@section('content')
<div class="page">

    <div class="report-title">Profit and Loss</div>
    <div class="company-name">HardhatLedger</div>
    <div class="report-period">
        {{ \Carbon\Carbon::parse($period['start'])->format('j F') }}&ndash;{{ \Carbon\Carbon::parse($period['end'])->format('j F, Y') }}
    </div>

    <table class="report-table">

        {{-- Column Header --}}
        <tr>
            <td style="width: 65%;"></td>
            <td class="col-header" style="width: 35%;">TOTAL</td>
        </tr>

        {{-- ── INCOME ── --}}
        <tr class="section-header"><td colspan="2">Income</td></tr>

        @foreach($income as $account)
        <tr class="line-item">
            <td>{{ $account['name'] }}</td>
            <td class="amount">&#8369;{{ number_format($account['amount'], 2) }}</td>
        </tr>
        @endforeach

        <tr class="total-row">
            <td>Total for Income</td>
            <td class="amount">&#8369;{{ number_format($total_income, 2) }}</td>
        </tr>

        <tr class="spacer"><td colspan="2"></td></tr>

        {{-- ── COST OF SALES ── --}}
        <tr class="section-header"><td colspan="2">Cost of Sales</td></tr>

        @foreach($cost_of_sales as $account)
        <tr class="line-item">
            <td>{{ $account['name'] }}</td>
            <td class="amount">&#8369;{{ number_format($account['amount'], 2) }}</td>
        </tr>
        @endforeach

        <tr class="total-row">
            <td>Total for Cost of Sales</td>
            <td class="amount">&#8369;{{ number_format($total_cost_of_sales, 2) }}</td>
        </tr>

        <tr class="spacer"><td colspan="2"></td></tr>

        {{-- ── GROSS PROFIT ── --}}
        <tr class="gross-profit">
            <td>Gross Profit</td>
            <td class="amount">&#8369;{{ number_format($gross_profit, 2) }}</td>
        </tr>

        <tr class="spacer"><td colspan="2"></td></tr>

        {{-- ── EXPENSES ── --}}
        @if(count($other_expense_accounts) > 0)
        <tr class="section-header"><td colspan="2">Expenses</td></tr>
        <tr class="sub-section"><td colspan="2">Other Expenses</td></tr>

        @foreach($other_expense_accounts as $account)
        <tr class="line-item">
            <td>{{ $account['name'] }}</td>
            <td class="amount {{ $account['amount'] < 0 ? 'negative' : '' }}">
                @if($account['amount'] < 0)
                    -&#8369;{{ number_format(abs($account['amount']), 2) }}
                @else
                    &#8369;{{ number_format($account['amount'], 2) }}
                @endif
            </td>
        </tr>
        @endforeach

        <tr class="total-row">
            <td>Total for Other Expenses</td>
            <td class="amount {{ $total_other_expenses < 0 ? 'negative' : '' }}">
                @if($total_other_expenses < 0)
                    -&#8369;{{ number_format(abs($total_other_expenses), 2) }}
                @else
                    &#8369;{{ number_format($total_other_expenses, 2) }}
                @endif
            </td>
        </tr>

        <tr class="spacer"><td colspan="2"></td></tr>
        @endif

        {{-- ── NET EARNINGS ── --}}
        <tr class="net-income">
            <td>Net earnings</td>
            <td class="amount">&#8369;{{ number_format($net_income, 2) }}</td>
        </tr>

    </table>

</div>
@endsection
