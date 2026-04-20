@extends('layouts.pdf')

@section('title', 'Statement of Account — HardhatLedger')

@section('doc-title', 'Statement of Account')

@section('doc-meta')
{{ $client->business_name }}
&nbsp;&bull;&nbsp;
{{ \Carbon\Carbon::parse($startDate)->format('M d, Y') }} &mdash; {{ \Carbon\Carbon::parse($endDate)->format('M d, Y') }}
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

        /* ── Company Header ── */
        .co-name    { font-size: 12.5px; font-weight: 900; color: #1B3A5C; letter-spacing: 0.02em; }
        .co-detail  { font-size: 9.5px; color: #555; line-height: 1.75; margin-top: 3px; }

        /* ── Statement Title ── */
        .stmt-title { font-size: 30px; font-weight: 400; color: #F5A623; margin: 18px 0 14px; }

        /* ── Meta row (TO + Statement No) ── */
        .to-label   { font-size: 10px; font-weight: 700; color: #1B3A5C; margin-bottom: 5px; }
        .to-name    { font-size: 11px; font-weight: 700; color: #1B3A5C; margin-bottom: 2px; }
        .to-detail  { font-size: 9.5px; color: #555; line-height: 1.6; }

        .sno-label  { font-size: 10px; font-weight: 700; color: #1B3A5C; width: 110px; }
        .sno-value  { font-size: 10px; color: #1B3A5C; }

        /* ── Transactions table ── */
        .tx-table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 4px; }
        .tx-table thead tr { background: #e8eef5; }
        .tx-table thead th {
            padding: 8px 12px;
            text-align: left;
            font-size: 9.5px;
            font-weight: 700;
            color: #1B3A5C;
            border-bottom: 1.5px solid #b0c4d8;
        }
        .tx-table thead th.right { text-align: right; }
        .tx-table tbody td {
            padding: 6.5px 12px;
            border-bottom: 1px solid #eeeeee;
            color: #333;
        }
        .tx-table tbody td.right { text-align: right; }
        .tx-table tbody tr.voided td { color: #bbb; }
        .tx-table tbody tr.voided .inv { text-decoration: line-through; }

        /* ── Totals ── */
        .totals-sep { border-top: 1.5px dashed #ccc; margin-top: 6px; }

        .doc-footer {
            margin-top: 20px;
            padding-top: 9px;
            border-top: 1px solid #b0c4d8;
            font-size: 9px;
            color: #8a9bb0;
            text-align: center;
        }
</style>
@endsection

@section('content')
@php
    $cols = $columns ?? ['date', 'transaction_number', 'total', 'paid'];
    $has  = fn(string $c) => in_array($c, $cols);
    $colCount = count($cols);
@endphp
<div class="page">

    {{-- ── Document identifier ── --}}
    <div class="stmt-title">Statement</div>
    <table style="width:100%; border-collapse:collapse; margin-bottom:18px;">
        <tr>
            <td style="width:55%; vertical-align:top;">
                <div class="to-label">TO</div>
                <div style="margin-top:5px;">
                    <div class="to-name">{{ $client->business_name }}</div>
                    @if($client->address ?? null)<div class="to-detail">{{ $client->address }}</div>@endif
                    @if($client->contact_person ?? null)<div class="to-detail">{{ $client->contact_person }}</div>@endif
                    @if($client->phone ?? null)<div class="to-detail">{{ $client->phone }}</div>@endif
                    @if($client->email ?? null)<div class="to-detail">{{ $client->email }}</div>@endif
                </div>
            </td>
            <td style="width:45%; vertical-align:top;">
                <table style="width:100%; border-collapse:collapse;">
                    <tr>
                        <td class="sno-label">STATEMENT NO.</td>
                        <td class="sno-value">
                            {{ str_pad($client->id, 4, '0', STR_PAD_LEFT) }}{{ \Carbon\Carbon::parse($endDate)->format('md') }}
                        </td>
                    </tr>
                    <tr>
                        <td class="sno-label" style="padding-top:3px;">DATE</td>
                        <td class="sno-value" style="padding-top:3px;">
                            {{ \Carbon\Carbon::parse($endDate)->format('m/d/Y') }}
                        </td>
                    </tr>
                    @if($startDate !== $endDate)
                    <tr>
                        <td class="sno-label" style="padding-top:3px;">PERIOD</td>
                        <td class="sno-value" style="padding-top:3px;">
                            {{ \Carbon\Carbon::parse($startDate)->format('m/d/Y') }}
                            &ndash;
                            {{ \Carbon\Carbon::parse($endDate)->format('m/d/Y') }}
                        </td>
                    </tr>
                    @endif
                    @if($client->tier)
                    <tr>
                        <td class="sno-label" style="padding-top:3px;">TIER</td>
                        <td class="sno-value" style="padding-top:3px;">{{ $client->tier->name }}</td>
                    </tr>
                    @endif
                </table>
            </td>
        </tr>
    </table>

    {{-- ── Transactions Table ── --}}
    <table class="tx-table">
        <thead>
            <tr>
                @if($has('date'))<th style="width:12%">DATE</th>@endif
                @if($has('time'))<th style="width:9%">TIME</th>@endif
                @if($has('transaction_number'))<th>TRANSACTION #</th>@endif
                @if($has('fulfillment_type'))<th style="width:10%">TYPE</th>@endif
                @if($has('status'))<th style="width:10%">STATUS</th>@endif
                @if($has('payment_method'))<th style="width:13%">PAYMENT</th>@endif
                @if($has('cashier'))<th style="width:11%">STAFF</th>@endif
                @if($has('subtotal'))<th class="right" style="width:10%">SUBTOTAL</th>@endif
                @if($has('discount'))<th class="right" style="width:9%">DISCOUNT</th>@endif
                @if($has('tax'))<th class="right" style="width:8%">VAT</th>@endif
                @if($has('total'))<th class="right" style="width:11%">AMOUNT</th>@endif
                @if($has('paid'))<th class="right" style="width:11%">RECEIVED</th>@endif
                @if($has('balance_due'))<th class="right" style="width:10%">BALANCE</th>@endif
            </tr>
        </thead>
        <tbody>
            @forelse($transactions as $tx)
            <tr class="{{ $tx->status === 'voided' ? 'voided' : '' }}">
                @if($has('date'))<td>{{ $tx->created_at->format('m/d/Y') }}</td>@endif
                @if($has('time'))<td>{{ $tx->created_at->format('H:i:s') }}</td>@endif
                @if($has('transaction_number'))
                <td>
                    <span class="inv">{{ $tx->transaction_number }}</span>
                    @if(!$has('tax') && $tx->tax_amount > 0)
                        <span style="font-size:8.5px; color:#1a6b9e; margin-left:4px;">
                            incl. VAT ₱{{ number_format($tx->tax_amount, 2) }}
                        </span>
                    @endif
                </td>
                @endif
                @if($has('fulfillment_type'))<td>{{ ucfirst($tx->fulfillment_type) }}</td>@endif
                @if($has('status'))<td>{{ ucfirst($tx->status) }}</td>@endif
                @if($has('payment_method'))
                <td>{{ $tx->payments->pluck('payment_method')->map(fn($m) => str_replace('_',' ',$m))->implode(', ') ?: '—' }}</td>
                @endif
                @if($has('cashier'))<td>{{ $tx->user?->name ?? '—' }}</td>@endif
                @if($has('subtotal'))<td class="right">{{ number_format($tx->subtotal, 2) }}</td>@endif
                @if($has('discount'))<td class="right">{{ number_format($tx->discount_amount, 2) }}</td>@endif
                @if($has('tax'))<td class="right">{{ number_format($tx->tax_amount, 2) }}</td>@endif
                @if($has('total'))<td class="right">{{ number_format($tx->total_amount, 2) }}</td>@endif
                @if($has('paid'))<td class="right">{{ number_format($tx->payments->where('status','confirmed')->sum('amount'), 2) }}</td>@endif
                @if($has('balance_due'))<td class="right">{{ number_format(max(0, $tx->total_amount - $tx->payments->where('status','confirmed')->sum('amount')), 2) }}</td>@endif
            </tr>
            @empty
            <tr>
                <td colspan="{{ $colCount }}" style="text-align:center; padding:22px; color:#aaa; font-style:italic;">
                    No transactions found for this period.
                </td>
            </tr>
            @endforelse
        </tbody>
    </table>

    {{-- ── Totals ── --}}
    @if($transactions->count() > 0)
    @php
        // Count columns before the first monetary total column
        $leftSpan = collect(['date','time','transaction_number','fulfillment_type','status','payment_method','cashier'])
            ->filter(fn($k) => $has($k))->count();
        $hasTotalCol   = $has('total');
        $hasPaidCol    = $has('paid');
        $hasBalanceCol = $has('balance_due');
        $subtotalCount = $has('subtotal') ? 1 : 0;
        $discountCount = $has('discount') ? 1 : 0;
        $taxCount      = $has('tax')      ? 1 : 0;
        $preMoneySpan  = $subtotalCount + $discountCount + $taxCount;
    @endphp
    <div class="totals-sep"></div>
    <table style="width:100%; border-collapse:collapse; margin-top:5px;">
        <tr>
            @if($leftSpan > 0)<td colspan="{{ $leftSpan }}"></td>@endif
            @if($preMoneySpan > 0)<td colspan="{{ $preMoneySpan }}"></td>@endif
            @if($hasTotalCol)
            <td style="text-align:right; padding:4px 12px 2px; font-size:9.5px; font-weight:700; color:#1B3A5C; text-transform:uppercase;">Total Amount</td>
            @endif
            @if($hasPaidCol)
            <td style="text-align:right; padding:4px 12px 2px; font-size:9.5px; font-weight:700; color:#1B3A5C; text-transform:uppercase;">Total Received</td>
            @endif
            @if($hasBalanceCol)
            <td style="text-align:right; padding:4px 12px 2px; font-size:9.5px; font-weight:700; color:#1B3A5C; text-transform:uppercase;">Balance</td>
            @endif
        </tr>
        <tr>
            @if($leftSpan > 0)<td colspan="{{ $leftSpan }}"></td>@endif
            @if($preMoneySpan > 0)<td colspan="{{ $preMoneySpan }}"></td>@endif
            @if($hasTotalCol)
            <td style="text-align:right; padding:3px 12px 6px; font-size:12px; font-weight:700; color:#1B3A5C;">
                PHP{{ number_format($transactions->where('status','!=','voided')->sum('total_amount'), 2) }}
            </td>
            @endif
            @if($hasPaidCol)
            <td style="text-align:right; padding:3px 12px 6px; font-size:12px; font-weight:700; color:#1B3A5C;">
                PHP{{ number_format($transactions->flatMap->payments->where('status','confirmed')->sum('amount'), 2) }}
            </td>
            @endif
            @if($hasBalanceCol)
            <td style="text-align:right; padding:3px 12px 6px; font-size:12px; font-weight:700; color:#1B3A5C;">
                PHP{{ number_format(max(0, $transactions->where('status','!=','voided')->sum('total_amount') - $transactions->flatMap->payments->where('status','confirmed')->sum('amount')), 2) }}
            </td>
            @endif
        </tr>
    </table>
    @endif

    {{-- ── Footer note ── --}}
    <div class="doc-footer">
        Any discrepancies should be reported within 7 days of receipt.
    </div>

</div>
@endsection
