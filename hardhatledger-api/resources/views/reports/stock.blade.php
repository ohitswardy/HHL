@extends('layouts.pdf')

@section('title', 'Stock Report — HardhatLedger')

@section('doc-title', 'Stock Report')

@section('doc-meta')
Generated: {{ now()->format('F d, Y  h:i A') }}
@if($low_stock) &middot; Low Stock Only @endif
@if($search) &middot; Search: "{{ $search }}" @endif
@endsection

@section('extra-styles')
<style>
  body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 9px; color: #1a1a1a; }

  .summary-bar {
    display: flex; gap: 20px; margin-bottom: 12px;
    background: #f4f6f9; border: 1px solid #e2e8f0; padding: 8px 12px;
  }
  .summary-bar .stat { font-size: 8px; color: #475569; }
  .summary-bar .stat strong { display: block; font-size: 13px; font-weight: bold; color: #1B3A5C; }
  .summary-bar .stat.warn strong { color: #dc2626; }
  .summary-bar .stat.ok   strong { color: #16a34a; }

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
  .badge-ok   { background:#d1fae5; color:#065f46; }
  .badge-low  { background:#fee2e2; color:#991b1b; }
</style>
@endsection

@section('content')

@php
  $lowCount = $products->filter(fn($p) => ($p->stock?->quantity_on_hand ?? 0) <= $p->reorder_level)->count();
  $okCount  = $products->count() - $lowCount;
@endphp

<div class="summary-bar">
  <div class="stat">
    <strong>{{ $products->count() }}</strong>
    Total Products
  </div>
  <div class="stat ok">
    <strong>{{ $okCount }}</strong>
    OK
  </div>
  <div class="stat warn">
    <strong>{{ $lowCount }}</strong>
    Low Stock
  </div>
  <div class="stat">
    <strong>{{ number_format($products->sum(fn($p) => $p->stock?->quantity_on_hand ?? 0)) }}</strong>
    Total On Hand
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Product</th>
      <th>SKU</th>
      <th>Category</th>
      <th>Unit</th>
      <th class="right">On Hand</th>
      <th class="right">Reserved</th>
      <th class="right">Available</th>
      <th class="right">Reorder Level</th>
      <th class="center">Status</th>
    </tr>
  </thead>
  <tbody>
    @forelse($products as $p)
    @php
      $onHand    = (int) ($p->stock?->quantity_on_hand ?? 0);
      $reserved  = (int) ($p->stock?->quantity_reserved ?? 0);
      $available = $onHand - $reserved;
      $isLow     = $onHand <= $p->reorder_level;
    @endphp
    <tr>
      <td>{{ $p->name }}</td>
      <td class="mono">{{ $p->sku }}</td>
      <td class="small">{{ $p->category?->name ?? '—' }}</td>
      <td class="center small">{{ $p->unit }}</td>
      <td class="right">{{ number_format($onHand) }}</td>
      <td class="right small">{{ number_format($reserved) }}</td>
      <td class="right {{ $isLow ? 'text-red' : '' }}">{{ number_format($available) }}</td>
      <td class="right small">{{ number_format($p->reorder_level) }}</td>
      <td class="center">
        <span class="badge {{ $isLow ? 'badge-low' : 'badge-ok' }}">{{ $isLow ? 'LOW' : 'OK' }}</span>
      </td>
    </tr>
    @empty
    <tr><td colspan="9" style="text-align:center; padding:20px; color:#999;">No products found</td></tr>
    @endforelse
  </tbody>
</table>

@endsection
