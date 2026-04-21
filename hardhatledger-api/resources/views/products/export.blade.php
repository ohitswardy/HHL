@extends('layouts.pdf')

@section('title', 'Product List — TRI-MILLENNIUM HARDWARE TRADING')

@section('doc-title', 'Product List')

@section('doc-meta')
{{ $date }} &nbsp;&middot;&nbsp; {{ $products->count() }} product(s)
@endsection

@php
  // If $columns is null, show all columns (default template)
  $cols = $columns ?? ['sku','name','category','unit','cost_price','selling_price','stock','reorder_level','status'];
  $has = fn(string $c) => in_array($c, $cols);
@endphp

@section('extra-styles')
<style>
  body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 9px; color: #1a1a1a; }

  .summary { margin-bottom: 10px; font-size: 8px; color: #475569; }
  .summary span { font-weight: bold; color: #1B3A5C; }

  table { width: 100%; border-collapse: collapse; }
  thead th {
    background: #1B3A5C; color: #fff;
    padding: 6px 8px; font-size: 8px; font-weight: bold;
    text-transform: uppercase; letter-spacing: 0.4px;
    border-bottom: 2px solid #F5A623;
  }
  thead th.right { text-align: right; }
  thead th.center { text-align: center; }

  tbody tr:nth-child(even) { background: #f4f6f9; }
  tbody tr:nth-child(odd)  { background: #ffffff; }
  tbody td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
  tbody td.right { text-align: right; }
  tbody td.center { text-align: center; }
  tbody td.mono { font-family: Courier New, monospace; font-size: 8px; color: #555; }

  .badge-active   { display:inline-block; background:#d1fae5; color:#065f46; padding:2px 6px; border-radius:10px; font-size:7.5px; font-weight:bold; }
  .badge-inactive { display:inline-block; background:#fee2e2; color:#991b1b; padding:2px 6px; border-radius:10px; font-size:7.5px; font-weight:bold; }

  .stock-low { color: #dc2626; font-weight: bold; }
  .stock-ok  { color: #16a34a; font-weight: bold; }
</style>
@endsection

@section('content')

<div class="summary">
  Active: <span>{{ $products->where('is_active', true)->count() }}</span>
  &nbsp;&nbsp;
  Inactive: <span>{{ $products->where('is_active', false)->count() }}</span>
  &nbsp;&nbsp;
  Low Stock: <span>{{ $products->filter(fn($p) => ($p->stock->quantity_on_hand ?? 0) <= $p->reorder_level && $p->reorder_level > 0)->count() }}</span>
</div>

<table>
  <thead>
    <tr>
      @if($has('sku'))          <th style="width:8%">SKU</th>@endif
      @if($has('name'))         <th style="width:26%">Product Name</th>@endif
      @if($has('category'))     <th style="width:14%">Category</th>@endif
      @if($has('unit'))         <th style="width:5%" class="center">Unit</th>@endif
      @if($has('cost_price'))   <th style="width:10%" class="right">Cost (&#8369;)</th>@endif
      @if($has('selling_price'))<th style="width:10%" class="right">Selling (&#8369;)</th>@endif
      @if($has('stock'))        <th style="width:8%" class="center">Stock</th>@endif
      @if($has('reorder_level'))<th style="width:6%" class="center">Reorder</th>@endif
      @if($has('status'))       <th style="width:7%" class="center">Status</th>@endif
    </tr>
  </thead>
  <tbody>
    @foreach($products as $product)
    @php
      $qty = $product->stock->quantity_on_hand ?? 0;
      $low = $product->reorder_level > 0 && $qty <= $product->reorder_level;
    @endphp
    <tr>
      @if($has('sku'))          <td class="mono">{{ $product->sku }}</td>@endif
      @if($has('name'))         <td>{{ $product->name }}</td>@endif
      @if($has('category'))     <td>{{ $product->category?->name ?? '—' }}</td>@endif
      @if($has('unit'))         <td class="center">{{ $product->unit }}</td>@endif
      @if($has('cost_price'))   <td class="right">{{ number_format($product->cost_price, 2) }}</td>@endif
      @if($has('selling_price'))<td class="right" style="font-weight:bold">{{ number_format($product->base_selling_price, 2) }}</td>@endif
      @if($has('stock'))        <td class="center {{ $low ? 'stock-low' : 'stock-ok' }}">{{ $qty }}</td>@endif
      @if($has('reorder_level'))<td class="center" style="color:#64748b">{{ $product->reorder_level }}</td>@endif
      @if($has('status'))
        <td class="center">
          @if($product->is_active)
            <span class="badge-active">Active</span>
          @else
            <span class="badge-inactive">Inactive</span>
          @endif
        </td>
      @endif
    </tr>
    @endforeach
  </tbody>
</table>

@endsection
