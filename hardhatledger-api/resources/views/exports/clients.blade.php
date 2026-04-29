@extends('layouts.pdf')

@section('title', 'Clients — TRI-MILLENNIUM HARDWARE TRADING')
@section('doc-title', 'Client List')
@section('doc-meta')Generated: {{ $generatedAt->format('F d, Y  h:i A') }}@endsection

@section('extra-css')
    .report-heading { border-bottom: 2px solid #1B3A5C; padding-bottom: 7px; margin-bottom: 10px; }
    .report-heading table { width: 100%; border-collapse: collapse; }
    .report-heading td { vertical-align: bottom; }
    .rh-title  { font-size: 15pt; font-weight: bold; color: #1B3A5C; }
    .rh-meta   { font-size: 8pt; color: #4a5568; text-align: right; }

    .stats-bar { margin-bottom: 12px; }
    .stats-bar table { width: 100%; border-collapse: collapse; }
    .stats-cell {
        padding: 9px 14px; text-align: center;
        background: #1B3A5C; border-right: 1px solid rgba(255,255,255,0.15); width: 25%;
    }
    .stats-cell:last-child { border-right: none; }
    .stats-label { font-size: 6.5pt; color: rgba(255,255,255,0.65); text-transform: uppercase; letter-spacing: 0.4px; }
    .stats-value { font-size: 11pt; font-weight: bold; color: #F5A623; margin-top: 3px; }

    table.dt { width: 100%; border-collapse: collapse; font-size: 7.5pt; table-layout: fixed; }
    table.dt thead tr { background: #2d3748; }
    table.dt thead th {
        padding: 6px 7px; color: #fff; font-size: 7pt; font-weight: bold;
        text-transform: uppercase; letter-spacing: 0.3px; text-align: left; white-space: nowrap;
    }
    table.dt thead th.r { text-align: right; }
    table.dt tbody tr { border-bottom: 1px solid #e8ecf0; }
    table.dt tbody tr.even { background: #f7fafc; }
    table.dt tbody td { padding: 5px 7px; vertical-align: top; }
    table.dt tbody td.r { text-align: right; }

    table.dt tfoot tr { background: #1B3A5C; }
    table.dt tfoot td {
        padding: 7px 7px; color: #fff; font-weight: bold; font-size: 8pt;
        border-top: 2px solid #F5A623;
    }
    table.dt tfoot td.r { text-align: right; color: #F5A623; }

    .tier-badge {
        display: inline; background: #ebf4ff; color: #1B3A5C;
        font-size: 6.5pt; font-weight: bold; padding: 1px 5px;
    }

    .filter-row { font-size: 7.5pt; color: #718096; margin-bottom: 10px; }
    .empty-msg  { text-align: center; color: #a0aec0; padding: 30px; font-size: 9pt; }
@endsection

@section('content')

<div class="report-heading">
    <table>
        <tr>
            <td><div class="rh-title">Client List</div></td>
            <td>
                <div class="rh-meta">
                    Generated: {{ $generatedAt->format('M d, Y  h:i A') }}
                </div>
            </td>
        </tr>
    </table>
</div>

@if($search)
<div class="filter-row">
    Filtered by search: <strong>{{ $search }}</strong>
</div>
@endif

@php
    $totalCredit  = $clients->sum('credit_limit');
    $totalBalance = $clients->sum(fn($c) => $c->outstanding_balance ?? 0);
@endphp

<div class="stats-bar">
    <table>
        <tr>
            <td class="stats-cell">
                <div class="stats-label">Total Clients</div>
                <div class="stats-value">{{ $clients->count() }}</div>
            </td>
            <td class="stats-cell">
                <div class="stats-label">Total Credit Limit</div>
                <div class="stats-value">₱{{ number_format($totalCredit, 2) }}</div>
            </td>
            <td class="stats-cell">
                <div class="stats-label">Total Balance Due</div>
                <div class="stats-value">₱{{ number_format($totalBalance, 2) }}</div>
            </td>
            <td class="stats-cell">
                <div class="stats-label">With Balance</div>
                <div class="stats-value">{{ $clients->filter(fn($c) => ($c->outstanding_balance ?? 0) > 0)->count() }}</div>
            </td>
        </tr>
    </table>
</div>

@if($clients->isEmpty())
    <div class="empty-msg">No clients found.</div>
@else
<table class="dt">
    <thead>
        <tr>
            @foreach($activeCols as $key => $col)
                <th @if(in_array($key, ['credit_limit','outstanding_balance'])) class="r" @endif>
                    {{ $col['header'] }}
                </th>
            @endforeach
        </tr>
    </thead>
    <tbody>
        @foreach($clients as $i => $client)
        <tr class="{{ $i % 2 === 1 ? 'even' : '' }}">
            @foreach($activeCols as $key => $col)
                @if($key === 'tier')
                    <td><span class="tier-badge">{{ $client->tier?->name ?? '—' }}</span></td>
                @elseif(in_array($key, ['credit_limit','outstanding_balance']))
                    <td class="r">{{ ($col['value'])($client) }}</td>
                @else
                    <td>{{ ($col['value'])($client) }}</td>
                @endif
            @endforeach
        </tr>
        @endforeach
    </tbody>
    @if(isset($activeCols['credit_limit']) || isset($activeCols['outstanding_balance']))
    <tfoot>
        <tr>
            @foreach($activeCols as $key => $col)
                @if($key === 'business_name')
                    <td>TOTALS</td>
                @elseif($key === 'credit_limit')
                    <td class="r">{{ number_format($totalCredit, 2) }}</td>
                @elseif($key === 'outstanding_balance')
                    <td class="r">{{ number_format($totalBalance, 2) }}</td>
                @else
                    <td></td>
                @endif
            @endforeach
        </tr>
    </tfoot>
    @endif
</table>
@endif

@endsection
