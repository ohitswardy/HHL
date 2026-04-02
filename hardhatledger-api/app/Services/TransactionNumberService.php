<?php

namespace App\Services;

use App\Models\PurchaseOrder;
use App\Models\SalesTransaction;
use Illuminate\Support\Carbon;

class TransactionNumberService
{
    public function generateSaleNumber(): string
    {
        $today = Carbon::today()->format('Ymd');
        $prefix = "INV-{$today}-";

        $lastTransaction = SalesTransaction::where('transaction_number', 'like', "{$prefix}%")
            ->orderByDesc('transaction_number')
            ->first();

        if ($lastTransaction) {
            $lastSequence = (int) substr($lastTransaction->transaction_number, -4);
            $nextSequence = $lastSequence + 1;
        } else {
            $nextSequence = 1;
        }

        return $prefix . str_pad($nextSequence, 4, '0', STR_PAD_LEFT);
    }

    public function generatePONumber(): string
    {
        $today = Carbon::today()->format('Ymd');
        $prefix = "PO-{$today}-";

        $lastPO = PurchaseOrder::where('po_number', 'like', "{$prefix}%")
            ->orderByDesc('po_number')
            ->first();

        if ($lastPO) {
            $lastSequence = (int) substr($lastPO->po_number, -4);
            $nextSequence = $lastSequence + 1;
        } else {
            $nextSequence = 1;
        }

        return $prefix . str_pad($nextSequence, 4, '0', STR_PAD_LEFT);
    }
}
