<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ChartOfAccountResource;
use App\Http\Resources\JournalEntryResource;
use App\Models\ChartOfAccount;
use App\Models\Client;
use App\Models\Expense;
use App\Models\ExpenseCategory;
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

    public function chartOfAccountsFlat(): JsonResponse
    {
        $accounts = ChartOfAccount::orderBy('code')->get();

        return response()->json(['data' => ChartOfAccountResource::collection($accounts)]);
    }

    public function storeAccount(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code'        => 'required|string|max:20|unique:chart_of_accounts,code',
            'name'        => 'required|string|max:255',
            'type'        => 'required|in:asset,liability,equity,revenue,expense',
            'detail_type' => 'nullable|string|max:255',
            'parent_id'   => 'nullable|integer|exists:chart_of_accounts,id',
            'is_active'   => 'boolean',
        ]);

        $account = ChartOfAccount::create($validated);

        return response()->json([
            'data' => new ChartOfAccountResource($account),
            'message' => 'Account created successfully.',
        ], 201);
    }

    public function updateAccount(Request $request, int $id): JsonResponse
    {
        $account = ChartOfAccount::findOrFail($id);

        $validated = $request->validate([
            'code'        => 'required|string|max:20|unique:chart_of_accounts,code,' . $account->id,
            'name'        => 'required|string|max:255',
            'type'        => 'required|in:asset,liability,equity,revenue,expense',
            'detail_type' => 'nullable|string|max:255',
            'parent_id'   => 'nullable|integer|exists:chart_of_accounts,id',
            'is_active'   => 'boolean',
        ]);

        $account->update($validated);

        return response()->json([
            'data' => new ChartOfAccountResource($account->fresh()),
            'message' => 'Account updated successfully.',
        ]);
    }

    public function destroyAccount(int $id): JsonResponse
    {
        $account = ChartOfAccount::findOrFail($id);

        // Prevent deletion if account has journal lines
        if ($account->journalLines()->exists()) {
            return response()->json([
                'message' => 'Cannot delete account with existing journal entries.',
            ], 422);
        }

        // Prevent deletion if account has children
        if ($account->children()->exists()) {
            return response()->json([
                'message' => 'Cannot delete account with child accounts.',
            ], 422);
        }

        $account->delete();

        return response()->json(['message' => 'Account deleted successfully.']);
    }

    public function chartOfAccountsPdf(): Response
    {
        $accounts = ChartOfAccount::whereNotNull('parent_id')
            ->orderBy('code')
            ->get();

        $pdf = Pdf::loadView('reports.chart-of-accounts', [
            'accounts' => $accounts,
            'generated_at' => now()->format('n/j/Y'),
        ])->setOptions(['enable_php' => true]);

        return $pdf->download('chart-of-accounts.pdf');
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

        $data = $this->buildIncomeStatement($start, $end);

        return response()->json($data);
    }

    /**
     * Generate the Income Statement data matching the QuickBooks P&L format.
     */
    private function buildIncomeStatement(string $start, string $end): array
    {
        // ── INCOME (revenue accounts) ──
        $incomeAccounts = ChartOfAccount::where('type', 'revenue')
            ->whereNotNull('parent_id')
            ->orderBy('code')
            ->get()
            ->map(function ($account) use ($start, $end) {
                $amount = (float) JournalLine::where('account_id', $account->id)
                    ->whereHas('journalEntry', fn ($q) => $q->whereBetween('date', [$start, $end]))
                    ->sum(DB::raw('credit - debit'));
                return [
                    'code'   => $account->code,
                    'name'   => $account->name,
                    'amount' => $amount,
                ];
            })
            ->filter(fn ($a) => abs($a['amount']) >= 0.01)
            ->values();

        $totalIncome = $incomeAccounts->sum('amount');

        // ── COST OF SALES (expense accounts in 50xx range) ──
        $cosCodes = ['5010', '5011', '5060']; // COGS VATable, COGS NonVATable, Cost of Sales

        // Part 1 (journal): COGS from sales journal entries (the normal path)
        $cosJournalMap = ChartOfAccount::where('type', 'expense')
            ->whereIn('code', $cosCodes)
            ->orderBy('code')
            ->get()
            ->mapWithKeys(function ($account) use ($start, $end) {
                $amount = (float) JournalLine::where('account_id', $account->id)
                    ->whereHas('journalEntry', fn ($q) => $q->whereBetween('date', [$start, $end]))
                    ->sum(DB::raw('debit - credit'));
                return [$account->code => [
                    'code'   => $account->code,
                    'name'   => $account->name,
                    'amount' => $amount,
                ]];
            });

        // ── ONE PASS: query all direct expenses and split into COGS vs other ──
        // Covers PO-sourced and any non-journaled expenses for both sections.
        $allDirectExpenses = Expense::with('category')
            ->whereIn('status', ['recorded', 'confirmed'])
            ->whereNotNull('expense_category_id')
            ->whereBetween('date', [$start, $end])
            ->get()
            ->groupBy(fn ($e) => $e->category?->account_code)
            ->map(function ($group, $accountCode) {
                if (!$accountCode) {
                    return null;
                }
                $category = $group->first()->category;
                return [
                    'code'          => (string) $accountCode,
                    'name'          => $category?->name ?? $accountCode,
                    'direct_amount' => $group->sum(fn ($e) => (float) $e->subtotal),
                    'count'         => $group->count(),
                ];
            })
            ->filter();

        $directCosExpenses   = $allDirectExpenses->filter(fn ($d) => in_array($d['code'], $cosCodes))->values();
        $directOtherExpenses = $allDirectExpenses->filter(fn ($d) => !in_array($d['code'], $cosCodes))->values();

        // Merge COGS: if no journal entry for a COS category, fill from direct expenses
        $cosMap = $cosJournalMap->toArray();
        foreach ($directCosExpenses as $direct) {
            $code = $direct['code'];
            $hasJournalEntry = isset($cosMap[$code]) && abs($cosMap[$code]['amount']) >= 0.01;
            if (!$hasJournalEntry) {
                $cosMap[$code] = [
                    'code'   => $code,
                    'name'   => $direct['name'],
                    'amount' => $direct['direct_amount'],
                    'source' => 'expenses',
                    'count'  => $direct['count'],
                ];
            } else {
                $cosMap[$code]['source'] = 'journal';
                $cosMap[$code]['count']  = $direct['count'];
            }
        }

        $cosAccounts = collect($cosMap)
            ->filter(fn ($a) => abs($a['amount']) >= 0.01)
            ->sortBy('code')
            ->values();

        $totalCos    = $cosAccounts->sum('amount');
        $grossProfit = $totalIncome - $totalCos;

        // ── OTHER EXPENSES (all expense accounts NOT in the COS list) ──
        // Part 1: Journal-based amounts (manual expenses that posted journal entries)
        $journalExpenseMap = ChartOfAccount::where('type', 'expense')
            ->whereNotNull('parent_id')
            ->whereNotIn('code', $cosCodes)
            ->orderBy('code')
            ->get()
            ->mapWithKeys(function ($account) use ($start, $end) {
                $amount = (float) JournalLine::where('account_id', $account->id)
                    ->whereHas('journalEntry', fn ($q) => $q->whereBetween('date', [$start, $end]))
                    ->sum(DB::raw('debit - credit'));
                return [$account->code => [
                    'code'   => $account->code,
                    'name'   => $account->name,
                    'amount' => $amount,
                ]];
            });

        // Merge other expenses: fill from direct expenses where no journal entry exists
        $mergedMap = $journalExpenseMap->toArray();
        foreach ($directOtherExpenses as $direct) {
            $code = $direct['code'];
            $hasJournalEntry = isset($mergedMap[$code]) && abs($mergedMap[$code]['amount']) >= 0.01;
            if (!$hasJournalEntry) {
                $mergedMap[$code] = [
                    'code'   => $code,
                    'name'   => $direct['name'],
                    'amount' => $direct['direct_amount'],
                    'source' => 'expenses',
                    'count'  => $direct['count'],
                ];
            } else {
                $mergedMap[$code]['source'] = 'journal';
                $mergedMap[$code]['count']  = $direct['count'];
            }
        }

        $otherExpenseAccounts = collect($mergedMap)
            ->filter(fn ($a) => abs($a['amount']) >= 0.01)
            ->sortBy('code')
            ->values();

        $totalOtherExpenses = $otherExpenseAccounts->sum('amount');
        $netIncome = $grossProfit - $totalOtherExpenses;

        return [
            'period'                 => ['start' => $start, 'end' => $end],
            // Income
            'income'                 => $incomeAccounts,
            'total_income'           => $totalIncome,
            // Cost of Sales
            'cost_of_sales'          => $cosAccounts,
            'total_cost_of_sales'    => $totalCos,
            // Gross Profit
            'gross_profit'           => $grossProfit,
            // Other Expenses
            'other_expense_accounts' => $otherExpenseAccounts,
            'total_other_expenses'   => $totalOtherExpenses,
            // Net Earnings
            'net_income'             => $netIncome,
            // Backward-compatible aliases
            'sales_vatable'          => $incomeAccounts->firstWhere('code', '4010')['amount'] ?? 0,
            'sales_non_vat'          => $incomeAccounts->firstWhere('code', '4020')['amount'] ?? 0,
            'cogs_non_vat'           => $cosAccounts->firstWhere('code', '5011')['amount'] ?? 0,
            'cogs_vatable'           => $cosAccounts->firstWhere('code', '5010')['amount'] ?? 0,
            'total_cogs'             => $totalCos,
            'reconciliation'         => $otherExpenseAccounts->firstWhere('code', '6230')['amount'] ?? 0,
            'total_expenses'         => $totalOtherExpenses,
            'revenue'                => $totalIncome,
            'cost_of_goods_sold'     => $totalCos,
            'expenses'               => $totalOtherExpenses,
        ];
    }

    public function balanceSheet(Request $request): JsonResponse
    {
        $asOf = $request->get('as_of_date', now()->toDateString());

        $data = $this->buildBalanceSheet($asOf);

        return response()->json($data);
    }

    /**
     * Build balance sheet data grouped by accountant categories.
     * AR → Cash → Banks → Input VAT | VAT Payable | Net Income
     */
    private function buildBalanceSheet(string $asOf): array
    {
        $getAccounts = function (string $type) use ($asOf) {
            return ChartOfAccount::where('type', $type)
                ->whereNotNull('parent_id')
                ->orderBy('code')
                ->get()
                ->map(function ($account) use ($asOf, $type) {
                    $query = JournalLine::where('account_id', $account->id)
                        ->whereHas('journalEntry', fn ($q) => $q->whereDate('date', '<=', $asOf));

                    $balance = in_array($type, ['asset', 'expense'])
                        ? $query->sum(DB::raw('debit - credit'))
                        : $query->sum(DB::raw('credit - debit'));

                    return [
                        'code'    => $account->code,
                        'name'    => $account->name,
                        'balance' => (float) $balance,
                    ];
                });
        };

        $assets      = $getAccounts('asset');
        $liabilities = $getAccounts('liability');
        $equity      = $getAccounts('equity');

        // ── Group assets ──
        $arCodes    = ['1100', '1120'];
        $fixedCodes = ['1500', '1550'];

        $accountsReceivable = $assets->filter(fn ($a) => in_array($a['code'], $arCodes))
            ->filter(fn ($a) => abs($a['balance']) >= 0.01)->values();
        $totalAR = (float) $accountsReceivable->sum('balance');

        $fixedAssets = $assets->filter(fn ($a) => in_array($a['code'], $fixedCodes))
            ->filter(fn ($a) => abs($a['balance']) >= 0.01)->values();
        $totalFixed = (float) $fixedAssets->sum('balance');

        // Other current: cash, banks, inventory, input VAT, etc.
        $otherCurrentAssets = $assets
            ->reject(fn ($a) => in_array($a['code'], array_merge($arCodes, $fixedCodes)))
            ->filter(fn ($a) => abs($a['balance']) >= 0.01)->values();
        $totalOtherCurrent = (float) $otherCurrentAssets->sum('balance');

        $totalCurrentAssets = $totalAR + $totalOtherCurrent;
        $totalAssets        = $totalCurrentAssets + $totalFixed;

        // ── Group liabilities ──
        $currentLiabilityCodes  = ['2010', '2020', '2100', '2110'];
        $currentLiabilities     = $liabilities->filter(fn ($a) => in_array($a['code'], $currentLiabilityCodes))
            ->filter(fn ($a) => abs($a['balance']) >= 0.01)->values();
        $totalCurrentLiabilities = (float) $currentLiabilities->sum('balance');

        $nonCurrentLiabilities      = $liabilities->reject(fn ($a) => in_array($a['code'], $currentLiabilityCodes))
            ->filter(fn ($a) => abs($a['balance']) >= 0.01)->values();
        $totalNonCurrentLiabilities = (float) $nonCurrentLiabilities->sum('balance');
        $totalLiabilities           = $totalCurrentLiabilities + $totalNonCurrentLiabilities;

        // ── Equity ──
        $equityAccounts      = $equity->filter(fn ($a) => abs($a['balance']) >= 0.01)->values();
        $totalEquityAccounts = (float) $equityAccounts->sum('balance');

        // ── Net Income (Revenue − Expenses through as-of date) ──
        $totalRevenue = (float) JournalLine::whereHas('account', fn ($q) => $q->where('type', 'revenue'))
            ->whereHas('journalEntry', fn ($q) => $q->whereDate('date', '<=', $asOf))
            ->sum(DB::raw('credit - debit'));

        $totalExpenses = (float) JournalLine::whereHas('account', fn ($q) => $q->where('type', 'expense'))
            ->whereHas('journalEntry', fn ($q) => $q->whereDate('date', '<=', $asOf))
            ->sum(DB::raw('debit - credit'));

        $netIncome   = $totalRevenue - $totalExpenses;
        $totalEquity = $totalEquityAccounts + $netIncome;

        return [
            'as_of_date'                    => $asOf,
            'accounts_receivable'           => $accountsReceivable,
            'total_accounts_receivable'     => $totalAR,
            'other_current_assets'          => $otherCurrentAssets,
            'total_other_current'           => $totalOtherCurrent,
            'total_current_assets'          => $totalCurrentAssets,
            'fixed_assets'                  => $fixedAssets,
            'total_fixed_assets'            => $totalFixed,
            'total_assets'                  => $totalAssets,
            'current_liabilities'           => $currentLiabilities,
            'total_current_liabilities'     => $totalCurrentLiabilities,
            'non_current_liabilities'       => $nonCurrentLiabilities,
            'total_non_current_liabilities' => $totalNonCurrentLiabilities,
            'total_liabilities'             => $totalLiabilities,
            'equity_accounts'               => $equityAccounts,
            'total_equity_accounts'         => $totalEquityAccounts,
            'net_income'                    => $netIncome,
            'total_equity'                  => $totalEquity,
            'total_liabilities_equity'      => $totalLiabilities + $totalEquity,
        ];
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
        $revenueSales   = $netAccount('4010', 'credit_minus_debit');  // Sales (NON-VAT)
        $revenueVatable = $netAccount('4020', 'credit_minus_debit');  // Sales (VATable)
        $revenue        = $revenueSales + $revenueVatable;
        $cogs      = $netAccount('5010', 'debit_minus_credit')   // COGS VATable
                   + $netAccount('5011', 'debit_minus_credit')   // COGS NonVATable
                   + $netAccount('5060', 'debit_minus_credit');   // Cost of Sales
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

    // ── PDF REPORT ENDPOINTS ──

    public function incomeStatementPdf(Request $request): Response
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date'   => 'required|date|after_or_equal:start_date',
        ]);

        $data = $this->buildIncomeStatement($request->start_date, $request->end_date);

        $pdf = Pdf::loadView('reports.income-statement', $data);
        $pdf->setPaper('A4', 'portrait');
        $pdf->setOptions(['enable_php' => true]);

        $filename = "income-statement-{$request->start_date}-to-{$request->end_date}.pdf";

        return $pdf->download($filename);
    }

    public function balanceSheetPdf(Request $request): Response
    {
        $request->validate([
            'as_of_date' => 'required|date',
        ]);

        $data = $this->buildBalanceSheet($request->as_of_date);

        $pdf = Pdf::loadView('reports.balance-sheet', $data);
        $pdf->setPaper('A4', 'portrait');
        $pdf->setOptions(['enable_php' => true]);

        $filename = "balance-sheet-as-of-{$request->as_of_date}.pdf";

        return $pdf->download($filename);
    }

    /**
     * Generate income statement PDF from user-submitted (possibly edited) data.
     */
    public function incomeStatementPdfFromData(Request $request): Response
    {
        $data = $request->validate([
            'period'                          => 'required|array',
            'period.start'                    => 'required|date',
            'period.end'                      => 'required|date',
            'income'                          => 'present|array|max:100',
            'income.*.name'                   => 'required|string|max:255',
            'income.*.amount'                 => 'required|numeric',
            'total_income'                    => 'required|numeric',
            'cost_of_sales'                   => 'present|array|max:100',
            'cost_of_sales.*.name'            => 'required|string|max:255',
            'cost_of_sales.*.amount'          => 'required|numeric',
            'total_cost_of_sales'             => 'required|numeric',
            'gross_profit'                    => 'required|numeric',
            'other_expense_accounts'          => 'present|array|max:100',
            'other_expense_accounts.*.name'   => 'required|string|max:255',
            'other_expense_accounts.*.amount' => 'required|numeric',
            'total_other_expenses'            => 'required|numeric',
            'net_income'                      => 'required|numeric',
        ]);

        $pdf = Pdf::loadView('reports.income-statement', $data);
        $pdf->setPaper('A4', 'portrait');
        $pdf->setOptions(['enable_php' => true]);

        $filename = "income-statement-{$data['period']['start']}-to-{$data['period']['end']}.pdf";

        return $pdf->download($filename);
    }

    /**
     * Generate balance sheet PDF from user-submitted (possibly edited) data.
     */
    public function balanceSheetPdfFromData(Request $request): Response
    {
        $data = $request->validate([
            'as_of_date'                            => 'required|date',
            'accounts_receivable'                   => 'present|array|max:50',
            'accounts_receivable.*.name'            => 'required|string|max:255',
            'accounts_receivable.*.balance'         => 'required|numeric',
            'total_accounts_receivable'             => 'required|numeric',
            'other_current_assets'                  => 'present|array|max:50',
            'other_current_assets.*.name'           => 'required|string|max:255',
            'other_current_assets.*.balance'        => 'required|numeric',
            'total_current_assets'                  => 'required|numeric',
            'fixed_assets'                          => 'present|array|max:50',
            'fixed_assets.*.name'                   => 'required|string|max:255',
            'fixed_assets.*.balance'                => 'required|numeric',
            'total_fixed_assets'                    => 'required|numeric',
            'total_assets'                          => 'required|numeric',
            'current_liabilities'                   => 'present|array|max:50',
            'current_liabilities.*.name'            => 'required|string|max:255',
            'current_liabilities.*.balance'         => 'required|numeric',
            'total_current_liabilities'             => 'required|numeric',
            'non_current_liabilities'               => 'present|array|max:50',
            'non_current_liabilities.*.name'        => 'required|string|max:255',
            'non_current_liabilities.*.balance'     => 'required|numeric',
            'total_non_current_liabilities'         => 'required|numeric',
            'total_liabilities'                     => 'required|numeric',
            'equity_accounts'                       => 'present|array|max:50',
            'equity_accounts.*.name'                => 'required|string|max:255',
            'equity_accounts.*.balance'             => 'required|numeric',
            'net_income'                            => 'required|numeric',
            'total_equity'                          => 'required|numeric',
            'total_liabilities_equity'              => 'required|numeric',
        ]);

        $pdf = Pdf::loadView('reports.balance-sheet', $data);
        $pdf->setPaper('A4', 'portrait');
        $pdf->setOptions(['enable_php' => true]);

        return $pdf->download("balance-sheet-as-of-{$data['as_of_date']}.pdf");
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
        $pdf->setOptions(['enable_php' => true]);

        $slug     = preg_replace('/[^a-z0-9]+/i', '-', strtolower($client->business_name));
        $filename = "statement-{$slug}-{$start}-to-{$end}.pdf";

        return $pdf->download($filename);
    }
}
