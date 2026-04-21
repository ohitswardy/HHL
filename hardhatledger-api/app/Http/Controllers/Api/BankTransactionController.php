<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BankTransactionService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BankTransactionController extends Controller
{
    public function __construct(
        private BankTransactionService $bankTransactionService,
    ) {}

    /**
     * GET /api/v1/accounting/bank-transactions
     * Returns all business bank transactions with running balance.
     */
    public function index(Request $request): JsonResponse
    {
        $transactions = $this->bankTransactionService->getTransactions(
            from: $request->get('from'),
            to: $request->get('to'),
            search: $request->get('search'),
        );

        $totalDeposits = $transactions->sum('deposit_amount');
        $totalPayments = $transactions->sum('payment_amount');
        $totalTax      = $transactions->sum('tax');
        $netBalance    = round($totalDeposits - $totalPayments, 2);

        return response()->json([
            'data' => $transactions->values(),
            'summary' => [
                'total_deposits' => $totalDeposits,
                'total_payments' => $totalPayments,
                'total_tax'      => $totalTax,
                'net_balance'    => $netBalance,
                'count'          => $transactions->count(),
            ],
        ]);
    }

    /**
     * POST /api/v1/accounting/bank-transactions/export/pdf
     * Generate PDF from (optionally edited) transaction data.
     * Accepts the full transactions array in the request body so the user
     * can edit memos/notes before exporting.
     */
    public function exportPdf(Request $request): \Illuminate\Http\Response
    {
        $request->validate([
            'from'         => ['nullable', 'date'],
            'to'           => ['nullable', 'date'],
            'transactions' => ['nullable', 'array'],
            'transactions.*.date'           => ['required', 'date'],
            'transactions.*.ref_no'         => ['required', 'string'],
            'transactions.*.type'           => ['required', 'string'],
            'transactions.*.payee_account'  => ['required', 'string'],
            'transactions.*.memo'           => ['nullable', 'string'],
            'transactions.*.additional_notes' => ['nullable', 'string'],
            'transactions.*.payment_amount' => ['required', 'numeric'],
            'transactions.*.deposit_amount' => ['required', 'numeric'],
            'transactions.*.tax'            => ['required', 'numeric'],
            'transactions.*.balance'        => ['required', 'numeric'],
        ]);

        // If edited data is provided, use it; otherwise pull fresh with all filters
        if ($request->has('transactions') && count($request->transactions) > 0) {
            $transactions = collect($request->transactions);
        } else {
            $transactions = $this->bankTransactionService->getTransactions(
                from:   $request->get('from'),
                to:     $request->get('to'),
                search: $request->get('search'),
            );
        }

        $totalDeposits = $transactions->sum('deposit_amount');
        $totalPayments = $transactions->sum('payment_amount');
        $totalTax      = $transactions->sum('tax');
        $netBalance    = round($totalDeposits - $totalPayments, 2);

        $pdf = Pdf::loadView('reports.bank-transactions', [
            'transactions'  => $transactions,
            'generatedAt'   => now(),
            'columns'       => $request->has('columns') ? (array) $request->input('columns') : null,
            'filters'       => [
                'from'   => $request->get('from'),
                'to'     => $request->get('to'),
                'search' => $request->get('search'),
            ],
            'totals' => [
                'total_deposits' => $totalDeposits,
                'total_payments' => $totalPayments,
                'total_tax'      => $totalTax,
                'net_balance'    => $netBalance,
            ],
        ])->setOptions([
            'enable_php' => false,
            'isHtml5ParserEnabled' => true,
            'isRemoteEnabled'      => false,
            'defaultFont'          => 'DejaVu Sans',
            'dpi'                  => 150,
        ])->setPaper('a4', 'landscape');

        return $pdf->download('bank-transactions-' . now()->format('Y-m-d') . '.pdf');
    }

    /**
     * POST /api/v1/accounting/bank-transactions/export/csv
     * Generate CSV from (optionally edited) transaction data.
     */
    public function exportCsv(Request $request): StreamedResponse
    {
        // If edited data is provided, use it; otherwise pull fresh
        if ($request->has('transactions') && is_array($request->transactions) && count($request->transactions) > 0) {
            $transactions = collect($request->transactions);
        } else {
            $transactions = $this->bankTransactionService->getTransactions(
                from:   $request->get('from'),
                to:     $request->get('to'),
                search: $request->get('search'),
            );
        }

        $filename = 'bank-transactions-' . now()->format('Y-m-d') . '.csv';
        $selectedCols = $request->has('columns') ? (array) $request->input('columns') : null;

        $allCols = [
            'date'             => ['header' => 'Date',              'value' => fn($t) => $t->date ?? ''],
            'ref_no'           => ['header' => 'Ref No',            'value' => fn($t) => $t->ref_no ?? ''],
            'type'             => ['header' => 'Type',              'value' => fn($t) => $t->type ?? ''],
            'payee_account'    => ['header' => 'Payee / Account',   'value' => fn($t) => $t->payee_account ?? ''],
            'memo'             => ['header' => 'Memo',              'value' => fn($t) => $t->memo ?? ''],
            'additional_notes' => ['header' => 'Additional Notes',  'value' => fn($t) => $t->additional_notes ?? ''],
            'payment'          => ['header' => 'Payment (₱)',     'value' => fn($t) => number_format((float) ($t->payment_amount ?? 0), 2, '.', '')],
            'deposit'          => ['header' => 'Deposit (₱)',     'value' => fn($t) => number_format((float) ($t->deposit_amount ?? 0), 2, '.', '')],
            'tax'              => ['header' => 'Tax (₱)',          'value' => fn($t) => number_format((float) ($t->tax ?? 0), 2, '.', '')],
            'balance'          => ['header' => 'Balance (₱)',     'value' => fn($t) => number_format((float) ($t->balance ?? 0), 2, '.', '')],
        ];
        $orderedKeys = ['date','ref_no','type','payee_account','memo','additional_notes','payment','deposit','tax','balance'];
        $activeCols = array_filter(
            array_intersect_key($allCols, array_flip($orderedKeys)),
            fn($key) => $selectedCols === null || in_array($key, $selectedCols),
            ARRAY_FILTER_USE_KEY
        );

        return response()->streamDownload(function () use ($transactions, $activeCols) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, array_merge(['#'], array_column($activeCols, 'header')));
            $i = 1;
            foreach ($transactions as $t) {
                $t = is_array($t) ? (object) $t : $t;
                fputcsv($handle, array_merge([$i++], array_map(fn($col) => ($col['value'])($t), $activeCols)));
            }
            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
