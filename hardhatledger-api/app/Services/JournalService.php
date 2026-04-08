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

    private function findAccountByCode(string $code): ?ChartOfAccount
    {
        return ChartOfAccount::where('code', $code)->first();
    }

    /**
     * Determine if a sale is VATable based on the client tier.
     * Retail / walk-in (no client) → NON-VAT.
     * Wholesale, Contractor, VIP, or any other tier → VATable (12%).
     */
    private function isSaleVatable(SalesTransaction $sale): bool
    {
        if (!$sale->client || !$sale->client->tier) {
            return false; // walk-in / no tier → retail NON-VAT
        }

        return strtolower($sale->client->tier->name) !== 'retail';
    }

    public function postSaleEntry(SalesTransaction $sale): void
    {
        DB::transaction(function () use ($sale) {
            $sale->loadMissing('client.tier');

            $entry = JournalEntry::create([
                'reference_type' => 'sale',
                'reference_id' => $sale->id,
                'description' => "Sales transaction {$sale->transaction_number}",
                'date' => now(),
                'user_id' => Auth::id(),
            ]);

            $cashAccount      = $this->getAccountByCode('1010');
            $arAccount         = $this->getAccountByCode('1100');
            $cogsAccount       = $this->getAccountByCode('5010');
            $inventoryAccount  = $this->getAccountByCode('1200');

            // Determine how much was paid in cash vs credit
            $totalPaid    = (float) $sale->payments()->where('status', 'confirmed')->sum('amount');
            $totalAmount  = (float) $sale->total_amount;

            // Cap cash received at the sale total — overpayment is change returned to customer
            // and should not be journalized. Only the actual sale value enters the books.
            $effectiveCash   = min($totalPaid, $totalAmount);
            $creditAmount    = $totalAmount - $effectiveCash;

            // DR: Cash for amount received (capped at sale total)
            if ($effectiveCash > 0) {
                $entry->lines()->create([
                    'account_id' => $cashAccount->id,
                    'debit'  => $effectiveCash,
                    'credit' => 0,
                ]);
            }

            // DR: Accounts Receivable for credit portion
            if ($creditAmount > 0) {
                $entry->lines()->create([
                    'account_id' => $arAccount->id,
                    'debit'  => $creditAmount,
                    'credit' => 0,
                ]);
            }

            // ── Revenue + VAT recognition ──
            $isVatable = $this->isSaleVatable($sale);

            if ($isVatable) {
                // VATable sale: total is inclusive of 12% VAT
                // Revenue = total ÷ 1.12,  VAT Output = total - revenue
                $revenueAccount = $this->getAccountByCode('4020'); // Sales (VATable / NonVAT)
                $revenueAmount  = round($totalAmount / 1.12, 2);
                $vatAmount      = round($totalAmount - $revenueAmount, 2);

                // CR: Sales Revenue (net of VAT)
                $entry->lines()->create([
                    'account_id' => $revenueAccount->id,
                    'debit'  => 0,
                    'credit' => $revenueAmount,
                ]);

                // CR: VAT Payable (Output VAT)
                $vatPayable = $this->findAccountByCode('2100');
                if ($vatPayable && $vatAmount > 0) {
                    $entry->lines()->create([
                        'account_id' => $vatPayable->id,
                        'debit'  => 0,
                        'credit' => $vatAmount,
                    ]);
                }
            } else {
                // NON-VAT sale: full amount is revenue, no VAT component
                $revenueAccount = $this->getAccountByCode('4010'); // Sales (NON-VAT)

                $entry->lines()->create([
                    'account_id' => $revenueAccount->id,
                    'debit'  => 0,
                    'credit' => $totalAmount,
                ]);
            }

            // ── COGS recognition ──
            $cogs = 0;
            $sale->load('items.product');
            foreach ($sale->items as $item) {
                $cogs += (float) $item->product->cost_price * $item->quantity;
            }

            if ($cogs > 0) {
                // DR: COGS
                $entry->lines()->create([
                    'account_id' => $cogsAccount->id,
                    'debit'  => $cogs,
                    'credit' => 0,
                ]);

                // CR: Inventory
                $entry->lines()->create([
                    'account_id' => $inventoryAccount->id,
                    'debit'  => 0,
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
            $apAccount        = $this->getAccountByCode('2010');

            $total = (float) $po->total_amount;

            // Check if PO supplier is VATable (supplier model may have is_vatable field)
            $isVatable = $po->supplier && ($po->supplier->is_vatable ?? false);

            if ($isVatable) {
                // VATable Purchase: invoice includes 12% VAT
                // Inventory cost = total ÷ 1.12,   Input VAT = total - cost
                $inventoryCost = round($total / 1.12, 2);
                $inputVat      = round($total - $inventoryCost, 2);

                // DR: Inventory (net cost)
                $entry->lines()->create([
                    'account_id' => $inventoryAccount->id,
                    'debit'  => $inventoryCost,
                    'credit' => 0,
                ]);

                // DR: Input VAT (recoverable asset)
                $vatInAccount = $this->findAccountByCode('1400')
                    ?? $this->findAccountByCode('1310');
                if ($vatInAccount && $inputVat > 0) {
                    $entry->lines()->create([
                        'account_id' => $vatInAccount->id,
                        'debit'  => $inputVat,
                        'credit' => 0,
                    ]);
                }
            } else {
                // Non-VAT Purchase: full amount is inventory cost
                $entry->lines()->create([
                    'account_id' => $inventoryAccount->id,
                    'debit'  => $total,
                    'credit' => 0,
                ]);
            }

            // CR: Accounts Payable (always full invoice amount)
            $entry->lines()->create([
                'account_id' => $apAccount->id,
                'debit'  => 0,
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
