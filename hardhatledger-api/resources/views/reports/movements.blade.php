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

  .summary-bar {
    display: flex; gap: 20px; margin-bottom: 12px;
    background: #f4f6f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 12px;
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

  .footer { margin-top: 14px; border-top: 1px solid #cbd5e1; padding-top: 6px; display:flex; justify-content:space-between; color:#64748b; font-size:7.5px; }
</style>
</head>
<body>

<div class="header">
  <h1>HardhatLedger — Inventory Movements</h1>
  <div class="meta">
    Period: {{ $from ? date('M d, Y', strtotime($from)) : 'All time' }}
    @if($to) — {{ date('M d, Y', strtotime($to)) }} @endif
    @if($type) &nbsp;|&nbsp; Type: {{ strtoupper($type) }} @endif
    &nbsp;|&nbsp; Generated: {{ now()->format('M d, Y g:i A') }}
    &nbsp;|&nbsp; Total records: {{ $movements->count() }}
  </div>
</div>

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
      <th>Date &amp; Time</th>
      <th>Product</th>
      <th>SKU</th>
      <th class="center">Type</th>
      <th class="center">Qty</th>
      <th class="right">Unit Cost</th>
      <th>Reference</th>
      <th>Notes</th>
      <th>User</th>
    </tr>
  </thead>
  <tbody>
    @forelse($movements as $m)
    <tr>
      <td class="small">{{ $m->created_at->format('M d, Y g:i A') }}</td>
      <td>{{ $m->product?->name ?? '—' }}</td>
      <td class="mono">{{ $m->product?->sku ?? '—' }}</td>
      <td class="center">
        @if($m->type === 'in')
          <span class="badge badge-in">IN</span>
        @elseif($m->type === 'out')
          <span class="badge badge-out">OUT</span>
        @else
          <span class="badge badge-adj">ADJ</span>
        @endif
      </td>
      <td class="center {{ $m->type === 'in' ? 'qty-in' : ($m->type === 'out' ? 'qty-out' : 'qty-adj') }}">
        {{ $m->type === 'in' ? '+' : ($m->type === 'out' ? '-' : '=') }}{{ $m->quantity }}
      </td>
      <td class="right">{{ $m->unit_cost ? number_format($m->unit_cost, 2) : '—' }}</td>
      <td class="small">
        @php
          $refMap = ['sale' => 'Sale', 'sale_void' => 'Sale Void', 'purchase_receipt' => 'Purchase', 'manual_adjustment' => 'Manual'];
          $ref = $refMap[$m->reference_type ?? ''] ?? $m->reference_type ?? '—';
        @endphp
        {{ $ref }}{{ $m->reference_id ? ' #'.$m->reference_id : '' }}
      </td>
      <td class="small">{{ $m->notes ?? '—' }}</td>
      <td class="small">{{ $m->user?->name ?? '—' }}</td>
    </tr>
    @empty
    <tr>
      <td colspan="9" style="text-align:center; padding:20px; color:#94a3b8;">No movements found for this period</td>
    </tr>
    @endforelse
  </tbody>
</table>

<div class="footer">
  <span>HardhatLedger — Inventory Movements Report</span>
  <span>{{ now()->format('M d, Y g:i A') }}</span>
</div>

</body>
</html>
