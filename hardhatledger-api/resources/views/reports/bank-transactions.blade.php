@extends('layouts.pdf')

@section('title', 'Business Bank Transactions — HardhatLedger')
@section('doc-title', 'Bank Transactions Summary')
@section('doc-meta')Generated: {{ $generatedAt->format('F d, Y  h:i A') }}@endsection

@section('extra-css')
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

    /* ── Data Table ── */
    table.dt { width: 100%; border-collapse: collapse; font-size: 7pt; table-layout: fixed; }

    table.dt thead tr { background: #2d3748; }
    table.dt thead th {
        padding: 6px 5px;
        color: #fff;
        font-size: 6.5pt;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0;
        text-align: left;
        white-space: normal;
        vertical-align: bottom;
        line-height: 1.2;
    }
    table.dt thead th.r { text-align: right; }
    table.dt thead th.c { text-align: center; }

    table.dt tbody tr   { border-bottom: 1px solid #e8ecf0; }
    table.dt tbody tr.even { background: #f7fafc; }
    table.dt tbody tr.deposit-row td { color: #22543d; }
    table.dt tbody tr.payment-row td { color: #742a2a; }

    table.dt tbody td { padding: 5px 6px; vertical-align: top; word-break: break-word; overflow-wrap: break-word; }
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

    /* ── Type Badges ── */
    .badge {
        display: inline;
        padding: 1px 5px;
        font-size: 6.5pt;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }
    .b-deposit  { background: #c6f6d5; color: #22543d; }
    .b-expense  { background: #fed7d7; color: #742a2a; }
    .b-po       { background: #feebc8; color: #744210; }

    .empty-msg { text-align: center; color: #a0aec0; padding: 30px; font-size: 9pt; }
@endsection

@section('content')

{{-- ── Report Heading ── --}}
<div class="report-heading">
    <table>
        <tr>
            <td><div class="rh-title">Summary of Business Bank Transactions</div></td>
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

{{-- ── Stats Bar ── --}}
<div class="stats-bar">
    <table>
        <tr>
            <td class="stats-cell">
                <div class="stats-label">Total Deposits</div>
                <div class="stats-value">&#8369;{{ number_format($totals['total_deposits'], 2) }}</div>
            </td>
            <td class="stats-cell">
                <div class="stats-label">Total Payments</div>
                <div class="stats-value">&#8369;{{ number_format($totals['total_payments'], 2) }}</div>
            </td>
            <td class="stats-cell">
                <div class="stats-label">Total Tax</div>
                <div class="stats-value">&#8369;{{ number_format($totals['total_tax'], 2) }}</div>
            </td>
            <td class="stats-cell">
                <div class="stats-label">Net Balance</div>
                <div class="stats-value">&#8369;{{ number_format($totals['net_balance'], 2) }}</div>
            </td>
        </tr>
    </table>
</div>

{{-- ── Data Table ── --}}
@if($transactions->isEmpty())
    <div class="empty-msg">No business bank transactions found for the selected period.</div>
@else
<table class="dt">
    <colgroup>
        <col style="width:12px">   {{-- # --}}
        <col style="width:60px">   {{-- Date --}}
        <col style="width:82px">  {{-- Ref No --}}
        <col style="width:56px">   {{-- Type --}}
        <col style="width:72px">   {{-- Payee/Account --}}
        <col>                      {{-- Bank/Check Details (flex) --}}
        <col>                      {{-- Additional Notes (flex) --}}
        <col style="width:70px">   {{-- Payment --}}
        <col style="width:70px">   {{-- Deposit --}}
        <col style="width:48px">   {{-- Tax --}}
        <col style="width:80px">   {{-- Balance --}}
    </colgroup>
    <thead>
        <tr>
            <th>#</th>
            <th>Date</th>
            <th>Ref No.</th>
            <th class="c">Type</th>
            <th>Payee / Account</th>
            <th>Bank / Check Details</th>
            <th>Additional Notes</th>
            <th class="r">Payment</th>
            <th class="r">Deposit</th>
            <th class="r">Tax</th>
            <th class="r">Balance</th>
        </tr>
    </thead>
    <tbody>
        @foreach($transactions as $i => $txn)
        @php
            $isDeposit = ($txn['deposit_amount'] ?? 0) > 0;
            $rowClass  = $isDeposit ? 'deposit-row' : 'payment-row';
            if ($i % 2 === 1) $rowClass .= ' even';

            $typeBadge = match($txn['type'] ?? '') {
                'Deposit'        => 'b-deposit',
                'Expense'        => 'b-expense',
                'Purchase Order' => 'b-po',
                default          => '',
            };
        @endphp
        <tr class="{{ $rowClass }}">
            <td style="color:#a0aec0; font-size:7pt;">{{ $i + 1 }}</td>
            <td>{{ \Carbon\Carbon::parse($txn['date'])->format('M d, Y') }}</td>
            <td class="mono">{{ $txn['ref_no'] }}</td>
            <td class="c"><span class="badge {{ $typeBadge }}">{{ $txn['type'] }}</span></td>
            <td>{{ $txn['payee_account'] }}</td>
            <td style="font-size:7pt;">{{ $txn['memo'] ?? '' }}</td>
            <td style="font-size:7pt; color:#4a5568;">{{ $txn['additional_notes'] ?? '' }}</td>
            <td class="r">{{ ($txn['payment_amount'] ?? 0) > 0 ? '₱' . number_format($txn['payment_amount'], 2) : '' }}</td>
            <td class="r">{{ ($txn['deposit_amount'] ?? 0) > 0 ? '₱' . number_format($txn['deposit_amount'], 2) : '' }}</td>
            <td class="r">{{ ($txn['tax'] ?? 0) > 0 ? '₱' . number_format($txn['tax'], 2) : '' }}</td>
            <td class="r" style="font-weight:bold;">&#8369;{{ number_format($txn['balance'], 2) }}</td>
        </tr>
        @endforeach
    </tbody>
    <tfoot>
        <tr>
            <td colspan="7" style="text-align:right;">TOTALS</td>
            <td class="r">&#8369;{{ number_format($totals['total_payments'], 2) }}</td>
            <td class="r">&#8369;{{ number_format($totals['total_deposits'], 2) }}</td>
            <td class="r">&#8369;{{ number_format($totals['total_tax'], 2) }}</td>
            <td class="r">&#8369;{{ number_format($totals['net_balance'], 2) }}</td>
        </tr>
    </tfoot>
</table>
@endif

@endsection
