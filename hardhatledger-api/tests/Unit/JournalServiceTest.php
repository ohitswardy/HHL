<?php

namespace Tests\Unit;

use App\Models\ChartOfAccount;
use App\Models\Client;
use App\Models\ClientTier;
use App\Models\JournalEntry;
use App\Models\Payment;
use App\Models\Product;
use App\Models\SaleItem;
use App\Models\SalesTransaction;
use App\Models\Setting;
use App\Services\JournalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tests for JournalService — the double-entry heart of HardhatLedger.
 *
 * Every test asserts the accounting invariant: sum(debit) == sum(credit)
 * for every journal entry, and that entries hit the correct accounts.
 */
class JournalServiceTest extends TestCase
{
    use RefreshDatabase;

    private JournalService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new JournalService();
        $this->seedChartOfAccounts();
        $this->seedSettings();
    }

    // ──────────────────────────────────────────────
    //  Helpers
    // ──────────────────────────────────────────────

    private function seedChartOfAccounts(): void
    {
        $accounts = [
            ['code' => '1010', 'name' => 'Cash on Hand',          'type' => 'asset'],
            ['code' => '1020', 'name' => 'Cash in Bank',           'type' => 'asset'],
            ['code' => '1100', 'name' => 'Accounts Receivable',    'type' => 'asset'],
            ['code' => '1200', 'name' => 'Inventory',              'type' => 'asset'],
            ['code' => '1400', 'name' => 'Input VAT',              'type' => 'asset'],
            ['code' => '2010', 'name' => 'Accounts Payable',       'type' => 'liability'],
            ['code' => '2100', 'name' => 'VAT Payable',            'type' => 'liability'],
            ['code' => '4010', 'name' => 'Sales (NON-VAT)',        'type' => 'revenue'],
            ['code' => '4020', 'name' => 'Sales (VATable)',        'type' => 'revenue'],
            ['code' => '5010', 'name' => 'COGS VATable',           'type' => 'expense'],
            ['code' => '5011', 'name' => 'COGS NonVATable',        'type' => 'expense'],
        ];

        foreach ($accounts as $account) {
            ChartOfAccount::create($account);
        }
    }

    private function seedSettings(): void
    {
        Setting::create(['key' => 'tax_rate', 'value' => '12']);
    }

    /**
     * Assert that sum(debit) == sum(credit) for the most recent journal entry.
     */
    private function assertLastEntryIsBalanced(): void
    {
        $entry = JournalEntry::with('lines')->latest()->firstOrFail();
        $totalDebit  = $entry->lines->sum('debit');
        $totalCredit = $entry->lines->sum('credit');

        $this->assertEqualsWithDelta(
            $totalDebit,
            $totalCredit,
            0.01,
            "Journal entry #{$entry->id} is not balanced: debit={$totalDebit}, credit={$totalCredit}"
        );
    }

    private function makeProduct(float $costPrice = 60.0, float $sellingPrice = 100.0): Product
    {
        return Product::create([
            'sku'                => 'TEST-' . uniqid(),
            'name'               => 'Test Product',
            'cost_price'         => $costPrice,
            'base_selling_price' => $sellingPrice,
            'branch_id'          => 1,
        ]);
    }

    private function makeCashSale(Product $product, int $qty = 1, float $total = 100.0): SalesTransaction
    {
        $sale = SalesTransaction::create([
            'transaction_number' => 'INV-TEST-0001',
            'status'             => 'completed',
            'subtotal'           => $total,
            'discount_amount'    => 0,
            'delivery_fee'       => 0,
            'tax_amount'         => 0,
            'total_amount'       => $total,
        ]);

        SaleItem::create([
            'sales_transaction_id' => $sale->id,
            'product_id'           => $product->id,
            'quantity'             => $qty,
            'unit_price'           => $total,
            'discount'             => 0,
            'line_total'           => $total,
        ]);

        $sale->payments()->create([
            'payment_method' => 'cash',
            'amount'         => $total,
            'status'         => 'confirmed',
            'paid_at'        => now(),
        ]);

        return $sale;
    }

    // ──────────────────────────────────────────────
    //  Tests: Cash / Non-VAT sale
    // ──────────────────────────────────────────────

    public function test_cash_sale_journal_entry_is_balanced(): void
    {
        $product = $this->makeProduct(costPrice: 60, sellingPrice: 100);
        $sale    = $this->makeCashSale($product, qty: 1, total: 100);

        $this->service->postSaleEntry($sale);

        $this->assertLastEntryIsBalanced();
    }

    public function test_non_vat_walk_in_sale_credits_account_4010(): void
    {
        $product = $this->makeProduct(costPrice: 60, sellingPrice: 100);
        $sale    = $this->makeCashSale($product, qty: 1, total: 100);

        $this->service->postSaleEntry($sale);

        $revenueAccount = ChartOfAccount::where('code', '4010')->firstOrFail();
        $entry          = JournalEntry::with('lines')->latest()->firstOrFail();
        $revenueLines   = $entry->lines->where('account_id', $revenueAccount->id);

        $this->assertGreaterThan(0, $revenueLines->count(), 'Expected a credit line on account 4010');
        $this->assertEqualsWithDelta(100.0, $revenueLines->sum('credit'), 0.01);
    }

    public function test_non_vat_sale_does_not_touch_vat_payable(): void
    {
        $product = $this->makeProduct();
        $sale    = $this->makeCashSale($product, qty: 1, total: 100);

        $this->service->postSaleEntry($sale);

        $vatAccount = ChartOfAccount::where('code', '2100')->first();
        $entry      = JournalEntry::with('lines')->latest()->firstOrFail();
        $vatLines   = $entry->lines->where('account_id', $vatAccount->id);

        $this->assertCount(0, $vatLines, 'Non-VAT sale must not post to VAT Payable (2100)');
    }

    public function test_cash_sale_debits_cash_on_hand(): void
    {
        $product = $this->makeProduct(costPrice: 60, sellingPrice: 100);
        $sale    = $this->makeCashSale($product, qty: 1, total: 100);

        $this->service->postSaleEntry($sale);

        $cashAccount = ChartOfAccount::where('code', '1010')->firstOrFail();
        $entry       = JournalEntry::with('lines')->latest()->firstOrFail();
        $cashLines   = $entry->lines->where('account_id', $cashAccount->id);

        $this->assertGreaterThan(0, $cashLines->count());
        $this->assertEqualsWithDelta(100.0, $cashLines->sum('debit'), 0.01);
    }

    public function test_sale_posts_cogs_and_reduces_inventory(): void
    {
        $product = $this->makeProduct(costPrice: 60, sellingPrice: 100);
        $sale    = $this->makeCashSale($product, qty: 2, total: 200);

        $this->service->postSaleEntry($sale);

        $inventoryAccount = ChartOfAccount::where('code', '1200')->firstOrFail();
        $cogsAccount      = ChartOfAccount::where('code', '5011')->firstOrFail(); // non-VAT

        $entry = JournalEntry::with('lines')->latest()->firstOrFail();
        $invLines  = $entry->lines->where('account_id', $inventoryAccount->id);
        $cogsLines = $entry->lines->where('account_id', $cogsAccount->id);

        $expectedCogs = 60 * 2; // cost × qty

        $this->assertEqualsWithDelta($expectedCogs, $invLines->sum('credit'), 0.01);
        $this->assertEqualsWithDelta($expectedCogs, $cogsLines->sum('debit'), 0.01);
    }

    // ──────────────────────────────────────────────
    //  Tests: VATable sale (explicit tax)
    // ──────────────────────────────────────────────

    public function test_vatable_sale_via_explicit_tax_is_balanced(): void
    {
        $product = $this->makeProduct(costPrice: 60, sellingPrice: 100);

        // Explicit VAT: price 100 + 12 tax = 112 total
        $sale = SalesTransaction::create([
            'transaction_number' => 'INV-TEST-VAT-0001',
            'status'             => 'completed',
            'subtotal'           => 100,
            'discount_amount'    => 0,
            'delivery_fee'       => 0,
            'tax_amount'         => 12,
            'total_amount'       => 112,
        ]);
        SaleItem::create([
            'sales_transaction_id' => $sale->id,
            'product_id'           => $product->id,
            'quantity'             => 1,
            'unit_price'           => 112,
            'discount'             => 0,
            'line_total'           => 112,
        ]);
        $sale->payments()->create([
            'payment_method' => 'cash',
            'amount'         => 112,
            'status'         => 'confirmed',
            'paid_at'        => now(),
        ]);

        $this->service->postSaleEntry($sale);

        $this->assertLastEntryIsBalanced();
    }

    public function test_explicit_vat_sale_credits_4020_and_vat_payable(): void
    {
        $product = $this->makeProduct();

        $sale = SalesTransaction::create([
            'transaction_number' => 'INV-TEST-VAT-0002',
            'status'             => 'completed',
            'subtotal'           => 100,
            'discount_amount'    => 0,
            'delivery_fee'       => 0,
            'tax_amount'         => 12,
            'total_amount'       => 112,
        ]);
        SaleItem::create([
            'sales_transaction_id' => $sale->id,
            'product_id'           => $product->id,
            'quantity'             => 1,
            'unit_price'           => 112,
            'discount'             => 0,
            'line_total'           => 112,
        ]);
        $sale->payments()->create([
            'payment_method' => 'cash',
            'amount'         => 112,
            'status'         => 'confirmed',
            'paid_at'        => now(),
        ]);

        $this->service->postSaleEntry($sale);

        $revenueAccount = ChartOfAccount::where('code', '4020')->firstOrFail();
        $vatAccount     = ChartOfAccount::where('code', '2100')->firstOrFail();
        $entry          = JournalEntry::with('lines')->latest()->firstOrFail();

        $this->assertEqualsWithDelta(100.0, $entry->lines->where('account_id', $revenueAccount->id)->sum('credit'), 0.01);
        $this->assertEqualsWithDelta(12.0,  $entry->lines->where('account_id', $vatAccount->id)->sum('credit'), 0.01);
    }

    // ──────────────────────────────────────────────
    //  Tests: Credit sale
    // ──────────────────────────────────────────────

    public function test_credit_sale_debits_accounts_receivable(): void
    {
        $product = $this->makeProduct();

        $sale = SalesTransaction::create([
            'transaction_number' => 'INV-TEST-CR-0001',
            'status'             => 'pending',
            'subtotal'           => 500,
            'discount_amount'    => 0,
            'delivery_fee'       => 0,
            'tax_amount'         => 0,
            'total_amount'       => 500,
        ]);
        SaleItem::create([
            'sales_transaction_id' => $sale->id,
            'product_id'           => $product->id,
            'quantity'             => 5,
            'unit_price'           => 100,
            'discount'             => 0,
            'line_total'           => 500,
        ]);
        // Credit payment is pending — not confirmed
        $sale->payments()->create([
            'payment_method' => 'credit',
            'amount'         => 500,
            'status'         => 'pending',
        ]);

        $this->service->postSaleEntry($sale);

        $arAccount = ChartOfAccount::where('code', '1100')->firstOrFail();
        $entry     = JournalEntry::with('lines')->latest()->firstOrFail();

        $this->assertEqualsWithDelta(500.0, $entry->lines->where('account_id', $arAccount->id)->sum('debit'), 0.01);
        $this->assertLastEntryIsBalanced();
    }

    // ──────────────────────────────────────────────
    //  Tests: Payment entry
    // ──────────────────────────────────────────────

    public function test_payment_entry_is_balanced(): void
    {
        $product = $this->makeProduct();

        $sale = SalesTransaction::create([
            'transaction_number' => 'INV-TEST-PAY-0001',
            'status'             => 'pending',
            'subtotal'           => 200,
            'discount_amount'    => 0,
            'delivery_fee'       => 0,
            'tax_amount'         => 0,
            'total_amount'       => 200,
        ]);

        $payment = $sale->payments()->create([
            'payment_method' => 'cash',
            'amount'         => 200,
            'status'         => 'confirmed',
            'paid_at'        => now(),
        ]);

        $this->service->postPaymentEntry($payment);

        $this->assertLastEntryIsBalanced();
    }

    public function test_payment_entry_debits_cash_and_credits_ar(): void
    {
        $product = $this->makeProduct();

        $sale = SalesTransaction::create([
            'transaction_number' => 'INV-TEST-PAY-0002',
            'status'             => 'pending',
            'subtotal'           => 300,
            'discount_amount'    => 0,
            'delivery_fee'       => 0,
            'tax_amount'         => 0,
            'total_amount'       => 300,
        ]);

        $payment = $sale->payments()->create([
            'payment_method' => 'cash',
            'amount'         => 300,
            'status'         => 'confirmed',
            'paid_at'        => now(),
        ]);

        $this->service->postPaymentEntry($payment);

        $cashAccount = ChartOfAccount::where('code', '1010')->firstOrFail();
        $arAccount   = ChartOfAccount::where('code', '1100')->firstOrFail();
        $entry       = JournalEntry::with('lines')->latest()->firstOrFail();

        $this->assertEqualsWithDelta(300.0, $entry->lines->where('account_id', $cashAccount->id)->sum('debit'), 0.01);
        $this->assertEqualsWithDelta(300.0, $entry->lines->where('account_id', $arAccount->id)->sum('credit'), 0.01);
    }

    public function test_bank_transfer_payment_debits_cash_in_bank(): void
    {
        $sale = SalesTransaction::create([
            'transaction_number' => 'INV-TEST-PAY-0003',
            'status'             => 'pending',
            'subtotal'           => 150,
            'discount_amount'    => 0,
            'delivery_fee'       => 0,
            'tax_amount'         => 0,
            'total_amount'       => 150,
        ]);

        $payment = $sale->payments()->create([
            'payment_method' => 'bank_transfer',
            'amount'         => 150,
            'status'         => 'confirmed',
            'paid_at'        => now(),
        ]);

        $this->service->postPaymentEntry($payment);

        $bankAccount = ChartOfAccount::where('code', '1020')->firstOrFail();
        $entry       = JournalEntry::with('lines')->latest()->firstOrFail();

        $this->assertEqualsWithDelta(150.0, $entry->lines->where('account_id', $bankAccount->id)->sum('debit'), 0.01);
    }

    // ──────────────────────────────────────────────
    //  Tests: Sale reversal
    // ──────────────────────────────────────────────

    public function test_sale_reversal_mirrors_original_and_is_balanced(): void
    {
        $product = $this->makeProduct();
        $sale    = $this->makeCashSale($product, qty: 1, total: 100);

        $this->service->postSaleEntry($sale);

        $originalEntry = JournalEntry::where('reference_type', 'sale')
            ->where('reference_id', $sale->id)
            ->with('lines')
            ->firstOrFail();

        $originalDebit  = $originalEntry->lines->sum('debit');
        $originalCredit = $originalEntry->lines->sum('credit');

        $this->service->reverseSaleEntry($sale);

        $reversalEntry = JournalEntry::where('reference_type', 'sale_reversal')
            ->where('reference_id', $sale->id)
            ->with('lines')
            ->firstOrFail();

        $reversalDebit  = $reversalEntry->lines->sum('debit');
        $reversalCredit = $reversalEntry->lines->sum('credit');

        // Reversal debits == original credits, and vice-versa
        $this->assertEqualsWithDelta($originalCredit, $reversalDebit, 0.01);
        $this->assertEqualsWithDelta($originalDebit,  $reversalCredit, 0.01);

        // Reversal itself is also balanced
        $this->assertEqualsWithDelta($reversalDebit, $reversalCredit, 0.01);
    }

    // ──────────────────────────────────────────────
    //  Tests: Purchase entry
    // ──────────────────────────────────────────────

    public function test_non_vat_purchase_entry_is_balanced(): void
    {
        $po = \App\Models\PurchaseOrder::create([
            'po_number'    => 'PO-TEST-0001',
            'status'       => 'received',
            'total_amount' => 500,
            'branch_id'    => 1,
        ]);

        $this->service->postPurchaseEntry($po);

        $this->assertLastEntryIsBalanced();
    }

    public function test_non_vat_purchase_debits_inventory_and_credits_ap(): void
    {
        $po = \App\Models\PurchaseOrder::create([
            'po_number'    => 'PO-TEST-0002',
            'status'       => 'received',
            'total_amount' => 1000,
            'branch_id'    => 1,
        ]);

        $this->service->postPurchaseEntry($po);

        $inventoryAccount = ChartOfAccount::where('code', '1200')->firstOrFail();
        $apAccount        = ChartOfAccount::where('code', '2010')->firstOrFail();
        $entry            = JournalEntry::with('lines')->latest()->firstOrFail();

        $this->assertEqualsWithDelta(1000.0, $entry->lines->where('account_id', $inventoryAccount->id)->sum('debit'), 0.01);
        $this->assertEqualsWithDelta(1000.0, $entry->lines->where('account_id', $apAccount->id)->sum('credit'), 0.01);
    }

    // ──────────────────────────────────────────────
    //  Invariant: every entry that can be created must be balanced
    // ──────────────────────────────────────────────

    public function test_all_journal_entries_are_balanced_after_multiple_operations(): void
    {
        $product = $this->makeProduct(costPrice: 80, sellingPrice: 200);

        // Sale 1: cash
        $sale1 = $this->makeCashSale($product, qty: 1, total: 200);
        $this->service->postSaleEntry($sale1);

        // Sale 2: credit
        $sale2 = SalesTransaction::create([
            'transaction_number' => 'INV-TEST-MULTI-0002',
            'status'             => 'pending',
            'subtotal'           => 400,
            'discount_amount'    => 0,
            'delivery_fee'       => 0,
            'tax_amount'         => 0,
            'total_amount'       => 400,
        ]);
        SaleItem::create([
            'sales_transaction_id' => $sale2->id,
            'product_id'           => $product->id,
            'quantity'             => 2,
            'unit_price'           => 200,
            'discount'             => 0,
            'line_total'           => 400,
        ]);
        $sale2->payments()->create([
            'payment_method' => 'credit',
            'amount'         => 400,
            'status'         => 'pending',
        ]);
        $this->service->postSaleEntry($sale2);

        // Payment on sale 2
        $payment = $sale2->payments()->create([
            'payment_method' => 'cash',
            'amount'         => 400,
            'status'         => 'confirmed',
            'paid_at'        => now(),
        ]);
        $this->service->postPaymentEntry($payment);

        // Assert ALL entries are balanced
        JournalEntry::with('lines')->get()->each(function (JournalEntry $entry) {
            $this->assertEqualsWithDelta(
                $entry->lines->sum('debit'),
                $entry->lines->sum('credit'),
                0.01,
                "Entry #{$entry->id} ({$entry->reference_type}) is not balanced"
            );
        });
    }
}
