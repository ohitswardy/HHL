<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 10px; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; vertical-align: top; }
        .header { margin-bottom: 10px; }
        .header h1 { font-size: 16px; margin: 0; color: #1B3A5C; }
        .header p { margin: 2px 0; font-size: 10px; }
        .items th { text-align: left; font-size: 10px; border-bottom: 1px solid #000; padding-bottom: 4px; }
        .items td { font-size: 10px; padding: 3px 0; }
        .totals td { padding: 2px 0; }
        .footer { margin-top: 15px; font-size: 9px; }
    </style>
</head>
<body>
    <div class="header center">
        <h1>HARDHATLEDGER</h1>
        <p>Construction Materials Supplier</p>
        <p>Official Receipt</p>
    </div>

    <div class="divider"></div>

    <table>
        <tr>
            <td><strong>Receipt #:</strong> {{ $sale->transaction_number }}</td>
        </tr>
        <tr>
            <td><strong>Date:</strong> {{ $sale->created_at->format('M d, Y h:i A') }}</td>
        </tr>
        <tr>
            <td><strong>Cashier:</strong> {{ $sale->user->name }}</td>
        </tr>
        @if($sale->client)
        <tr>
            <td><strong>Client:</strong> {{ $sale->client->business_name }}</td>
        </tr>
        @endif
        <tr>
            <td><strong>Type:</strong> {{ ucfirst($sale->fulfillment_type) }}</td>
        </tr>
    </table>

    <div class="divider"></div>

    <table class="items">
        <thead>
            <tr>
                <th style="width:40%">Item</th>
                <th style="width:15%">Qty</th>
                <th style="width:20%">Price</th>
                <th style="width:25%" class="right">Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($sale->items as $item)
            <tr>
                <td>{{ $item->product->name }}</td>
                <td>{{ $item->quantity }}</td>
                <td>{{ number_format($item->unit_price, 2) }}</td>
                <td class="right">{{ number_format($item->line_total, 2) }}</td>
            </tr>
            @if($item->discount > 0)
            <tr>
                <td colspan="3" style="font-size:9px; color:#666; padding-left:10px">Discount</td>
                <td class="right" style="font-size:9px; color:#666">-{{ number_format($item->discount, 2) }}</td>
            </tr>
            @endif
            @endforeach
        </tbody>
    </table>

    <div class="divider"></div>

    <table class="totals">
        <tr>
            <td>Subtotal</td>
            <td class="right">{{ number_format($sale->subtotal, 2) }}</td>
        </tr>
        @if($sale->discount_amount > 0)
        <tr>
            <td>Discount</td>
            <td class="right">-{{ number_format($sale->discount_amount, 2) }}</td>
        </tr>
        @endif
        @if($sale->delivery_fee > 0)
        <tr>
            <td>Delivery Fee</td>
            <td class="right">{{ number_format($sale->delivery_fee, 2) }}</td>
        </tr>
        @endif
        <tr>
            <td class="bold" style="font-size:13px; padding-top:5px">TOTAL</td>
            <td class="right bold" style="font-size:13px; padding-top:5px">{{ number_format($sale->total_amount, 2) }}</td>
        </tr>
        @if($sale->tax_amount > 0)
        <tr>
            <td style="font-size:9px; color:#666;">VAT incl. ({{ $taxRate }}%)</td>
            <td class="right" style="font-size:9px; color:#666;">{{ number_format($sale->tax_amount, 2) }}</td>
        </tr>
        @endif
    </table>

    <div class="divider"></div>

    <table>
        <tr><td colspan="2" class="bold">Payment Details:</td></tr>
        @foreach($sale->payments as $payment)
        <tr>
            <td>{{ ucfirst(str_replace('_', ' ', $payment->payment_method)) }}</td>
            <td class="right">{{ number_format($payment->amount, 2) }}</td>
        </tr>
        @endforeach
    </table>

    @if($sale->notes)
    <div class="divider"></div>

    <table>
        <tr>
            <td class="bold">Notes:</td>
        </tr>
        <tr>
            <td style="padding-top:2px; color:#444; white-space:pre-wrap;">{{ $sale->notes }}</td>
        </tr>
    </table>
    @endif

    <div class="divider"></div>

    <div class="footer center">
        <p>Thank you for your purchase!</p>
        <p style="margin-top:4px; font-size:8px; color:#888;">{{ $sale->created_at->setTimezone('Asia/Manila')->format('M d, Y h:i A') }} PST</p>
        <p style="margin-top:2px; font-size:8px; color:#888;">HardhatLedger 2026 &mdash; All rights reserved for CW Devs</p>
    </div>
</body>
</html>
