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
     *
     * Deletes are chunked in batches of 500 rows to prevent long-held table
     * locks on busy months (P6).
     */
    public function execute(int $year, int $month, int $userId, ?string $notes = null): DataPurgeLog
    {
        $startDate = Carbon::create($year, $month, 1)->startOfMonth();
        $endDate = $startDate->copy()->endOfMonth();

        return DB::transaction(function () use ($startDate, $endDate, $year, $month, $userId, $notes) {
            $chunkSize = 500;

            // 1. Collect sale IDs, then purge children in chunks
            $salesIds = SalesTransaction::withTrashed()
                ->whereBetween('created_at', [$startDate, $endDate])
                ->pluck('id');

            $saleItemsDeleted = 0;
            foreach ($salesIds->chunk($chunkSize) as $chunk) {
                $saleItemsDeleted += SaleItem::whereIn('sales_transaction_id', $chunk)->delete();
            }

            $paymentsDeleted = 0;
            foreach ($salesIds->chunk($chunkSize) as $chunk) {
                $paymentsDeleted += Payment::whereIn('sales_transaction_id', $chunk)->delete();
            }

            // 2. Purge Sales Transactions in chunks (force delete bypasses soft delete)
            $salesDeleted = 0;
            SalesTransaction::withTrashed()
                ->whereBetween('created_at', [$startDate, $endDate])
                ->select('id')
                ->chunkById($chunkSize, function ($rows) use (&$salesDeleted) {
                    $salesDeleted += SalesTransaction::withTrashed()
                        ->whereIn('id', $rows->pluck('id'))
                        ->forceDelete();
                });

            // 3. Collect PO IDs, then purge children in chunks
            $poIds = PurchaseOrder::withTrashed()
                ->whereBetween('created_at', [$startDate, $endDate])
                ->pluck('id');

            $poItemsDeleted = 0;
            foreach ($poIds->chunk($chunkSize) as $chunk) {
                $poItemsDeleted += PurchaseOrderItem::whereIn('purchase_order_id', $chunk)->delete();
            }

            // 4. Purge Purchase Orders in chunks
            $posDeleted = 0;
            PurchaseOrder::withTrashed()
                ->whereBetween('created_at', [$startDate, $endDate])
                ->select('id')
                ->chunkById($chunkSize, function ($rows) use (&$posDeleted) {
                    $posDeleted += PurchaseOrder::withTrashed()
                        ->whereIn('id', $rows->pluck('id'))
                        ->forceDelete();
                });

            // 5. Collect journal entry IDs, purge lines in chunks
            $journalIds = JournalEntry::withTrashed()
                ->whereBetween('created_at', [$startDate, $endDate])
                ->pluck('id');

            $journalLinesDeleted = 0;
            foreach ($journalIds->chunk($chunkSize) as $chunk) {
                $journalLinesDeleted += JournalLine::whereIn('journal_entry_id', $chunk)->delete();
            }

            // 6. Purge Journal Entries in chunks
            $journalEntriesDeleted = 0;
            JournalEntry::withTrashed()
                ->whereBetween('created_at', [$startDate, $endDate])
                ->select('id')
                ->chunkById($chunkSize, function ($rows) use (&$journalEntriesDeleted) {
                    $journalEntriesDeleted += JournalEntry::withTrashed()
                        ->whereIn('id', $rows->pluck('id'))
                        ->forceDelete();
                });

            // 7. Purge Expenses in chunks
            $expensesDeleted = 0;
            Expense::withTrashed()
                ->whereBetween('created_at', [$startDate, $endDate])
                ->select('id')
                ->chunkById($chunkSize, function ($rows) use (&$expensesDeleted) {
                    $expensesDeleted += Expense::withTrashed()
                        ->whereIn('id', $rows->pluck('id'))
                        ->forceDelete();
                });

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
