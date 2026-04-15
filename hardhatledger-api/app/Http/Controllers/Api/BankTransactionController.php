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
            'enable_php'           => true,
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

        return response()->streamDownload(function () use ($transactions) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['#', 'Date', 'Ref No', 'Type', 'Payee / Account', 'Memo', 'Additional Notes', 'Payment (₱)', 'Deposit (₱)', 'Tax (₱)', 'Balance (₱)']);
            $i = 1;
            foreach ($transactions as $t) {
                $t = is_array($t) ? (object) $t : $t;
                fputcsv($handle, [
                    $i++,
                    $t->date ?? '',
                    $t->ref_no ?? '',
                    $t->type ?? '',
                    $t->payee_account ?? '',
                    $t->memo ?? '',
                    $t->additional_notes ?? '',
                    number_format((float) ($t->payment_amount ?? 0), 2, '.', ''),
                    number_format((float) ($t->deposit_amount ?? 0), 2, '.', ''),
                    number_format((float) ($t->tax ?? 0), 2, '.', ''),
                    number_format((float) ($t->balance ?? 0), 2, '.', ''),
                ]);
            }
            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
