<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            margin: 20px;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #1B3A5C;
            padding-bottom: 15px;
        }
        .header h1 {
            font-size: 24px;
            margin: 0;
            color: #1B3A5C;
        }
        .header p {
            margin: 5px 0;
            font-size: 11px;
            color: #666;
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
            border-radius: 4px;
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
        .page-break {
            page-break-after: always;
        }
        .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #999;
            border-top: 1px solid #ddd;
            padding-top: 10px;
        }
        .voided-row td {
            text-decoration: line-through;
            color: #aaa !important;
            background-color: #fafafa !important;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>HARDHATLEDGER</h1>
        <p>Construction Materials Supplier</p>
        <p>Transaction Report</p>
    </div>

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
                <th style="width: 12%">Transaction #</th>
                <th style="width: 13%">Date & Time</th>
                <th style="width: 14%">Client</th>
                <th style="width: 8%">Type</th>
                <th style="width: 8%">Status</th>
                <th style="width: 9%" class="text-right">Subtotal</th>
                <th style="width: 7%" class="text-right">Discount</th>
                <th style="width: 9%" class="text-right">Total</th>
                <th style="width: 20%">Notes</th>
            </tr>
        </thead>
        <tbody>
            @forelse($sales as $sale)
            <tr @if($sale->status === 'voided') class="voided-row" @endif>
                <td>{{ $sale->transaction_number }}</td>
                <td>{{ $sale->created_at->format('M d, Y h:i A') }}</td>
                <td>{{ $sale->client?->business_name ?? 'Walk-in' }}</td>
                <td class="text-center">{{ ucfirst($sale->fulfillment_type) }}</td>
                <td class="text-center">{{ ucfirst($sale->status) }}</td>
                <td class="text-right">{{ number_format($sale->subtotal, 2) }}</td>
                <td class="text-right">{{ number_format($sale->discount_amount, 2) }}</td>
                <td class="text-right amount">{{ number_format($sale->total_amount, 2) }}</td>
                <td style="font-size:9px; color:#555;">{{ $sale->notes ?? '—' }}</td>
            </tr>
            @empty
            <tr>
                <td colspan="9" class="text-center">No transactions found for this period</td>
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
        <div class="summary-row summary-total">
            <span>TOTAL SALES</span>
            <span>{{ number_format($activeSales->sum('total_amount'), 2) }}</span>
        </div>
    </div>

    <div class="footer">
        <p>This is an automatically generated report from HardhatLedger</p>
        <p>HardhatLedger &copy; {{ date('Y') }} - All Rights Reserved</p>
    </div>
</body>
</html>
