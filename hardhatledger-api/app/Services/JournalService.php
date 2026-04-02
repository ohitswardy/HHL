<?php

namespace App\Services;

use App\Models\ChartOfAccount;
use App\Models\JournalEntry;
use App\Models\Payment;
use App\Models\PurchaseOrder;
use App\Models\SalesTransaction;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class JournalService
{
    private function getAccountByCode(string $code): ChartOfAccount
    {
        return ChartOfAccount::where('code', $code)->firstOrFail();
    }

    public function postSaleEntry(SalesTransaction $sale): void
    {
        DB::transaction(function () use ($sale) {
            $entry = JournalEntry::create([
                'reference_type' => 'sale',
                'reference_id' => $sale->id,
                'description' => "Sales transaction {$sale->transaction_number}",
                'date' => now(),
                'user_id' => Auth::id(),
            ]);

            $cashAccount = $this->getAccountByCode('1010');
            $arAccount = $this->getAccountByCode('1100');
            $revenueAccount = $this->getAccountByCode('4010');
            $cogsAccount = $this->getAccountByCode('5010');
            $inventoryAccount = $this->getAccountByCode('1200');

            // Determine how much was paid in cash vs credit
            $totalPaid = (float) $sale->payments()->where('status', 'confirmed')->sum('amount');
            $creditAmount = (float) $sale->total_amount - $totalPaid;

            // DR: Cash for amount paid
            if ($totalPaid > 0) {
                $entry->lines()->create([
                    'account_id' => $cashAccount->id,
                    'debit' => $totalPaid,
                    'credit' => 0,
                ]);
            }

            // DR: Accounts Receivable for credit portion
            if ($creditAmount > 0) {
                $entry->lines()->create([
                    'account_id' => $arAccount->id,
                    'debit' => $creditAmount,
                    'credit' => 0,
                ]);
            }

            // CR: Sales Revenue
            $entry->lines()->create([
                'account_id' => $revenueAccount->id,
                'debit' => 0,
                'credit' => (float) $sale->total_amount,
            ]);

            // Calculate COGS from sale items
            $cogs = 0;
            $sale->load('items.product');
            foreach ($sale->items as $item) {
                $cogs += (float) $item->product->cost_price * $item->quantity;
            }

            if ($cogs > 0) {
                // DR: COGS
                $entry->lines()->create([
                    'account_id' => $cogsAccount->id,
                    'debit' => $cogs,
                    'credit' => 0,
                ]);

                // CR: Inventory
                $entry->lines()->create([
                    'account_id' => $inventoryAccount->id,
                    'debit' => 0,
                    'credit' => $cogs,
                ]);
            }
        });
    }

    public function postPurchaseEntry(PurchaseOrder $po): void
    {
        DB::transaction(function () use ($po) {
            $entry = JournalEntry::create([
                'reference_type' => 'purchase',
                'reference_id' => $po->id,
                'description' => "Purchase order {$po->po_number}",
                'date' => now(),
                'user_id' => Auth::id(),
            ]);

            $inventoryAccount = $this->getAccountByCode('1200');
            $apAccount = $this->getAccountByCode('2010');

            $total = (float) $po->total_amount;

            // DR: Inventory
            $entry->lines()->create([
                'account_id' => $inventoryAccount->id,
                'debit' => $total,
                'credit' => 0,
            ]);

            // CR: Accounts Payable
            $entry->lines()->create([
                'account_id' => $apAccount->id,
                'debit' => 0,
                'credit' => $total,
            ]);
        });
    }

    public function postPaymentEntry(Payment $payment): void
    {
        DB::transaction(function () use ($payment) {
            $sale = $payment->salesTransaction;

            $entry = JournalEntry::create([
                'reference_type' => 'payment',
                'reference_id' => $payment->id,
                'description' => "Payment received for {$sale->transaction_number}",
                'date' => now(),
                'user_id' => Auth::id(),
            ]);

            $cashAccount = $this->getAccountByCode('1010');
            $arAccount = $this->getAccountByCode('1100');

            $amount = (float) $payment->amount;

            // DR: Cash
            $entry->lines()->create([
                'account_id' => $cashAccount->id,
                'debit' => $amount,
                'credit' => 0,
            ]);

            // CR: Accounts Receivable
            $entry->lines()->create([
                'account_id' => $arAccount->id,
                'debit' => 0,
                'credit' => $amount,
            ]);
        });
    }

    public function reverseSaleEntry(SalesTransaction $sale): void
    {
        DB::transaction(function () use ($sale) {
            $originalEntry = JournalEntry::where('reference_type', 'sale')
                ->where('reference_id', $sale->id)
                ->firstOrFail();

            $reversalEntry = JournalEntry::create([
                'reference_type' => 'sale_reversal',
                'reference_id' => $sale->id,
                'description' => "Reversal of sales transaction {$sale->transaction_number}",
                'date' => now(),
                'user_id' => Auth::id(),
            ]);

            foreach ($originalEntry->lines as $line) {
                $reversalEntry->lines()->create([
                    'account_id' => $line->account_id,
                    'debit' => (float) $line->credit,
                    'credit' => (float) $line->debit,
                ]);
            }
        });
    }
}
