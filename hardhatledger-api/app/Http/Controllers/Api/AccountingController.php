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
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
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

        // Helper: sum net amount for an account code (credit - debit for revenue, debit - credit for expense)
        $sumAccount = function (string $code, bool $isRevenue) use ($start, $end): float {
            $account = ChartOfAccount::where('code', $code)->first();
            if (!$account) return 0.0;
            $raw = $isRevenue ? 'credit - debit' : 'debit - credit';
            return (float) JournalLine::where('account_id', $account->id)
                ->whereHas('journalEntry', fn ($q) => $q->whereBetween('date', [$start, $end]))
                ->sum(DB::raw($raw));
        };

        // Helper: sum all child accounts of a type, excluding specific codes
        $sumType = function (string $type, bool $isRevenue, array $excludeCodes = []) use ($start, $end): float {
            $raw = $isRevenue ? 'credit - debit' : 'debit - credit';
            return (float) JournalLine::whereHas('journalEntry', fn ($q) =>
                    $q->whereBetween('date', [$start, $end])
                )
                ->whereHas('account', fn ($q) =>
                    $q->where('type', $type)
                        ->whereNotNull('parent_id')
                        ->when($excludeCodes, fn ($q) => $q->whereNotIn('code', $excludeCodes))
                )
                ->sum(DB::raw($raw));
        };

        // --- Income section ---
        // Sales (VATable): account 4010 — Sales Revenue (VAT-bearing sales)
        $salesVatable   = $sumAccount('4010', true);
        // Sales (NonVAT): account 4020 — Other Income (non-vat receipts, walk-in, etc.)
        $salesNonVat    = $sumAccount('4020', true);
        $totalIncome    = $salesVatable + $salesNonVat;

        // --- Cost of Sales section ---
        // COGS NonVATable: account 5011 (if exists), fallback 0
        $cogsNonVat     = $sumAccount('5011', false);
        // COGS VATable: account 5010 — Cost of Goods Sold
        $cogsVatable    = $sumAccount('5010', false);
        $totalCogs      = $cogsNonVat + $cogsVatable;

        $grossProfit    = $totalIncome - $totalCogs;

        // --- Expenses section ---
        // Other Expenses: all expense accounts except COGS (5010, 5011)
        $otherExpenseAccounts = ChartOfAccount::where('type', 'expense')
            ->whereNotNull('parent_id')
            ->whereNotIn('code', ['5010', '5011'])
            ->get()
            ->map(fn ($a) => [
                'code'   => $a->code,
                'name'   => $a->name,
                'amount' => (float) JournalLine::where('account_id', $a->id)
                    ->whereHas('journalEntry', fn ($q) => $q->whereBetween('date', [$start, $end]))
                    ->sum(DB::raw('debit - credit')),
            ])
            ->values();

        $totalOtherExpenses = $otherExpenseAccounts->sum('amount');

        // Reconciliation Discrepancies: difference between total income recorded and
        // the sum of all revenue lines (catches rounding / unposted adjustments)
        $allRevenue = $sumType('revenue', true);
        $reconciliation = round($allRevenue - $totalIncome, 2);

        $totalExpenses  = $totalOtherExpenses + $reconciliation;
        $netIncome      = $grossProfit - $totalExpenses;

        return response()->json([
            'period'                  => ['start' => $start, 'end' => $end],
            // Income
            'sales_vatable'           => $salesVatable,
            'sales_non_vat'           => $salesNonVat,
            'total_income'            => $totalIncome,
            // Cost of Sales
            'cogs_non_vat'            => $cogsNonVat,
            'cogs_vatable'            => $cogsVatable,
            'total_cogs'              => $totalCogs,
            // Profit
            'gross_profit'            => $grossProfit,
            // Expenses
            'other_expense_accounts'  => $otherExpenseAccounts,
            'total_other_expenses'    => $totalOtherExpenses,
            'reconciliation'          => $reconciliation,
            'total_expenses'          => $totalExpenses,
            'net_income'              => $netIncome,
            // Legacy fields kept for backward compat
            'revenue'                 => $totalIncome,
            'cost_of_goods_sold'      => $totalCogs,
            'expenses'                => $totalExpenses,
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
            'end_date'   => 'required|date|after_or_equal:start_date',
        ]);

        $start = $request->start_date;
        $end   = $request->end_date;

        // ── Helper: net movement for a single account code over the period ──
        // For asset/expense accounts: debit increases balance (positive = cash used)
        // sign=1  → return debit-credit  (cash went OUT or asset went UP)
        // sign=-1 → return credit-debit  (cash came IN or liability went UP)
        $netAccount = function (string $code, string $direction = 'debit_minus_credit') use ($start, $end): float {
            $account = ChartOfAccount::where('code', $code)->first();
            if (!$account) return 0.0;
            $raw = $direction === 'debit_minus_credit' ? 'debit - credit' : 'credit - debit';
            return (float) JournalLine::where('account_id', $account->id)
                ->whereHas('journalEntry', fn ($q) => $q->whereBetween('date', [$start, $end]))
                ->sum(DB::raw($raw));
        };

        // ── 1. OPERATING ACTIVITIES (indirect method) ────────────────────────
        // Start with net income components
        $revenue   = $netAccount('4010', 'credit_minus_debit');  // Sales Revenue
        $cogs      = $netAccount('5010', 'debit_minus_credit');  // COGS
        $netIncome = $revenue - $cogs;

        // Adjust for non-cash operating items
        // Change in Accounts Receivable (increase = uses cash → negative adjustment)
        $arChange  = $netAccount('1100', 'debit_minus_credit');   // AR net debit movement
        // Change in Inventory (increase = uses cash → negative)
        $invChange = $netAccount('1200', 'debit_minus_credit');
        // Change in Accounts Payable (increase = source of cash → positive)
        $apChange  = $netAccount('2010', 'credit_minus_debit');
        // Accrued Expenses change (increase = source)
        $accrChange= $netAccount('2020', 'credit_minus_debit');

        // Cash paid for operating expenses (5020–5050)
        $operatingExpenses = 0.0;
        $expCodes = ['5020', '5030', '5040', '5050'];
        foreach ($expCodes as $code) {
            $operatingExpenses += $netAccount($code, 'debit_minus_credit');
        }

        $operatingItems = [
            ['label' => 'Net Sales Revenue',              'amount' => $revenue,             'type' => 'inflow'],
            ['label' => 'Cost of Goods Sold',             'amount' => -$cogs,               'type' => 'outflow'],
            ['label' => 'Change in Accounts Receivable',  'amount' => -$arChange,           'type' => $arChange  > 0 ? 'outflow' : 'inflow'],
            ['label' => 'Change in Inventory',            'amount' => -$invChange,          'type' => $invChange > 0 ? 'outflow' : 'inflow'],
            ['label' => 'Change in Accounts Payable',     'amount' => $apChange,            'type' => $apChange  > 0 ? 'inflow'  : 'outflow'],
            ['label' => 'Change in Accrued Expenses',     'amount' => $accrChange,          'type' => $accrChange> 0 ? 'inflow'  : 'outflow'],
            ['label' => 'Operating Expenses Paid',        'amount' => -$operatingExpenses,  'type' => 'outflow'],
        ];
        $netOperating = array_sum(array_column($operatingItems, 'amount'));

        // ── 2. INVESTING ACTIVITIES ──────────────────────────────────────────
        // Equipment purchases / disposals (account 1300)
        $equipChange = $netAccount('1300', 'debit_minus_credit');
        $investingItems = [
            ['label' => 'Purchase of Equipment', 'amount' => -$equipChange, 'type' => $equipChange > 0 ? 'outflow' : 'inflow'],
        ];
        $netInvesting = array_sum(array_column($investingItems, 'amount'));

        // ── 3. FINANCING ACTIVITIES ──────────────────────────────────────────
        // Owner's Capital contributions / withdrawals (3010)
        $capitalChange  = $netAccount('3010', 'credit_minus_debit');
        // Retained Earnings movements (3020)
        $retainedChange = $netAccount('3020', 'credit_minus_debit');

        $financingItems = [
            ['label' => "Owner's Capital Contributions", 'amount' => $capitalChange,  'type' => $capitalChange  > 0 ? 'inflow' : 'outflow'],
            ['label' => 'Retained Earnings Movements',   'amount' => $retainedChange, 'type' => $retainedChange > 0 ? 'inflow' : 'outflow'],
        ];
        $netFinancing = array_sum(array_column($financingItems, 'amount'));

        // ── 4. RAW CASH POSITION (actual ledger) ─────────────────────────────
        $cashAccountIds = ChartOfAccount::whereIn('code', ['1010', '1020'])->pluck('id');

        $cashInflows = (float) JournalLine::whereIn('account_id', $cashAccountIds)
            ->whereHas('journalEntry', fn ($q) => $q->whereBetween('date', [$start, $end]))
            ->sum('debit');

        $cashOutflows = (float) JournalLine::whereIn('account_id', $cashAccountIds)
            ->whereHas('journalEntry', fn ($q) => $q->whereBetween('date', [$start, $end]))
            ->sum('credit');

        // Cash on hand at start of period (all debits - credits on cash accounts before start)
        $cashOpeningIds = ChartOfAccount::whereIn('code', ['1010', '1020'])->pluck('id');
        $cashOpening = (float) JournalLine::whereIn('account_id', $cashOpeningIds)
            ->whereHas('journalEntry', fn ($q) => $q->whereDate('date', '<', $start))
            ->sum(DB::raw('debit - credit'));

        // ── 5. PAYMENT METHOD BREAKDOWN ───────────────────────────────────────
        $paymentBreakdown = Payment::where('status', 'confirmed')
            ->whereBetween('paid_at', [$start . ' 00:00:00', $end . ' 23:59:59'])
            ->select('payment_method', DB::raw('SUM(amount) as total'), DB::raw('COUNT(*) as count'))
            ->groupBy('payment_method')
            ->get()
            ->map(fn ($p) => [
                'method' => $p->payment_method,
                'total'  => (float) $p->total,
                'count'  => (int)   $p->count,
            ])
            ->values();

        $totalCollected = $paymentBreakdown->sum('total');

        // ── RESPONSE ─────────────────────────────────────────────────────────
        return response()->json([
            'period'            => ['start' => $start, 'end' => $end],
            // Summary KPIs
            'cash_inflows'      => $cashInflows,
            'cash_outflows'     => $cashOutflows,
            'net_cash_flow'     => $cashInflows - $cashOutflows,
            'cash_opening'      => $cashOpening,
            'cash_closing'      => $cashOpening + ($cashInflows - $cashOutflows),
            // Three-section statement
            'operating' => [
                'items'  => $operatingItems,
                'net'    => (float) $netOperating,
            ],
            'investing' => [
                'items'  => $investingItems,
                'net'    => (float) $netInvesting,
            ],
            'financing' => [
                'items'  => $financingItems,
                'net'    => (float) $netFinancing,
            ],
            'net_change_from_sections' => (float) ($netOperating + $netInvesting + $netFinancing),
            // Payment method breakdown
            'payment_breakdown' => $paymentBreakdown,
            'total_collected'   => (float) $totalCollected,
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

    public function clientStatementPdf(Request $request): Response
    {
        $request->validate([
            'client_id'  => 'required|exists:clients,id',
            'start_date' => 'required|date',
            'end_date'   => 'required|date|after_or_equal:start_date',
            'status'     => 'nullable|in:pending,completed,voided,refunded',
        ]);

        $client = Client::with('tier')->findOrFail($request->client_id);
        $start  = $request->start_date;
        $end    = $request->end_date;

        $query = SalesTransaction::where('client_id', $client->id)
            ->whereBetween('created_at', [$start, $end . ' 23:59:59'])
            ->with(['user', 'payments']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $transactions = $query->orderBy('created_at')->get();

        $totalCharges  = $transactions->where('status', '!=', 'voided')->sum('total_amount');
        $totalPayments = $transactions->flatMap->payments->where('status', 'confirmed')->sum('amount');
        $periodBalance = $totalCharges - $totalPayments;

        $pdf = Pdf::loadView('reports.client-statement', [
            'client'        => $client,
            'startDate'     => $start,
            'endDate'       => $end,
            'statusFilter'  => $request->status,
            'transactions'  => $transactions,
            'totalCharges'  => (float) $totalCharges,
            'totalPayments' => (float) $totalPayments,
            'periodBalance' => (float) $periodBalance,
        ]);

        $pdf->setPaper('A4', 'portrait');

        $slug     = preg_replace('/[^a-z0-9]+/i', '-', strtolower($client->business_name));
        $filename = "statement-{$slug}-{$start}-to-{$end}.pdf";

        return $pdf->download($filename);
    }
}
