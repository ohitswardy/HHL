@extends('layouts.pdf')

@section('title', 'Suppliers — TRI-MILLENNIUM HARDWARE TRADING')
@section('doc-title', 'Supplier List')
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
        background: #1B3A5C; border-right: 1px solid rgba(255,255,255,0.15); width: 33.33%;
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
    table.dt thead th.c { text-align: center; }
    table.dt tbody tr { border-bottom: 1px solid #e8ecf0; }
    table.dt tbody tr.even { background: #f7fafc; }
    table.dt tbody td { padding: 5px 7px; vertical-align: top; }
    table.dt tbody td.c { text-align: center; }

    .vat-yes { display: inline; background: #c6f6d5; color: #22543d; font-size: 6.5pt; font-weight: bold; padding: 1px 5px; }
    .vat-no  { display: inline; background: #e2e8f0; color: #718096; font-size: 6.5pt; padding: 1px 5px; }

    .filter-row { font-size: 7.5pt; color: #718096; margin-bottom: 10px; }
    .empty-msg  { text-align: center; color: #a0aec0; padding: 30px; font-size: 9pt; }
@endsection

@section('content')

<div class="report-heading">
    <table>
        <tr>
            <td><div class="rh-title">Supplier List</div></td>
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

<div class="stats-bar">
    <table>
        <tr>
            <td class="stats-cell">
                <div class="stats-label">Total Suppliers</div>
                <div class="stats-value">{{ $suppliers->count() }}</div>
            </td>
            <td class="stats-cell">
                <div class="stats-label">VAT-Registered</div>
                <div class="stats-value">{{ $suppliers->where('is_vatable', true)->count() }}</div>
            </td>
            <td class="stats-cell">
                <div class="stats-label">Non-VAT</div>
                <div class="stats-value">{{ $suppliers->where('is_vatable', false)->count() }}</div>
            </td>
        </tr>
    </table>
</div>

@if($suppliers->isEmpty())
    <div class="empty-msg">No suppliers found.</div>
@else
<table class="dt">
    <thead>
        <tr>
            @foreach($activeCols as $key => $col)
                <th @if($key === 'is_vatable') class="c" @endif>{{ $col['header'] }}</th>
            @endforeach
        </tr>
    </thead>
    <tbody>
        @foreach($suppliers as $i => $supplier)
        <tr class="{{ $i % 2 === 1 ? 'even' : '' }}">
            @foreach($activeCols as $key => $col)
                @if($key === 'is_vatable')
                    <td class="c">
                        @if($supplier->is_vatable)
                            <span class="vat-yes">VAT</span>
                        @else
                            <span class="vat-no">Non-VAT</span>
                        @endif
                    </td>
                @else
                    <td>{{ ($col['value'])($supplier) }}</td>
                @endif
            @endforeach
        </tr>
        @endforeach
    </tbody>
</table>
@endif

@endsection
