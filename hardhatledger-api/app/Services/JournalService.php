<?php

namespace App\Services;

use App\Models\ChartOfAccount;
use App\Models\JournalEntry;
use App\Models\Payment;
use App\Models\PurchaseOrder;
use App\Models\SalesTransaction;
use App\Models\Setting;
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
     * Return the VAT divisor (e.g. 1.12 for 12%) from the settings table.
     * Falls back to 1.12 if the setting is missing or invalid.
     */
    private function vatDivisor(): float
    {
        $rate = (float) Setting::get('tax_rate', 12);
        return 1 + ($rate / 100);
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
            $bankAccount      = $this->getAccountByCode('1020');
            $arAccount         = $this->getAccountByCode('1100');
            $inventoryAccount  = $this->getAccountByCode('1200');

            // Determine how much was paid in cash vs credit vs business bank
            $totalPaid    = (float) $sale->payments()->where('status', 'confirmed')->sum('amount');
            $totalAmount  = (float) $sale->total_amount;

            // Business bank deposits go to 1020, other immediate payments go to 1010
            $bankPaid = (float) $sale->payments()
                ->where('status', 'confirmed')
                ->where('payment_method', 'business_bank')
                ->sum('amount');
            $cashPaid = (float) $sale->payments()
                ->where('status', 'confirmed')
                ->whereIn('payment_method', ['cash', 'card'])
                ->sum('amount');

            // Cap total received at the sale total
            $effectiveTotal  = min($totalPaid, $totalAmount);
            $effectiveBank   = min($bankPaid, $effectiveTotal);
            $effectiveCash   = min($cashPaid, $effectiveTotal - $effectiveBank);
            $creditAmount    = $totalAmount - $effectiveBank - $effectiveCash;

            // DR: Cash in Bank for business bank payments
            if ($effectiveBank > 0) {
                $entry->lines()->create([
                    'account_id' => $bankAccount->id,
                    'debit'  => $effectiveBank,
                    'credit' => 0,
                ]);
            }

            // DR: Cash on Hand for cash/card payments
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
            // Explicit POS tax (cashier checked "Apply VAT") takes precedence over
            // the tier-based heuristic. When tax_amount > 0 it is always a VATable sale.
            $explicitTax = (float) $sale->tax_amount;
            $isVatable   = $explicitTax > 0 ? true : $this->isSaleVatable($sale);

            if ($isVatable) {
                $revenueAccount = $this->getAccountByCode('4020'); // Sales — VATable

                if ($explicitTax > 0) {
                    // POS-level add-on tax: price was exclusive of VAT, tax was stacked on top.
                    // Revenue = total − explicit tax,  VAT Output = explicit tax amount.
                    $revenueAmount = round($totalAmount - $explicitTax, 2);
                    $vatAmount     = $explicitTax;
                } else {
                    // Tier-based VATable: prices are VAT-inclusive — extract VAT by dividing.
                    $revenueAmount = round($totalAmount / $this->vatDivisor(), 2);
                    $vatAmount     = round($totalAmount - $revenueAmount, 2);
                }

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
                $revenueAccount = $this->getAccountByCode('4010'); // Sales — NON-VAT

                $entry->lines()->create([
                    'account_id' => $revenueAccount->id,
                    'debit'  => 0,
                    'credit' => $totalAmount,
                ]);
            }

            // ── COGS recognition ──
            // Route to the correct COGS account: VATable sales (wholesale/contractor) → 5010,
            // Non-VAT retail sales → 5011. $isVatable is already resolved above.
            $cogsAccount = $this->getAccountByCode($isVatable ? '5010' : '5011');
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

    public function postPartialPurchaseEntry(PurchaseOrder $po): void
    {
        DB::transaction(function () use ($po) {
            $po->loadMissing(['items', 'supplier']);

            $receivedTotal = $po->items->sum(
                fn ($item) => (float) $item->quantity_received * (float) $item->unit_cost
            );

            if ($receivedTotal <= 0) {
                return;
            }

            $entry = JournalEntry::create([
                'reference_type' => 'purchase_partial',
                'reference_id'   => $po->id,
                'description'    => "Partial receipt — PO {$po->po_number} (cancelled)",
                'date'           => now(),
                'user_id'        => Auth::id(),
            ]);

            $inventoryAccount = $this->getAccountByCode('1200');
            $apAccount        = $this->getAccountByCode('2010');

            $isVatable = $po->supplier && ($po->supplier->is_vatable ?? false);

            if ($isVatable) {
                $inventoryCost = round($receivedTotal / $this->vatDivisor(), 2);
                $inputVat      = round($receivedTotal - $inventoryCost, 2);

                $entry->lines()->create([
                    'account_id' => $inventoryAccount->id,
                    'debit'  => $inventoryCost,
                    'credit' => 0,
                ]);

                $vatInAccount = $this->findAccountByCode('1400') ?? $this->findAccountByCode('1310');
                if ($vatInAccount && $inputVat > 0) {
                    $entry->lines()->create([
                        'account_id' => $vatInAccount->id,
                        'debit'  => $inputVat,
                        'credit' => 0,
                    ]);
                }
            } else {
                $entry->lines()->create([
                    'account_id' => $inventoryAccount->id,
                    'debit'  => $receivedTotal,
                    'credit' => 0,
                ]);
            }

            $entry->lines()->create([
                'account_id' => $apAccount->id,
                'debit'  => 0,
                'credit' => $receivedTotal,
            ]);
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
                // VATable Purchase: invoice includes VAT
                // Inventory cost = total ÷ vatDivisor,   Input VAT = total - cost
                $inventoryCost = round($total / $this->vatDivisor(), 2);
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

            // Route to Cash in Bank (1020) for business_bank and bank_transfer payments, Cash on Hand (1010) otherwise
            $cashAccountCode = in_array($payment->payment_method, ['business_bank', 'bank_transfer']) ? '1020' : '1010';
            $cashAccount = $this->getAccountByCode($cashAccountCode);
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
