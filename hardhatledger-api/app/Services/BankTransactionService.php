<?php

namespace App\Services;

use App\Models\Expense;
use App\Models\Payment;
use App\Models\PurchaseOrder;
use Illuminate\Support\Collection;

class BankTransactionService
{
    /**
     * Gather all business bank transactions (deposits + payments) for financial tracking.
     *
     * Deposits  = Sales payments made via 'business_bank'
     * Payments  = Expenses + Purchase Orders paid via 'business_bank'
     *
     * Returns a sorted collection of unified transaction rows.
     */
    public function getTransactions(?string $from = null, ?string $to = null, ?string $search = null): Collection
    {
        $rows = collect();

        // ── DEPOSITS: Sales payments via business_bank ──
        $paymentsQuery = Payment::where('payment_method', 'business_bank')
            ->where('status', 'confirmed')
            ->with(['salesTransaction.client']);

        if ($from) $paymentsQuery->whereDate('paid_at', '>=', $from);
        if ($to) $paymentsQuery->whereDate('paid_at', '<=', $to);

        if ($search) {
            $paymentsQuery->where(function ($q) use ($search) {
                $q->whereHas('salesTransaction', fn ($sq) =>
                    $sq->where('transaction_number', 'like', "%{$search}%")
                        ->orWhereHas('client', fn ($cq) => $cq->where('business_name', 'like', "%{$search}%"))
                );
            });
        }

        foreach ($paymentsQuery->get() as $payment) {
            $sale = $payment->salesTransaction;
            $rows->push([
                'id'             => 'PAY-' . $payment->id,
                'date'           => $payment->paid_at?->toDateString() ?? $payment->created_at->toDateString(),
                'ref_no'         => $sale?->transaction_number ?? '-',
                'type'           => 'Deposit',
                'payee_account'  => $sale?->client?->business_name ?? 'Walk-in',
                'memo'           => $sale ? "Sale {$sale->transaction_number}" : 'Sales deposit',
                'payment_amount' => 0,
                'deposit_amount' => (float) $payment->amount,
                'tax'            => (float) ($sale?->tax_amount ?? 0),
                'source_type'    => 'sale',
                'source_id'      => $sale?->id,
            ]);
        }

        // ── PAYMENTS OUT: Expenses paid via business_bank ──
        $expensesQuery = Expense::where('payment_method', 'business_bank')
            ->whereIn('status', ['recorded', 'draft'])
            ->with(['category', 'supplier']);

        if ($from) $expensesQuery->whereDate('date', '>=', $from);
        if ($to) $expensesQuery->whereDate('date', '<=', $to);

        if ($search) {
            $expensesQuery->where(function ($q) use ($search) {
                $q->where('payee', 'like', "%{$search}%")
                    ->orWhere('expense_number', 'like', "%{$search}%");
            });
        }

        foreach ($expensesQuery->get() as $expense) {
            $rows->push([
                'id'             => 'EXP-' . $expense->id,
                'date'           => $expense->date->toDateString(),
                'ref_no'         => $expense->expense_number,
                'type'           => 'Expense',
                'payee_account'  => $expense->payee,
                'memo'           => $expense->notes ?? ($expense->category?->name ?? 'Expense'),
                'payment_amount' => (float) $expense->total_amount,
                'deposit_amount' => 0,
                'tax'            => (float) $expense->tax_amount,
                'source_type'    => 'expense',
                'source_id'      => $expense->id,
            ]);
        }

        // ── PAYMENTS OUT: Purchase Orders paid via business_bank ──
        $posQuery = PurchaseOrder::where('payment_method', 'business_bank')
            ->where('status', 'received')
            ->with('supplier');

        if ($from) $posQuery->whereDate('received_date', '>=', $from);
        if ($to) $posQuery->whereDate('received_date', '<=', $to);

        if ($search) {
            $posQuery->where(function ($q) use ($search) {
                $q->where('po_number', 'like', "%{$search}%")
                    ->orWhereHas('supplier', fn ($sq) => $sq->where('name', 'like', "%{$search}%"));
            });
        }

        foreach ($posQuery->get() as $po) {
            $rows->push([
                'id'             => 'PO-' . $po->id,
                'date'           => ($po->received_date ?? $po->created_at)->toDateString(),
                'ref_no'         => $po->po_number,
                'type'           => 'Purchase Order',
                'payee_account'  => $po->supplier?->name ?? 'Unknown Supplier',
                'memo'           => $po->notes ?? "PO {$po->po_number}",
                'payment_amount' => (float) $po->total_amount,
                'deposit_amount' => 0,
                'tax'            => 0,
                'source_type'    => 'purchase_order',
                'source_id'      => $po->id,
            ]);
        }

        // Sort by date ascending, then apply running balance
        $sorted = $rows->sortBy('date')->values();

        $runningBalance = 0;
        return $sorted->map(function ($row) use (&$runningBalance) {
            $runningBalance += $row['deposit_amount'] - $row['payment_amount'];
            $row['balance'] = round($runningBalance, 2);
            return $row;
        });
    }
}
