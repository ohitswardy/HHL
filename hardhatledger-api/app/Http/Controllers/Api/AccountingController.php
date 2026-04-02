<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ChartOfAccountResource;
use App\Http\Resources\JournalEntryResource;
use App\Models\ChartOfAccount;
use App\Models\Client;
use App\Models\JournalEntry;
use App\Models\JournalLine;
use App\Models\Payment;
use App\Models\SalesTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccountingController extends Controller
{
    public function chartOfAccounts(): JsonResponse
    {
        $accounts = ChartOfAccount::whereNull('parent_id')
            ->with('children')
            ->orderBy('code')
            ->get();

        return response()->json(['data' => ChartOfAccountResource::collection($accounts)]);
    }

    public function journalEntries(Request $request): JsonResponse
    {
        $query = JournalEntry::with(['lines.account', 'user']);

        if ($from = $request->get('from')) {
            $query->whereDate('date', '>=', $from);
        }
        if ($to = $request->get('to')) {
            $query->whereDate('date', '<=', $to);
        }
        if ($type = $request->get('reference_type')) {
            $query->where('reference_type', $type);
        }

        $entries = $query->orderByDesc('date')->orderByDesc('id')
            ->paginate($request->get('per_page', 20));

        return response()->json([
            'data' => JournalEntryResource::collection($entries),
            'meta' => [
                'current_page' => $entries->currentPage(),
                'last_page' => $entries->lastPage(),
                'per_page' => $entries->perPage(),
                'total' => $entries->total(),
            ],
        ]);
    }

    public function incomeStatement(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $start = $request->start_date;
        $end = $request->end_date;

        $revenue = JournalLine::whereHas('journalEntry', fn ($q) =>
                $q->whereBetween('date', [$start, $end])
            )
            ->whereHas('account', fn ($q) => $q->where('type', 'revenue'))
            ->sum(DB::raw('credit - debit'));

        $cogs = JournalLine::whereHas('journalEntry', fn ($q) =>
                $q->whereBetween('date', [$start, $end])
            )
            ->whereHas('account', fn ($q) => $q->where('code', '5010'))
            ->sum(DB::raw('debit - credit'));

        $expenses = JournalLine::whereHas('journalEntry', fn ($q) =>
                $q->whereBetween('date', [$start, $end])
            )
            ->whereHas('account', fn ($q) =>
                $q->where('type', 'expense')->where('code', '!=', '5010')
            )
            ->sum(DB::raw('debit - credit'));

        $grossProfit = $revenue - $cogs;
        $netIncome = $grossProfit - $expenses;

        // Breakdown by account
        $revenueAccounts = ChartOfAccount::where('type', 'revenue')
            ->whereNotNull('parent_id')
            ->get()
            ->map(fn ($a) => [
                'code' => $a->code,
                'name' => $a->name,
                'amount' => (float) JournalLine::where('account_id', $a->id)
                    ->whereHas('journalEntry', fn ($q) => $q->whereBetween('date', [$start, $end]))
                    ->sum(DB::raw('credit - debit')),
            ]);

        $expenseAccounts = ChartOfAccount::where('type', 'expense')
            ->whereNotNull('parent_id')
            ->get()
            ->map(fn ($a) => [
                'code' => $a->code,
                'name' => $a->name,
                'amount' => (float) JournalLine::where('account_id', $a->id)
                    ->whereHas('journalEntry', fn ($q) => $q->whereBetween('date', [$start, $end]))
                    ->sum(DB::raw('debit - credit')),
            ]);

        return response()->json([
            'period' => ['start' => $start, 'end' => $end],
            'revenue' => (float) $revenue,
            'cost_of_goods_sold' => (float) $cogs,
            'gross_profit' => (float) $grossProfit,
            'expenses' => (float) $expenses,
            'net_income' => (float) $netIncome,
            'revenue_accounts' => $revenueAccounts,
            'expense_accounts' => $expenseAccounts,
        ]);
    }

    public function balanceSheet(Request $request): JsonResponse
    {
        $asOf = $request->get('as_of_date', now()->toDateString());

        $getBalance = function (string $type) use ($asOf) {
            return ChartOfAccount::where('type', $type)
                ->whereNotNull('parent_id')
                ->get()
                ->map(function ($account) use ($asOf, $type) {
                    $query = JournalLine::where('account_id', $account->id)
                        ->whereHas('journalEntry', fn ($q) => $q->whereDate('date', '<=', $asOf));

                    $balance = in_array($type, ['asset', 'expense'])
                        ? $query->sum(DB::raw('debit - credit'))
                        : $query->sum(DB::raw('credit - debit'));

                    return [
                        'code' => $account->code,
                        'name' => $account->name,
                        'balance' => (float) $balance,
                    ];
                });
        };

        $assets = $getBalance('asset');
        $liabilities = $getBalance('liability');
        $equity = $getBalance('equity');

        $totalAssets = $assets->sum('balance');
        $totalLiabilities = $liabilities->sum('balance');
        $totalEquity = $equity->sum('balance');

        return response()->json([
            'as_of_date' => $asOf,
            'assets' => ['accounts' => $assets, 'total' => (float) $totalAssets],
            'liabilities' => ['accounts' => $liabilities, 'total' => (float) $totalLiabilities],
            'equity' => ['accounts' => $equity, 'total' => (float) $totalEquity],
            'total_liabilities_equity' => (float) ($totalLiabilities + $totalEquity),
        ]);
    }

    public function cashFlow(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $start = $request->start_date;
        $end = $request->end_date;

        $cashAccountIds = ChartOfAccount::whereIn('code', ['1010', '1020'])->pluck('id');

        $inflows = (float) JournalLine::whereIn('account_id', $cashAccountIds)
            ->whereHas('journalEntry', fn ($q) => $q->whereBetween('date', [$start, $end]))
            ->sum('debit');

        $outflows = (float) JournalLine::whereIn('account_id', $cashAccountIds)
            ->whereHas('journalEntry', fn ($q) => $q->whereBetween('date', [$start, $end]))
            ->sum('credit');

        return response()->json([
            'period' => ['start' => $start, 'end' => $end],
            'inflows' => $inflows,
            'outflows' => $outflows,
            'net_cash_flow' => $inflows - $outflows,
        ]);
    }

    public function clientStatement(Request $request): JsonResponse
    {
        $request->validate([
            'client_id' => 'required|exists:clients,id',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $client = Client::with('tier')->findOrFail($request->client_id);
        $start = $request->start_date;
        $end = $request->end_date;

        $transactions = SalesTransaction::where('client_id', $client->id)
            ->whereBetween('created_at', [$start, $end . ' 23:59:59'])
            ->where('status', '!=', 'voided')
            ->with('payments')
            ->orderBy('created_at')
            ->get();

        $totalCharges = $transactions->sum('total_amount');
        $totalPayments = $transactions->flatMap->payments
            ->where('status', 'confirmed')
            ->sum('amount');

        return response()->json([
            'client' => [
                'id' => $client->id,
                'business_name' => $client->business_name,
                'tier' => $client->tier?->name,
                'outstanding_balance' => (float) $client->outstanding_balance,
            ],
            'period' => ['start' => $start, 'end' => $end],
            'total_charges' => (float) $totalCharges,
            'total_payments' => (float) $totalPayments,
            'balance' => (float) ($totalCharges - $totalPayments),
            'transactions' => $transactions->map(fn ($t) => [
                'id' => $t->id,
                'transaction_number' => $t->transaction_number,
                'date' => $t->created_at->toDateString(),
                'total_amount' => (float) $t->total_amount,
                'total_paid' => (float) $t->payments->where('status', 'confirmed')->sum('amount'),
                'status' => $t->status,
            ]),
        ]);
    }
}
