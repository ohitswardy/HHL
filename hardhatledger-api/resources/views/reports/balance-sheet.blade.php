<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 11px;
            color: #222;
            background: #fff;
        }
        .page { padding: 40px 52px; }

        /* ── Header ── */
        .report-title {
            font-size: 20px;
            font-weight: 400;
            text-align: center;
            color: #222;
            margin-bottom: 6px;
        }
        .company-name {
            font-size: 13px;
            font-weight: 700;
            text-align: center;
            color: #222;
            text-transform: uppercase;
            margin-bottom: 4px;
        }
        .report-period {
            font-size: 10px;
            text-align: center;
            color: #555;
            margin-bottom: 24px;
        }

        /* ── Table ── */
        .report-table {
            width: 100%;
            border-collapse: collapse;
        }
        .report-table td {
            padding: 3.5px 0;
            font-size: 10.5px;
            vertical-align: top;
        }

        /* Column header */
        .col-header {
            text-align: right;
            font-size: 9px;
            font-weight: 700;
            color: #555;
            text-transform: uppercase;
            padding-bottom: 6px;
            border-bottom: 1px solid #ccc;
        }

        /* Section header (Assets, Liabilities, etc.) */
        .section-header td {
            font-weight: 700;
            font-size: 10.5px;
            color: #222;
            padding-top: 10px;
            padding-bottom: 2px;
        }

        /* Sub-section header */
        .sub-section td {
            font-weight: 600;
            font-size: 10px;
            color: #333;
            padding-top: 4px;
            padding-left: 12px;
        }

        /* Sub-sub-section header */
        .sub-sub-section td {
            font-weight: 600;
            font-size: 10px;
            color: #444;
            padding-top: 3px;
            padding-left: 24px;
        }

        /* Account line item */
        .line-item td {
            padding: 2.5px 0 2.5px 28px;
            color: #444;
        }
        .line-item td.amount {
            text-align: right;
            font-variant-numeric: tabular-nums;
            padding-left: 0;
            color: #222;
        }

        /* Indented account (bank sub-accounts) */
        .line-item-indent td {
            padding: 2.5px 0 2.5px 40px;
            color: #555;
            font-size: 10px;
        }
        .line-item-indent td.amount {
            text-align: right;
            font-variant-numeric: tabular-nums;
            padding-left: 0;
            color: #222;
        }

        /* Total row */
        .total-row td {
            font-weight: 700;
            font-size: 10.5px;
            padding: 5px 0;
            border-top: 1px solid #bbb;
        }
        .total-row td.amount {
            text-align: right;
            font-variant-numeric: tabular-nums;
        }

        /* Sub-total row */
        .sub-total td {
            font-weight: 600;
            font-size: 10px;
            padding: 4px 0 4px 12px;
            border-top: 1px solid #ddd;
        }
        .sub-total td.amount {
            text-align: right;
            font-variant-numeric: tabular-nums;
        }

        /* Grand total */
        .grand-total td {
            font-weight: 700;
            font-size: 11.5px;
            padding: 8px 0;
            border-top: 2px solid #222;
            border-bottom: 3px double #222;
        }
        .grand-total td.amount {
            text-align: right;
            font-variant-numeric: tabular-nums;
        }

        /* Spacer */
        .spacer td { height: 4px; }

        /* Negative formatting */
        .negative { color: #c0392b; }

        /* ── Footer ── */
        .report-footer {
            margin-top: 36px;
            font-size: 8.5px;
            color: #999;
            text-align: center;
        }
    </style>
</head>
<body>
<div class="page">

    <div class="report-title">Balance Sheet</div>
    <div class="company-name">HardhatLedger</div>
    <div class="report-period">
        As of {{ \Carbon\Carbon::parse($as_of_date)->format('j M, Y') }}
    </div>

    <table class="report-table">

        {{-- Column Header --}}
        <tr>
            <td style="width: 60%;"></td>
            <td class="col-header" style="width: 40%;">TOTAL</td>
        </tr>

        {{-- ══════════ ASSETS ══════════ --}}
        <tr class="section-header"><td colspan="2">Assets</td></tr>
        <tr class="sub-section"><td colspan="2">Current Assets</td></tr>

        {{-- Accounts Receivable sub-group --}}
        @if(count($accounts_receivable) > 0)
        <tr class="sub-sub-section"><td colspan="2">Accounts Receivable</td></tr>
        @foreach($accounts_receivable as $account)
        <tr class="line-item-indent">
            <td>{{ $account['name'] }}</td>
            <td class="amount {{ $account['balance'] < 0 ? 'negative' : '' }}">
                @if($account['balance'] < 0)
                    -&#8369;{{ number_format(abs($account['balance']), 2) }}
                @else
                    &#8369;{{ number_format($account['balance'], 2) }}
                @endif
            </td>
        </tr>
        @endforeach
        <tr class="line-item">
            <td style="font-weight:600; padding-left:24px;">Total for Accounts Receivable</td>
            <td class="amount" style="font-weight:600;">&#8369;{{ number_format($total_accounts_receivable, 2) }}</td>
        </tr>
        @endif

        {{-- Other Current Assets (Cash, Banks, Inventory, VAT on Purchases, etc.) --}}
        @foreach($other_current_assets as $account)
        <tr class="line-item">
            <td>{{ $account['name'] }}</td>
            <td class="amount {{ $account['balance'] < 0 ? 'negative' : '' }}">
                @if($account['balance'] < 0)
                    -&#8369;{{ number_format(abs($account['balance']), 2) }}
                @else
                    &#8369;{{ number_format($account['balance'], 2) }}
                @endif
            </td>
        </tr>
        @endforeach

        <tr class="sub-total">
            <td>Total for Current Assets</td>
            <td class="amount">
                @if($total_current_assets < 0)
                    -&#8369;{{ number_format(abs($total_current_assets), 2) }}
                @else
                    &#8369;{{ number_format($total_current_assets, 2) }}
                @endif
            </td>
        </tr>

        {{-- Fixed Assets --}}
        @if(count($fixed_assets) > 0)
        <tr class="sub-section"><td colspan="2">Fixed Assets</td></tr>
        @foreach($fixed_assets as $account)
        <tr class="line-item">
            <td>{{ $account['name'] }}</td>
            <td class="amount {{ $account['balance'] < 0 ? 'negative' : '' }}">
                @if($account['balance'] < 0)
                    -&#8369;{{ number_format(abs($account['balance']), 2) }}
                @else
                    &#8369;{{ number_format($account['balance'], 2) }}
                @endif
            </td>
        </tr>
        @endforeach
        <tr class="sub-total">
            <td>Total for Fixed Assets</td>
            <td class="amount">&#8369;{{ number_format($total_fixed_assets, 2) }}</td>
        </tr>
        @endif

        <tr class="total-row">
            <td>Total for Assets</td>
            <td class="amount">
                @if($total_assets < 0)
                    -&#8369;{{ number_format(abs($total_assets), 2) }}
                @else
                    &#8369;{{ number_format($total_assets, 2) }}
                @endif
            </td>
        </tr>

        <tr class="spacer"><td colspan="2"></td></tr>

        {{-- ══════════ LIABILITIES & SHAREHOLDER'S EQUITY ══════════ --}}
        <tr class="section-header"><td colspan="2">Liabilities and Shareholder's Equity</td></tr>

        {{-- Current Liabilities --}}
        @if(count($current_liabilities) > 0)
        <tr class="sub-section"><td colspan="2">Current Liabilities</td></tr>
        @foreach($current_liabilities as $account)
        <tr class="line-item">
            <td>{{ $account['name'] }}</td>
            <td class="amount {{ $account['balance'] < 0 ? 'negative' : '' }}">
                @if($account['balance'] < 0)
                    -&#8369;{{ number_format(abs($account['balance']), 2) }}
                @else
                    &#8369;{{ number_format($account['balance'], 2) }}
                @endif
            </td>
        </tr>
        @endforeach
        <tr class="sub-total">
            <td>Total for Current Liabilities</td>
            <td class="amount">&#8369;{{ number_format($total_current_liabilities, 2) }}</td>
        </tr>
        @endif

        {{-- Non-current Liabilities --}}
        <tr class="sub-section"><td colspan="2">Non-current Liabilities</td></tr>
        @if(count($non_current_liabilities) > 0)
        @foreach($non_current_liabilities as $account)
        <tr class="line-item">
            <td>{{ $account['name'] }}</td>
            <td class="amount">&#8369;{{ number_format($account['balance'], 2) }}</td>
        </tr>
        @endforeach
        <tr class="sub-total">
            <td>Total for Non-current Liabilities</td>
            <td class="amount">&#8369;{{ number_format($total_non_current_liabilities, 2) }}</td>
        </tr>
        @endif

        <tr class="spacer"><td colspan="2"></td></tr>

        {{-- Shareholder's Equity --}}
        <tr class="sub-section"><td colspan="2">Shareholder's Equity</td></tr>

        @foreach($equity_accounts as $account)
        <tr class="line-item">
            <td>{{ $account['name'] }}</td>
            <td class="amount">&#8369;{{ number_format($account['balance'], 2) }}</td>
        </tr>
        @endforeach

        {{-- Retained Earnings → Net Income sub-item --}}
        <tr class="sub-sub-section"><td colspan="2">Retained Earnings</td></tr>
        <tr class="line-item-indent">
            <td>Net Income</td>
            <td class="amount">&#8369;{{ number_format($net_income, 2) }}</td>
        </tr>

        <tr class="sub-total">
            <td>Total for Shareholder's Equity</td>
            <td class="amount">&#8369;{{ number_format($total_equity, 2) }}</td>
        </tr>

        <tr class="spacer"><td colspan="2"></td></tr>

        {{-- ══════════ GRAND TOTAL ══════════ --}}
        <tr class="grand-total">
            <td>Total for Liabilities and Shareholder's Equity</td>
            <td class="amount">&#8369;{{ number_format($total_liabilities_equity, 2) }}</td>
        </tr>

    </table>

    <div class="report-footer">
        Accrual Basis &nbsp; {{ now()->format('l, d F Y h:i A') }} GMTZ
    </div>

</div>
</body>
</html>
