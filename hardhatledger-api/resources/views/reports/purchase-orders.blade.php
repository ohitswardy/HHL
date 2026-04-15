@extends('layouts.pdf')

@section('title', 'Purchase Orders — HardhatLedger')
@section('doc-title', 'Purchase Orders')
@section('doc-meta')Generated: {{ $generatedAt->format('F d, Y  h:i A') }}@endsection

@section('extra-css')
    .report-heading {
        border-bottom: 2px solid #1B3A5C;
        padding-bottom: 7px;
        margin-bottom: 10px;
    }
    .report-heading table { width: 100%; border-collapse: collapse; }
    .report-heading td { vertical-align: bottom; }
    .rh-title { font-size: 15pt; font-weight: bold; color: #1B3A5C; }
    .rh-period { font-size: 8pt; color: #4a5568; text-align: right; }

    .stats-bar { margin-bottom: 12px; }
    .stats-bar table { width: 100%; border-collapse: collapse; }
    .stats-cell {
        padding: 9px 14px; text-align: center;
        background: #1B3A5C;
        border-right: 1px solid rgba(255,255,255,0.15);
        width: 20%;
    }
    .stats-cell:last-child { border-right: none; }
    .stats-label { font-size: 6.5pt; color: rgba(255,255,255,0.65); text-transform: uppercase; letter-spacing: 0.4px; }
    .stats-value { font-size: 11pt; font-weight: bold; color: #F5A623; margin-top: 3px; }

    .filter-row { font-size: 7.5pt; color: #718096; margin-bottom: 10px; }
    .filter-tag {
        display: inline;
        background: #edf2f7; border: 1px solid #e2e8f0;
        color: #4a5568; font-size: 7pt; padding: 1px 5px; margin-left: 4px;
    }

    table.dt { width: 100%; border-collapse: collapse; font-size: 7.5pt; table-layout: fixed; }
    table.dt thead tr { background: #2d3748; }
    table.dt thead th { padding: 6px 7px; color: #fff; font-size: 7pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; text-align: left; }
    table.dt thead th.r { text-align: right; }
    table.dt thead th.c { text-align: center; }
    table.dt tbody tr   { border-bottom: 1px solid #e8ecf0; }
    table.dt tbody tr.even { background: #f7fafc; }
    table.dt tbody td { padding: 5px 7px; vertical-align: top; }
    table.dt tbody td.r { text-align: right; }
    table.dt tbody td.c { text-align: center; }
    table.dt tbody td.mono { font-family: 'Courier New', monospace; font-size: 7pt; }
    table.dt tfoot tr { background: #1B3A5C; }
    table.dt tfoot td { padding: 7px 7px; color: #fff; font-weight: bold; font-size: 8pt; border-top: 2px solid #F5A623; }
    table.dt tfoot td.r { text-align: right; color: #F5A623; }

    .badge { display: inline; padding: 1px 5px; font-size: 6.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; }
    .b-draft     { background: #e2e8f0; color: #4a5568; }
    .b-sent      { background: #bee3f8; color: #2c5282; }
    .b-partial   { background: #feebc8; color: #744210; }
    .b-received  { background: #c6f6d5; color: #22543d; }
    .b-cancelled { background: #fed7d7; color: #742a2a; }
    .empty-msg { text-align: center; color: #a0aec0; padding: 30px; font-size: 9pt; }
@endsection

@section('content')

@php
    $statusCounts = $pos->groupBy('status')->map->count();
    $totalAmount  = $pos->sum('total_amount');
@endphp

{{-- Heading --}}
<div class="report-heading">
    <table>
        <tr>
            <td><div class="rh-title">Purchase Orders</div></td>
            <td>
                <div class="rh-period">
                    @if($filters['from'] || $filters['to'])
                        @if($filters['from']) From: <strong>{{ \Carbon\Carbon::parse($filters['from'])->format('M d, Y') }}</strong> @endif
                        @if($filters['to']) &mdash; To: <strong>{{ \Carbon\Carbon::parse($filters['to'])->format('M d, Y') }}</strong> @endif
                    @else
                        <strong>All Time</strong>
                    @endif
                </div>
            </td>
        </tr>
    </table>
</div>

{{-- Active filters --}}
@if($filters['status'] || $filters['search'])
<div class="filter-row">
    Active filters:
    @if($filters['status'])  <span class="filter-tag">Status: {{ ucfirst($filters['status']) }}</span> @endif
    @if($filters['search'])  <span class="filter-tag">Search: "{{ $filters['search'] }}"</span> @endif
</div>
@endif

{{-- Stats --}}
<div class="stats-bar">
    <table>
        <tr>
            <td class="stats-cell">
                <div class="stats-label">Total POs</div>
                <div class="stats-value">{{ $pos->count() }}</div>
            </td>
            <td class="stats-cell">
                <div class="stats-label">Draft</div>
                <div class="stats-value">{{ $statusCounts['draft'] ?? 0 }}</div>
            </td>
            <td class="stats-cell">
                <div class="stats-label">Received</div>
                <div class="stats-value">{{ $statusCounts['received'] ?? 0 }}</div>
            </td>
            <td class="stats-cell">
                <div class="stats-label">Partial</div>
                <div class="stats-value">{{ $statusCounts['partial'] ?? 0 }}</div>
            </td>
            <td class="stats-cell">
                <div class="stats-label">Total Amount</div>
                <div class="stats-value">&#8369;{{ number_format($totalAmount, 2) }}</div>
            </td>
        </tr>
    </table>
</div>

{{-- Table --}}
@if($pos->isEmpty())
    <div class="empty-msg">No purchase orders found for the selected filters.</div>
@else
<table class="dt">
    <colgroup>
        <col style="width:100px"> {{-- PO # --}}
        <col> {{-- Supplier --}}
        <col style="width:65px"> {{-- Status --}}
        <col style="width:35px"> {{-- Items --}}
        <col style="width:90px"> {{-- Total --}}
        <col style="width:80px"> {{-- Expected --}}
        <col style="width:80px"> {{-- Created --}}
        <col> {{-- Notes --}}
    </colgroup>
    <thead>
        <tr>
            <th>PO #</th>
            <th>Supplier</th>
            <th class="c">Status</th>
            <th class="c">Items</th>
            <th class="r">Total (₱)</th>
            <th>Expected</th>
            <th>Created</th>
            <th>Notes</th>
        </tr>
    </thead>
    <tbody>
        @foreach($pos as $i => $po)
        <tr class="{{ $i % 2 === 1 ? 'even' : '' }}">
            <td class="mono">{{ $po->po_number }}</td>
            <td>{{ $po->supplier?->name ?? '—' }}</td>
            <td class="c">
                @php $sc = ['draft'=>'b-draft','sent'=>'b-sent','partial'=>'b-partial','received'=>'b-received','cancelled'=>'b-cancelled'][$po->status] ?? 'b-draft'; @endphp
                <span class="badge {{ $sc }}">{{ $po->status }}</span>
            </td>
            <td class="c">{{ $po->items?->count() ?? 0 }}</td>
            <td class="r">{{ number_format($po->total_amount, 2) }}</td>
            <td>{{ $po->expected_date ? \Carbon\Carbon::parse($po->expected_date)->format('M d, Y') : '—' }}</td>
            <td>{{ \Carbon\Carbon::parse($po->created_at)->format('M d, Y') }}</td>
            <td style="font-size:6.5pt;color:#4a5568">{{ $po->notes ?? '' }}</td>
        </tr>
        @endforeach
    </tbody>
    <tfoot>
        <tr>
            <td colspan="4">Total: {{ $pos->count() }} purchase orders</td>
            <td class="r">{{ number_format($totalAmount, 2) }}</td>
            <td colspan="3"></td>
        </tr>
    </tfoot>
</table>
@endif

@endsection
