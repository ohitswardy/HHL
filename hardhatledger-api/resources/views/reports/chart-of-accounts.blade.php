@extends('layouts.pdf')

@section('title', 'Chart of Accounts — HardhatLedger')

@section('doc-title', 'Chart of Accounts')

@section('doc-meta')
Generated on: {{ $generated_at }}
@endsection

@section('extra-styles')
<style>
        body {
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 11px;
            color: #222;
        }
        .page { padding: 6px 0; }

        .report-table {
            width: 100%;
            border-collapse: collapse;
        }
        .report-table th {
            border-bottom: 2px solid #333;
            padding: 6px 10px;
            text-align: left;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            color: #444;
        }
        .report-table th.amount {
            text-align: right;
        }
        .report-table td {
            padding: 5px 10px;
            font-size: 10px;
            border-bottom: 1px solid #eee;
        }
        .report-table td.amount {
            text-align: right;
            font-variant-numeric: tabular-nums;
        }
        .type-header td {
            font-weight: 700;
            background: #f5f5f5;
            padding-top: 10px;
            border-bottom: 1px solid #ccc;
        }
</style>
@endsection

@section('content')
<div class="page">

    <table class="report-table">
        <thead>
            <tr>
                <th>Name</th>
                <th>Account Type</th>
                <th>Detail Type</th>
                <th class="amount">Balance</th>
            </tr>
        </thead>
        <tbody>
            @php
                $typeLabels = [
                    'asset' => 'Current assets BAL',
                    'liability' => 'Current liabilities BAL',
                    'equity' => "Owner's equity BAL",
                    'revenue' => 'Income P&L',
                    'expense' => 'Expenses P&L',
                ];
                $currentType = null;
            @endphp

            @foreach($accounts as $account)
                @if($account->type !== $currentType)
                    @php $currentType = $account->type; @endphp
                    <tr class="type-header">
                        <td colspan="4">{{ ucfirst($currentType) }}</td>
                    </tr>
                @endif
                <tr>
                    <td>{{ $account->name }}</td>
                    <td>{{ $typeLabels[$account->type] ?? ucfirst($account->type) }}</td>
                    <td>{{ $account->detail_type ?? '—' }}</td>
                    <td class="amount">₱{{ number_format(abs($account->balance), 2) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
</div>
@endsection
