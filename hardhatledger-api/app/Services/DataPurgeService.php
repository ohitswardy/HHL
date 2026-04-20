<?php

namespace App\Services;

use App\Models\DataPurgeLog;
use App\Models\Expense;
use App\Models\JournalEntry;
use App\Models\JournalLine;
use App\Models\Payment;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\SaleItem;
use App\Models\SalesTransaction;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class DataPurgeService
{
    /**
     * Get a preview of records that would be purged for a given month.
     */
    public function preview(int $year, int $month): array
    {
        $startDate = Carbon::create($year, $month, 1)->startOfMonth();
        $endDate = $startDate->copy()->endOfMonth();

        $salesCount = SalesTransaction::withTrashed()
            ->whereBetween('created_at', [$startDate, $endDate])
            ->count();

        $saleItemsCount = SaleItem::whereHas('salesTransaction', function ($q) use ($startDate, $endDate) {
            $q->withTrashed()->whereBetween('created_at', [$startDate, $endDate]);
        })->count();

        $paymentsCount = Payment::whereHas('salesTransaction', function ($q) use ($startDate, $endDate) {
            $q->withTrashed()->whereBetween('created_at', [$startDate, $endDate]);
        })->count();

        $purchaseOrdersCount = PurchaseOrder::withTrashed()
            ->whereBetween('created_at', [$startDate, $endDate])
            ->count();

        $poItemsCount = PurchaseOrderItem::whereHas('purchaseOrder', function ($q) use ($startDate, $endDate) {
            $q->withTrashed()->whereBetween('created_at', [$startDate, $endDate]);
        })->count();

        $journalEntriesCount = JournalEntry::withTrashed()
            ->whereBetween('created_at', [$startDate, $endDate])
            ->count();

        $journalLinesCount = JournalLine::whereHas('journalEntry', function ($q) use ($startDate, $endDate) {
            $q->withTrashed()->whereBetween('created_at', [$startDate, $endDate]);
        })->count();

        $expensesCount = Expense::withTrashed()
            ->whereBetween('created_at', [$startDate, $endDate])
            ->count();

        return [
            'year' => $year,
            'month' => $month,
            'month_label' => $startDate->format('F Y'),
            'sales_transactions' => $salesCount,
            'sale_items' => $saleItemsCount,
            'payments' => $paymentsCount,
            'purchase_orders' => $purchaseOrdersCount,
            'po_items' => $poItemsCount,
            'journal_entries' => $journalEntriesCount,
            'journal_lines' => $journalLinesCount,
            'expenses' => $expensesCount,
            'total_records' => $salesCount + $saleItemsCount + $paymentsCount
                + $purchaseOrdersCount + $poItemsCount
                + $journalEntriesCount + $journalLinesCount
                + $expensesCount,
        ];
    }

    /**
     * Execute the purge for a given month. Returns the purge log record.
     */
    public function execute(int $year, int $month, int $userId, ?string $notes = null): DataPurgeLog
    {
        $startDate = Carbon::create($year, $month, 1)->startOfMonth();
        $endDate = $startDate->copy()->endOfMonth();

        return DB::transaction(function () use ($startDate, $endDate, $year, $month, $userId, $notes) {
            // 1. Purge Sale Items + Payments (children first)
            $salesIds = SalesTransaction::withTrashed()
                ->whereBetween('created_at', [$startDate, $endDate])
                ->pluck('id');

            $saleItemsDeleted = SaleItem::whereIn('sales_transaction_id', $salesIds)->delete();
            $paymentsDeleted = Payment::whereIn('sales_transaction_id', $salesIds)->delete();

            // 2. Purge Sales Transactions (force delete to bypass soft delete)
            $salesDeleted = SalesTransaction::withTrashed()
                ->whereBetween('created_at', [$startDate, $endDate])
                ->forceDelete();

            // 3. Purge PO Items (children first)
            $poIds = PurchaseOrder::withTrashed()
                ->whereBetween('created_at', [$startDate, $endDate])
                ->pluck('id');

            $poItemsDeleted = PurchaseOrderItem::whereIn('purchase_order_id', $poIds)->delete();

            // 4. Purge Purchase Orders (force delete)
            $posDeleted = PurchaseOrder::withTrashed()
                ->whereBetween('created_at', [$startDate, $endDate])
                ->forceDelete();

            // 5. Purge Journal Lines (children first)
            $journalIds = JournalEntry::withTrashed()
                ->whereBetween('created_at', [$startDate, $endDate])
                ->pluck('id');

            $journalLinesDeleted = JournalLine::whereIn('journal_entry_id', $journalIds)->delete();

            // 6. Purge Journal Entries (force delete)
            $journalEntriesDeleted = JournalEntry::withTrashed()
                ->whereBetween('created_at', [$startDate, $endDate])
                ->forceDelete();

            // 7. Purge Expenses (force delete)
            $expensesDeleted = Expense::withTrashed()
                ->whereBetween('created_at', [$startDate, $endDate])
                ->forceDelete();

            // 8. Log the purge
            return DataPurgeLog::create([
                'user_id' => $userId,
                'purge_year' => $year,
                'purge_month' => $month,
                'sales_purged' => $salesDeleted,
                'sale_items_purged' => $saleItemsDeleted,
                'payments_purged' => $paymentsDeleted,
                'purchase_orders_purged' => $posDeleted,
                'po_items_purged' => $poItemsDeleted,
                'journal_entries_purged' => $journalEntriesDeleted,
                'journal_lines_purged' => $journalLinesDeleted,
                'expenses_purged' => $expensesDeleted,
                'status' => 'completed',
                'notes' => $notes,
            ]);
        });
    }

    /**
     * Get eligible months for purging (at least 1 month old).
     */
    public function getEligibleMonths(): array
    {
        $months = [];
        $now = Carbon::now();

        // Go back from 1 month ago up to 24 months total
        for ($i = 1; $i <= 24; $i++) {
            $date = $now->copy()->subMonths($i)->startOfMonth();
            $months[] = [
                'year' => $date->year,
                'month' => $date->month,
                'label' => $date->format('F Y'),
            ];
        }

        return $months;
    }

    /**
     * Check if a month has already been purged.
     */
    public function isAlreadyPurged(int $year, int $month): bool
    {
        return DataPurgeLog::where('purge_year', $year)
            ->where('purge_month', $month)
            ->where('status', 'completed')
            ->exists();
    }
}
