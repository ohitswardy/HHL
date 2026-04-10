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
                <th style="width:14%">DATE</th>
                <th style="width:48%">DESCRIPTION</th>
                <th class="right" style="width:19%">AMOUNT</th>
                <th class="right" style="width:19%">RECEIVED</th>
            </tr>
        </thead>
        <tbody>
            @forelse($transactions as $tx)
            <tr class="{{ $tx->status === 'voided' ? 'voided' : '' }}">
                <td>{{ $tx->created_at->format('m/d/Y') }}</td>
                <td><span class="inv">Invoice No.{{ $tx->transaction_number }}</span></td>
                <td class="right">{{ number_format($tx->total_amount, 2) }}</td>
                <td class="right">{{ number_format($tx->payments->where('status','confirmed')->sum('amount'), 2) }}</td>
            </tr>
            @empty
            <tr>
                <td colspan="4" style="text-align:center; padding:22px; color:#aaa; font-style:italic;">
                    No transactions found for this period.
                </td>
            </tr>
            @endforelse
        </tbody>
    </table>

    {{-- ── Totals ── --}}
    @if($transactions->count() > 0)
    <div class="totals-sep"></div>
    <table style="width:100%; border-collapse:collapse; margin-top:5px;">
        <tr>
            <td style="width:62%;"></td>
            <td style="width:19%; text-align:right; padding:4px 12px 2px; font-size:9.5px; font-weight:700; color:#1B3A5C; text-transform:uppercase;">Total Amount</td>
            <td style="width:19%; text-align:right; padding:4px 12px 2px; font-size:9.5px; font-weight:700; color:#1B3A5C; text-transform:uppercase;">Total Received</td>
        </tr>
        <tr>
            <td></td>
            <td style="text-align:right; padding:3px 12px 6px; font-size:12px; font-weight:700; color:#1B3A5C;">
                PHP{{ number_format($transactions->where('status','!=','voided')->sum('total_amount'), 2) }}
            </td>
            <td style="text-align:right; padding:3px 12px 6px; font-size:12px; font-weight:700; color:#1B3A5C;">
                PHP{{ number_format($transactions->flatMap->payments->where('status','confirmed')->sum('amount'), 2) }}
            </td>
        </tr>
    </table>
    @endif

    {{-- ── Footer note ── --}}
    <div class="doc-footer">
        Any discrepancies should be reported within 7 days of receipt.
    </div>

</div>
@endsection
