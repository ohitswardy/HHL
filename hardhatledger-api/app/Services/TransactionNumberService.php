<?php

namespace App\Services;

use App\Models\PurchaseOrder;
use App\Models\SalesTransaction;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class TransactionNumberService
{
    /**
     * Generate the next INV-YYYYMMDD-XXXX number under a row-level lock so
     * concurrent requests cannot read the same "last" value and produce a
     * duplicate (P1 / B3 race-condition fix).
     */
    public function generateSaleNumber(): string
    {
        return DB::transaction(function () {
            $today  = Carbon::today()->format('Ymd');
            $prefix = "INV-{$today}-";

            $lastTransaction = SalesTransaction::where('transaction_number', 'like', "{$prefix}%")
                ->orderByDesc('transaction_number')
                ->lockForUpdate()
                ->first();

            $nextSequence = $lastTransaction
                ? (int) substr($lastTransaction->transaction_number, -4) + 1
                : 1;

            return $prefix . str_pad($nextSequence, 4, '0', STR_PAD_LEFT);
        });
    }

    /**
     * Generate the next PO-YYYYMMDD-XXXX number under a row-level lock.
     */
    public function generatePONumber(): string
    {
        
        return DB::transaction(function () {
            $today  = Carbon::today()->format('Ymd');
            $prefix = "PO-{$today}-";

            $lastPO = PurchaseOrder::where('po_number', 'like', "{$prefix}%")
                ->orderByDesc('po_number')
                ->lockForUpdate()
                ->first();

            $nextSequence = $lastPO
                ? (int) substr($lastPO->po_number, -4) + 1
                : 1;

            return $prefix . str_pad($nextSequence, 4, '0', STR_PAD_LEFT);
        });
    }
}
