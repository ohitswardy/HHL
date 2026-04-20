@extends('layouts.pdf')

@section('title', 'Transaction Report — HardhatLedger')

@section('doc-title', 'Transaction Report')

@section('doc-meta')
{{ $label }}
@if($statusLabel !== 'All') &middot; {{ $statusLabel }} @endif
@if($fulfillmentLabel !== 'All') &middot; {{ $fulfillmentLabel }} @endif
@endsection

@section('extra-styles')
<style>
        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            color: #333;
        }
        .period-info {
            text-align: right;
            margin-bottom: 15px;
            font-size: 11px;
            color: #666;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        th {
            background-color: #1B3A5C;
            color: white;
            padding: 10px;
            text-align: left;
            font-weight: bold;
            font-size: 11px;
        }
        td {
            padding: 8px 10px;
            border-bottom: 1px solid #ddd;
            font-size: 10px;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .text-right {
            text-align: right;
        }
        .text-center {
            text-align: center;
        }
        .amount {
            font-weight: bold;
        }
        .summary {
            background-color: #f0f0f0;
            padding: 15px;
            margin-top: 20px;
            font-weight: bold;
        }
        .summary-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            padding: 5px 0;
            border-bottom: 1px solid #ddd;
        }
        .summary-row:last-child {
            border-bottom: 2px solid #1B3A5C;
            padding-top: 10px;
            padding-bottom: 10px;
        }
        .summary-total {
            font-size: 14px;
            color: #1B3A5C;
        }
        .voided-row td {
            text-decoration: line-through;
            color: #aaa;
            background-color: #fafafa;
        }
        .tax-active {
            color: #1a6b9e;
            font-weight: bold;
        }
        .tax-zero {
            color: #aaa;
        }
</style>
@endsection

@section('content')

@php
    $cols = $columns ?? ['transaction_number','date','client','fulfillment_type','status','subtotal','discount','tax','total','payment_method','cashier','notes'];
    $has = fn(string $c) => in_array($c, $cols);
@endphp

    <div class="period-info">
        <strong>Period:</strong> {{ $label }}
        @if($statusLabel !== 'All') &nbsp;&middot;&nbsp; <strong>Status:</strong> {{ $statusLabel }} @endif
        @if($fulfillmentLabel !== 'All') &nbsp;&middot;&nbsp; <strong>Type:</strong> {{ $fulfillmentLabel }} @endif
        @if($paymentLabel !== 'All') &nbsp;&middot;&nbsp; <strong>Payment:</strong> {{ $paymentLabel }} @endif
        <br>
        <strong>Generated:</strong> {{ now()->format('F j, Y \a\t g:i A') }}
    </div>

    <table>
        <thead>
            <tr>
                @if($has('transaction_number')) <th style="width: 12%">Transaction #</th>@endif
                @if($has('date'))               <th style="width: 13%">Date & Time</th>@endif
                @if($has('client'))             <th style="width: 13%">Client</th>@endif
                @if($has('fulfillment_type'))   <th style="width: 7%">Type</th>@endif
                @if($has('status'))             <th style="width: 7%">Status</th>@endif
                @if($has('subtotal'))           <th style="width: 8%" class="text-right">Subtotal</th>@endif
                @if($has('discount'))           <th style="width: 6%" class="text-right">Discount</th>@endif
                @if($has('tax'))                <th style="width: 6%" class="text-right">VAT</th>@endif
                @if($has('total'))              <th style="width: 8%" class="text-right">Total</th>@endif
                @if($has('payment_method'))     <th style="width: 10%">Payment</th>@endif
                @if($has('cashier'))            <th style="width: 8%">Cashier</th>@endif
                @if($has('notes'))              <th>Notes</th>@endif
            </tr>
        </thead>
        <tbody>
            @forelse($sales as $sale)
            <tr @if($sale->status === 'voided') class="voided-row" @endif>
                @if($has('transaction_number')) <td>{{ $sale->transaction_number }}</td>@endif
                @if($has('date'))               <td>{{ $sale->created_at->format('M d, Y h:i A') }}</td>@endif
                @if($has('client'))             <td>{{ $sale->client?->business_name ?? 'Walk-in' }}</td>@endif
                @if($has('fulfillment_type'))   <td class="text-center">{{ ucfirst($sale->fulfillment_type) }}</td>@endif
                @if($has('status'))             <td class="text-center">{{ ucfirst($sale->status) }}</td>@endif
                @if($has('subtotal'))           <td class="text-right">{{ number_format($sale->subtotal, 2) }}</td>@endif
                @if($has('discount'))           <td class="text-right">{{ number_format($sale->discount_amount, 2) }}</td>@endif
                @if($has('tax'))
                    <td class="text-right {{ $sale->tax_amount > 0 ? 'tax-active' : 'tax-zero' }}">
                        {{ $sale->tax_amount > 0 ? number_format($sale->tax_amount, 2) : '—' }}
                    </td>
                @endif
                @if($has('total'))              <td class="text-right amount">{{ number_format($sale->total_amount, 2) }}</td>@endif
                @if($has('payment_method'))     <td>{{ $sale->payments->pluck('payment_method')->join(', ') }}</td>@endif
                @if($has('cashier'))            <td style="font-size:9px;">{{ $sale->user?->name ?? '—' }}</td>@endif
                @if($has('notes'))              <td style="font-size:9px; color:#555;">{{ $sale->notes ?? '—' }}</td>@endif
            </tr>
            @empty
            <tr>
                <td colspan="{{ count($cols) }}" class="text-center">No transactions found for this period</td>
            </tr>
            @endforelse
        </tbody>
    </table>

    @php $activeSales = $sales->reject(fn ($s) => $s->status === 'voided'); @endphp
    <div class="summary">
        <div class="summary-row">
            <span>Total Transactions:</span>
            <span>{{ $sales->count() }}</span>
        </div>
        @if($sales->count() !== $activeSales->count())
        <div class="summary-row" style="color: #999; font-size: 10px; font-weight: normal;">
            <span>{{ $sales->count() - $activeSales->count() }} voided transaction(s) shown with strikethrough &mdash; excluded from totals below</span>
            <span></span>
        </div>
        @endif
        <div class="summary-row">
            <span>Total Subtotal:</span>
            <span>{{ number_format($activeSales->sum('subtotal'), 2) }}</span>
        </div>
        <div class="summary-row">
            <span>Total Discounts:</span>
            <span>-{{ number_format($activeSales->sum('discount_amount'), 2) }}</span>
        </div>
        @if($activeSales->sum('tax_amount') > 0)
        <div class="summary-row" style="color:#1a6b9e;">
            <span>Total VAT Collected:</span>
            <span>{{ number_format($activeSales->sum('tax_amount'), 2) }}</span>
        </div>
        @endif
        <div class="summary-row summary-total">
            <span>TOTAL SALES</span>
            <span>{{ number_format($activeSales->sum('total_amount'), 2) }}</span>
        </div>
    </div>

@endsection
