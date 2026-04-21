@extends('layouts.pdf')

@section('title', 'Inventory Movements — TRI-MILLENNIUM HARDWARE TRADING')

@section('doc-title', 'Inventory Movements')

@section('doc-meta')
{{ $from ? date('M d, Y', strtotime($from)) : 'All time' }}@if($to) — {{ date('M d, Y', strtotime($to)) }}@endif
@if($type) &middot; {{ strtoupper($type) }}@endif
@endsection

@php
  $cols = $columns ?? ['date','product','sku','type','quantity','unit_cost','reference_type','notes','user'];
  $has = fn(string $c) => in_array($c, $cols);
@endphp

@section('extra-styles')
<style>
  body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 9px; color: #1a1a1a; }

  .summary-bar {
    display: flex; gap: 20px; margin-bottom: 12px;
    background: #f4f6f9; border: 1px solid #e2e8f0; padding: 8px 12px;
  }
  .summary-bar .stat { font-size: 8px; color: #475569; }
  .summary-bar .stat strong { display: block; font-size: 13px; font-weight: bold; color: #1B3A5C; }
  .summary-bar .stat.in   strong { color: #16a34a; }
  .summary-bar .stat.out  strong { color: #dc2626; }
  .summary-bar .stat.adj  strong { color: #2563eb; }

  table { width: 100%; border-collapse: collapse; }
  thead th {
    background: #1B3A5C; color: #fff;
    padding: 6px 8px; font-size: 8px; font-weight: bold;
    text-transform: uppercase; letter-spacing: 0.4px;
    border-bottom: 2px solid #F5A623;
  }
  thead th.right  { text-align: right; }
  thead th.center { text-align: center; }

  tbody tr:nth-child(even) { background: #f4f6f9; }
  tbody tr:nth-child(odd)  { background: #ffffff; }
  tbody td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
  tbody td.center { text-align: center; }
  tbody td.right  { text-align: right; }
  tbody td.mono   { font-family: Courier New, monospace; font-size: 8px; color: #555; }
  tbody td.small  { font-size: 8px; color: #64748b; }

  .badge { display:inline-block; padding:2px 6px; border-radius:10px; font-size:7.5px; font-weight:bold; }
  .badge-in  { background:#d1fae5; color:#065f46; }
  .badge-out { background:#fee2e2; color:#991b1b; }
  .badge-adj { background:#dbeafe; color:#1e40af; }

  .qty-in  { color: #16a34a; font-weight: bold; }
  .qty-out { color: #dc2626; font-weight: bold; }
  .qty-adj { color: #2563eb; font-weight: bold; }
</style>
@endsection

@section('content')

{{-- Summary stats --}}
@php
  $totalIn  = $movements->where('type', 'in')->sum('quantity');
  $totalOut = $movements->where('type', 'out')->sum('quantity');
  $totalAdj = $movements->where('type', 'adjustment')->count();
@endphp
<div class="summary-bar">
  <div class="stat in">
    <strong>{{ number_format($totalIn) }}</strong>
    Units In
  </div>
  <div class="stat out">
    <strong>{{ number_format($totalOut) }}</strong>
    Units Out
  </div>
  <div class="stat adj">
    <strong>{{ $totalAdj }}</strong>
    Adjustments
  </div>
  <div class="stat">
    <strong>{{ $movements->count() }}</strong>
    Total Entries
  </div>
</div>

<table>
  <thead>
    <tr>
      @if($has('date'))           <th>Date &amp; Time</th>@endif
      @if($has('product'))        <th>Product</th>@endif
      @if($has('sku'))            <th>SKU</th>@endif
      @if($has('type'))           <th class="center">Type</th>@endif
      @if($has('quantity'))       <th class="center">Qty</th>@endif
      @if($has('unit_cost'))      <th class="right">Unit Cost</th>@endif
      @if($has('reference_type')) <th>Reference</th>@endif
      @if($has('reference_id'))   <th>Ref ID</th>@endif
      @if($has('notes'))          <th>Notes</th>@endif
      @if($has('user'))           <th>User</th>@endif
    </tr>
  </thead>
  <tbody>
    @forelse($movements as $m)
    <tr>
      @if($has('date'))    <td class="small">{{ $m->created_at->format('M d, Y g:i A') }}</td>@endif
      @if($has('product')) <td>{{ $m->product?->name ?? '—' }}</td>@endif
      @if($has('sku'))     <td class="mono">{{ $m->product?->sku ?? '—' }}</td>@endif
      @if($has('type'))
        <td class="center">
          @if($m->type === 'in')
            <span class="badge badge-in">IN</span>
          @elseif($m->type === 'out')
            <span class="badge badge-out">OUT</span>
          @else
            <span class="badge badge-adj">ADJ</span>
          @endif
        </td>
      @endif
      @if($has('quantity'))
        <td class="center {{ $m->type === 'in' ? 'qty-in' : ($m->type === 'out' ? 'qty-out' : 'qty-adj') }}">
          {{ $m->type === 'in' ? '+' : ($m->type === 'out' ? '-' : '=') }}{{ $m->quantity }}
        </td>
      @endif
      @if($has('unit_cost'))      <td class="right">{{ $m->unit_cost ? number_format($m->unit_cost, 2) : '—' }}</td>@endif
      @if($has('reference_type'))
        @php
          $refMap = ['sale' => 'Sale', 'sale_void' => 'Sale Void', 'purchase_receipt' => 'Purchase', 'manual_adjustment' => 'Manual'];
          $ref = $refMap[$m->reference_type ?? ''] ?? $m->reference_type ?? '—';
        @endphp
        <td class="small">{{ $ref }}</td>
      @endif
      @if($has('reference_id'))   <td class="small mono">{{ $m->reference_id ?? '—' }}</td>@endif
      @if($has('notes'))          <td class="small">{{ $m->notes ?? '—' }}</td>@endif
      @if($has('user'))           <td class="small">{{ $m->user?->name ?? '—' }}</td>@endif
    </tr>
    @empty
    <tr>
      <td colspan="{{ count($cols) }}" style="text-align:center; padding:20px; color:#94a3b8;">No movements found for this period</td>
    </tr>
    @endforelse
  </tbody>
</table>

@endsection
