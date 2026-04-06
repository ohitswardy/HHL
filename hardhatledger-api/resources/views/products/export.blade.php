<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 9px; color: #1a1a1a; }

  .header { background: #1B3A5C; color: #fff; padding: 12px 16px; margin-bottom: 14px; }
  .header h1 { font-size: 16px; font-weight: bold; letter-spacing: 0.5px; }
  .header .meta { font-size: 8px; opacity: 0.8; margin-top: 3px; }

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

  .footer { margin-top: 14px; border-top: 1px solid #cbd5e1; padding-top: 6px; display: flex; justify-content: space-between; color: #64748b; font-size: 7.5px; }
  .summary { margin-bottom: 10px; font-size: 8px; color: #475569; }
  .summary span { font-weight: bold; color: #1B3A5C; }
</style>
</head>
<body>

<div class="header">
  <h1>HardhatLedger — Product List</h1>
  <div class="meta">Generated: {{ $date }} &nbsp;|&nbsp; Total products: {{ $products->count() }}</div>
</div>

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
      <th style="width:8%">SKU</th>
      <th style="width:26%">Product Name</th>
      <th style="width:14%">Category</th>
      <th style="width:5%" class="center">Unit</th>
      <th style="width:10%" class="right">Cost (₱)</th>
      <th style="width:10%" class="right">Selling (₱)</th>
      <th style="width:8%" class="center">Stock</th>
      <th style="width:6%" class="center">Reorder</th>
      <th style="width:7%" class="center">Status</th>
    </tr>
  </thead>
  <tbody>
    @foreach($products as $product)
    @php
      $qty = $product->stock->quantity_on_hand ?? 0;
      $low = $product->reorder_level > 0 && $qty <= $product->reorder_level;
    @endphp
    <tr>
      <td class="mono">{{ $product->sku }}</td>
      <td>{{ $product->name }}</td>
      <td>{{ $product->category?->name ?? '—' }}</td>
      <td class="center">{{ $product->unit }}</td>
      <td class="right">{{ number_format($product->cost_price, 2) }}</td>
      <td class="right" style="font-weight:bold">{{ number_format($product->base_selling_price, 2) }}</td>
      <td class="center {{ $low ? 'stock-low' : 'stock-ok' }}">{{ $qty }}</td>
      <td class="center" style="color:#64748b">{{ $product->reorder_level }}</td>
      <td class="center">
        @if($product->is_active)
          <span class="badge-active">Active</span>
        @else
          <span class="badge-inactive">Inactive</span>
        @endif
      </td>
    </tr>
    @endforeach
  </tbody>
</table>

<div class="footer">
  <span>HardhatLedger — Confidential</span>
  <span>{{ $date }}</span>
</div>

</body>
</html>
