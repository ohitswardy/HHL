<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Expense\StoreExpenseRequest;
use App\Http\Requests\Expense\UpdateExpenseRequest;
use App\Http\Resources\ExpenseCategoryResource;
use App\Http\Resources\ExpenseResource;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Services\ExpenseService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;


class ExpenseController extends Controller
{
    public function __construct(
        private ExpenseService $expenseService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Expense::with(['category', 'supplier', 'user', 'purchaseOrder']);

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($categoryId = $request->get('expense_category_id')) {
            $query->where('expense_category_id', $categoryId);
        }

        if ($supplierId = $request->get('supplier_id')) {
            $query->where('supplier_id', $supplierId);
        }

        if ($from = $request->get('from')) {
            $query->whereDate('date', '>=', $from);
        }

        if ($to = $request->get('to')) {
            $query->whereDate('date', '<=', $to);
        }

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('payee', 'like', "%{$search}%")
                    ->orWhere('expense_number', 'like', "%{$search}%")
                    ->orWhere('reference_number', 'like', "%{$search}%");
            });
        }

        $expenses = $query->orderByDesc('date')->orderByDesc('id')
            ->paginate($request->get('per_page', 20));

        return response()->json([
            'data' => ExpenseResource::collection($expenses),
            'meta' => [
                'current_page' => $expenses->currentPage(),
                'last_page' => $expenses->lastPage(),
                'per_page' => $expenses->perPage(),
                'total' => $expenses->total(),
            ],
        ]);
    }

    public function store(StoreExpenseRequest $request): JsonResponse
    {
        $expense = $this->expenseService->createExpense($request->validated());
        $expense->load(['category', 'supplier', 'user', 'purchaseOrder']);

        return response()->json(['data' => new ExpenseResource($expense)], 201);
    }

    public function show(Expense $expense): JsonResponse
    {
        $expense->load(['category', 'supplier', 'user', 'purchaseOrder']);
        return response()->json(['data' => new ExpenseResource($expense)]);
    }

    public function update(UpdateExpenseRequest $request, Expense $expense): JsonResponse
    {
        if ($expense->status === 'voided') {
            return response()->json(['message' => 'Cannot update a voided expense.'], 422);
        }

        $this->expenseService->updateExpense($expense, $request->validated());

        $expense->refresh();
        $expense->load(['category', 'supplier', 'user', 'purchaseOrder']);
        return response()->json(['data' => new ExpenseResource($expense)]);
    }

    public function confirm(UpdateExpenseRequest $request, Expense $expense): JsonResponse
    {
        if ($expense->status !== 'draft') {
            return response()->json(['message' => 'Only draft expenses can be confirmed.'], 422);
        }

        $this->expenseService->confirmExpense($expense, $request->validated());

        $expense->refresh();
        $expense->load(['category', 'supplier', 'user', 'purchaseOrder']);
        return response()->json(['data' => new ExpenseResource($expense)]);
    }

    public function syncFromPos(): JsonResponse
    {
        $result = $this->expenseService->syncFromPurchaseOrders();
        $created   = $result['created'];
        $confirmed = $result['confirmed'];

        $parts = [];
        if ($created > 0)   $parts[] = "{$created} expense draft(s) imported";
        if ($confirmed > 0) $parts[] = "{$confirmed} draft(s) auto-confirmed";
        $message = $parts ? implode(', ', $parts) . '.' : 'No changes — everything is up to date.';

        return response()->json([
            'message'   => $message,
            'count'     => $created,
            'created'   => $created,
            'confirmed' => $confirmed,
        ]);
    }

    public function void(Expense $expense): JsonResponse
    {
        if (in_array($expense->status, ['voided', 'draft'])) {
            return response()->json(['message' => 'Cannot void this expense.'], 422);
        }

        $this->expenseService->voidExpense($expense);
        $expense->refresh();
        $expense->load(['category', 'supplier', 'user', 'purchaseOrder']);

        return response()->json(['data' => new ExpenseResource($expense)]);
    }

    public function categories(): JsonResponse
    {
        $categories = ExpenseCategory::where('is_active', true)
            ->orderBy('name')
            ->get();

        return response()->json(['data' => ExpenseCategoryResource::collection($categories)]);
    }

    public function exportPdf(Request $request): \Illuminate\Http\Response
    {
        $expenses = $this->buildExpenseQuery($request)
            ->with(['category', 'supplier', 'user', 'purchaseOrder'])
            ->orderByDesc('date')->orderByDesc('id')
            ->get();

        $categoryName = null;
        if ($catId = $request->get('expense_category_id')) {
            $categoryName = ExpenseCategory::find((int) $catId)?->name;
        }

        $totals = [
            'total_amount'   => (float) $expenses->sum('total_amount'),
            'subtotal'       => (float) $expenses->sum('subtotal'),
            'tax_amount'     => (float) $expenses->sum('tax_amount'),
            'recorded_count' => $expenses->where('status', 'recorded')->count(),
            'draft_count'    => $expenses->where('status', 'draft')->count(),
            'voided_count'   => $expenses->where('status', 'voided')->count(),
        ];

        $pdf = Pdf::loadView('exports.expenses', [
            'expenses'    => $expenses,
            'totals'      => $totals,
            'generatedAt' => now(),
            'columns'     => $request->has('columns') ? (array) $request->input('columns') : null,
            'filters'     => [
                'from'     => $request->get('from'),
                'to'       => $request->get('to'),
                'status'   => $request->get('status'),
                'search'   => $request->get('search'),
                'category' => $categoryName,
            ],
        ])->setOptions([
            'enable_php'           => true,
            'isHtml5ParserEnabled' => true,
            'isRemoteEnabled'      => false,
            'defaultFont'          => 'DejaVu Sans',
            'dpi'                  => 150,
        ])->setPaper('a4', 'landscape');

        return $pdf->download('expenses-' . now()->format('Y-m-d') . '.pdf');
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        $expenses = $this->buildExpenseQuery($request)
            ->with(['category', 'supplier', 'user', 'purchaseOrder'])
            ->orderByDesc('date')->orderByDesc('id')
            ->get();

        $filename = 'expenses-' . now()->format('Y-m-d') . '.csv';
        $selectedCols = $request->has('columns') ? (array) $request->input('columns') : null;

        $allCols = [
            'expense_number'    => ['header' => 'Expense #',         'value' => fn($e) => $e->expense_number],
            'date'              => ['header' => 'Date',               'value' => fn($e) => $e->date?->toDateString()],
            'payee'             => ['header' => 'Payee',              'value' => fn($e) => $e->payee],
            'supplier'          => ['header' => 'Supplier',           'value' => fn($e) => $e->supplier?->name ?? ''],
            'category'          => ['header' => 'Category',           'value' => fn($e) => $e->category?->name ?? ''],
            'account_code'      => ['header' => 'Account Code',       'value' => fn($e) => $e->category?->account_code ?? ''],
            'reference_number'  => ['header' => 'Reference No.',      'value' => fn($e) => $e->reference_number ?? ''],
            'source'            => ['header' => 'Source',             'value' => fn($e) => $e->source],
            'po_number'         => ['header' => 'Linked PO Number',   'value' => fn($e) => $e->purchaseOrder?->po_number ?? ''],
            'subtotal'          => ['header' => 'Subtotal',           'value' => fn($e) => number_format((float) $e->subtotal, 2, '.', '')],
            'tax_amount'        => ['header' => 'VAT / Tax',          'value' => fn($e) => number_format((float) $e->tax_amount, 2, '.', '')],
            'total_amount'      => ['header' => 'Total Amount',       'value' => fn($e) => number_format((float) $e->total_amount, 2, '.', '')],
            'notes'             => ['header' => 'Notes',              'value' => fn($e) => $e->notes ?? ''],
            'status'            => ['header' => 'Status',             'value' => fn($e) => $e->status],
            'recorded_by'       => ['header' => 'Recorded By',        'value' => fn($e) => $e->user?->name ?? ''],
            'created_at'        => ['header' => 'Created At',         'value' => fn($e) => $e->created_at?->toDateTimeString()],
        ];
        $orderedKeys = ['expense_number','date','payee','supplier','category','account_code','reference_number','source','po_number','subtotal','tax_amount','total_amount','notes','status','recorded_by','created_at'];
        $activeCols = array_filter(
            array_intersect_key($allCols, array_flip($orderedKeys)),
            fn($key) => $selectedCols === null || in_array($key, $selectedCols),
            ARRAY_FILTER_USE_KEY
        );

        return response()->streamDownload(function () use ($expenses, $activeCols) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, array_column($activeCols, 'header'));
            foreach ($expenses as $expense) {
                fputcsv($handle, array_map(fn($col) => ($col['value'])($expense), $activeCols));
            }
            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function buildExpenseQuery(Request $request): \Illuminate\Database\Eloquent\Builder
    {
        $query = Expense::query();

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }
        if ($categoryId = $request->get('expense_category_id')) {
            $query->where('expense_category_id', $categoryId);
        }
        if ($supplierId = $request->get('supplier_id')) {
            $query->where('supplier_id', $supplierId);
        }
        if ($from = $request->get('from')) {
            $query->whereDate('date', '>=', $from);
        }
        if ($to = $request->get('to')) {
            $query->whereDate('date', '<=', $to);
        }
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('payee', 'like', "%{$search}%")
                    ->orWhere('expense_number', 'like', "%{$search}%")
                    ->orWhere('reference_number', 'like', "%{$search}%");
            });
        }

        return $query;
    }

    public function summary(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $start = $request->start_date;
        $end = $request->end_date;

        $query = Expense::where('status', 'recorded')
            ->whereBetween('date', [$start, $end]);

        $totalExpenses = (float) (clone $query)->sum('total_amount');
        $totalSubtotal = (float) (clone $query)->sum('subtotal');
        $totalTax = (float) (clone $query)->sum('tax_amount');
        $expenseCount = (clone $query)->count();

        $byCategory = (clone $query)
            ->select('expense_category_id', DB::raw('SUM(total_amount) as total'), DB::raw('COUNT(*) as count'))
            ->groupBy('expense_category_id')
            ->with('category')
            ->get()
            ->map(fn ($row) => [
                'category_id' => $row->expense_category_id,
                'category_name' => $row->category->name ?? 'Unknown',
                'total' => (float) $row->total,
                'count' => (int) $row->count,
            ])
            ->values();

        $byPayee = (clone $query)
            ->select('payee', DB::raw('SUM(total_amount) as total'), DB::raw('COUNT(*) as count'))
            ->groupBy('payee')
            ->orderByDesc('total')
            ->limit(10)
            ->get()
            ->map(fn ($row) => [
                'payee' => $row->payee,
                'total' => (float) $row->total,
                'count' => (int) $row->count,
            ])
            ->values();

        return response()->json([
            'period' => ['start' => $start, 'end' => $end],
            'total_expenses' => $totalExpenses,
            'total_subtotal' => $totalSubtotal,
            'total_tax' => $totalTax,
            'expense_count' => $expenseCount,
            'by_category' => $byCategory,
            'top_payees' => $byPayee,
        ]);
    }
}
