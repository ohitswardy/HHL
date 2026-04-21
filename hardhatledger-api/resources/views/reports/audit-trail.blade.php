@extends('layouts.pdf')

@section('title', 'Audit Trail — TRI-MILLENNIUM HARDWARE TRADING')

@section('doc-title', 'Audit Trail Report')

@section('doc-meta')
Generated: {{ $generatedAt }}
@if(!empty($filters['date_from'])) &middot; From: {{ $filters['date_from'] }} @endif
@if(!empty($filters['date_to'])) &middot; To: {{ $filters['date_to'] }} @endif
@if(!empty($filters['action'])) &middot; Action: {{ $filters['action'] }} @endif
@if(!empty($filters['table_name'])) &middot; Module: {{ $filters['table_name'] }} @endif
@if(!empty($filters['search'])) &middot; Search: "{{ $filters['search'] }}" @endif
@endsection

@section('extra-styles')
<style>
  body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 8.5px; color: #1a1a1a; }

  .summary-bar {
    display: flex; gap: 24px; margin-bottom: 12px;
    background: #f4f6f9; border: 1px solid #e2e8f0; padding: 8px 12px;
  }
  .summary-bar .stat { font-size: 8px; color: #475569; }
  .summary-bar .stat strong { display: block; font-size: 13px; font-weight: bold; color: #1B3A5C; }

  table { width: 100%; border-collapse: collapse; }
  thead th {
    background: #1B3A5C; color: #fff;
    padding: 5px 7px; font-size: 7.5px; font-weight: bold;
    text-transform: uppercase; letter-spacing: 0.4px;
    border-bottom: 2px solid #F5A623;
  }
  thead th.center { text-align: center; }

  tbody tr:nth-child(even) { background: #f4f6f9; }
  tbody tr:nth-child(odd)  { background: #ffffff; }
  tbody td { padding: 4px 7px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
  tbody td.center { text-align: center; }
  tbody td.mono   { font-family: Courier New, monospace; font-size: 7.5px; color: #555; }
  tbody td.dim    { font-size: 7.5px; color: #64748b; }

  .badge { display:inline-block; padding:2px 6px; border-radius:10px; font-size:7px; font-weight:bold; }
  .badge-create  { background:#d1fae5; color:#065f46; }
  .badge-update  { background:#dbeafe; color:#1e40af; }
  .badge-delete  { background:#fee2e2; color:#991b1b; }
  .badge-restore { background:#fef3c7; color:#92400e; }
  .badge-default { background:#e2e8f0; color:#475569; }
</style>
@endsection

@section('content')

@php
  $actionCounts = $logs->groupBy('action')->map->count();
  $hasFilters = collect($filters)->filter()->isNotEmpty();
  $cols = $columns ?? ['created_at','user','action','table_name','record_id','ip_address'];
  $has = fn(string $c) => in_array($c, $cols);
  $colCount = count($cols) + 1; // +1 for details col which is always shown
@endphp

<div class="summary-bar">
  <div class="stat">
    <strong>{{ $logs->count() }}</strong>
    Total Events
  </div>
  @foreach($actionCounts as $action => $count)
  <div class="stat">
    <strong>{{ $count }}</strong>
    {{ ucfirst($action) }}
  </div>
  @endforeach
  @if($hasFilters)
  <div class="stat">
    <strong style="font-size:9px;font-weight:600;color:#d97706;">Filtered</strong>
    Results
  </div>
  @endif
</div>

<table>
  <thead>
    <tr>
      @if($has('created_at'))<th style="width:12%">Timestamp</th>@endif
      @if($has('user'))<th style="width:14%">User</th>@endif
      @if($has('action'))<th class="center" style="width:9%">Action</th>@endif
      @if($has('table_name'))<th style="width:14%">Module</th>@endif
      @if($has('record_id'))<th class="center" style="width:7%">Record ID</th>@endif
      @if($has('ip_address'))<th style="width:12%">IP Address</th>@endif
      <th style="width:32%">Details</th>
    </tr>
  </thead>
  <tbody>
    @forelse($logs as $log)
    @php
      $badgeClass = match($log->action) {
        'create'  => 'badge-create',
        'update'  => 'badge-update',
        'delete'  => 'badge-delete',
        'restore' => 'badge-restore',
        default   => 'badge-default',
      };
    @endphp
    <tr>
      @if($has('created_at'))<td class="mono">{{ \Carbon\Carbon::parse($log->created_at)->format('M d, Y H:i:s') }}</td>@endif
      @if($has('user'))<td>{{ $log->user?->name ?? 'System' }}</td>@endif
      @if($has('action'))<td class="center"><span class="badge {{ $badgeClass }}">{{ strtoupper($log->action) }}</span></td>@endif
      @if($has('table_name'))<td>{{ ucfirst(str_replace('_', ' ', $log->table_name)) }}</td>@endif
      @if($has('record_id'))<td class="center dim">{{ $log->record_id ?? '—' }}</td>@endif
      @if($has('ip_address'))<td class="mono dim">{{ $log->ip_address ?? '—' }}</td>@endif
      <td class="dim">
        @if($log->new_values)
          @php $vals = is_string($log->new_values) ? json_decode($log->new_values, true) : $log->new_values; @endphp
          @if(is_array($vals))
            {{ implode(', ', array_map(fn($k,$v) => "$k: $v", array_keys(array_slice($vals, 0, 3)), array_slice($vals, 0, 3))) }}
            @if(count($vals) > 3) … @endif
          @endif
        @endif
      </td>
    </tr>
    @empty
    <tr>
      <td colspan="{{ $colCount }}" style="text-align:center;padding:20px;color:#64748b;">No audit events found for the selected filters.</td>
    </tr>
    @endforelse
  </tbody>
</table>

@endsection
