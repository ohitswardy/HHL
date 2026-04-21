<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\ChartOfAccount;
use App\Models\InventoryStock;
use App\Models\JournalEntry;
use App\Models\Product;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Feature tests for POS sale creation (POST /api/v1/pos/sales).
 *
 * Tests the happy path, inventory decrement, journal creation, and validation.
 */
class PosCreateSaleTest extends TestCase
{
    use RefreshDatabase;

    private User $clerk;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        // Reset cached permission data between tests
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $this->seedChartOfAccounts();
        $this->seedSettings();

        // Create the permission + role needed to hit the POS endpoint
        $permission = Permission::create(['name' => 'pos.create-sale', 'guard_name' => 'sanctum']);
        $role = Role::create(['name' => 'Sales Clerk', 'guard_name' => 'sanctum']);
        $role->givePermissionTo($permission);

        // Create an authenticated user
        $this->clerk = User::factory()->create();
        $this->clerk->assignRole($role);

        // Create a test product with stock
        $category = Category::create(['name' => 'Test Category', 'branch_id' => 1]);
        $this->product = Product::create([
            'sku'                => 'FEAT-TEST-001',
            'name'               => 'Feature Test Product',
            'category_id'        => $category->id,
            'cost_price'         => 60.00,
            'base_selling_price' => 100.00,
            'is_active'          => true,
            'branch_id'          => 1,
        ]);

        InventoryStock::create([
            'product_id'         => $this->product->id,
            'quantity_on_hand'   => 100,
            'quantity_reserved'  => 0,
        ]);
    }

    // ──────────────────────────────────────────────
    //  Helpers
    // ──────────────────────────────────────────────

    private function seedChartOfAccounts(): void
    {
        $accounts = [
            ['code' => '1010', 'name' => 'Cash on Hand',       'type' => 'asset'],
            ['code' => '1020', 'name' => 'Cash in Bank',        'type' => 'asset'],
            ['code' => '1100', 'name' => 'Accounts Receivable', 'type' => 'asset'],
            ['code' => '1200', 'name' => 'Inventory',           'type' => 'asset'],
            ['code' => '2100', 'name' => 'VAT Payable',         'type' => 'liability'],
            ['code' => '4010', 'name' => 'Sales (NON-VAT)',     'type' => 'revenue'],
            ['code' => '4020', 'name' => 'Sales (VATable)',     'type' => 'revenue'],
            ['code' => '5010', 'name' => 'COGS VATable',        'type' => 'expense'],
            ['code' => '5011', 'name' => 'COGS NonVATable',     'type' => 'expense'],
        ];

        foreach ($accounts as $account) {
            ChartOfAccount::create($account);
        }
    }

    private function seedSettings(): void
    {
        Setting::create(['key' => 'tax_rate', 'value' => '12']);
    }

    private function validSalePayload(array $overrides = []): array
    {
        return array_merge([
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity'   => 1,
                    'discount'   => 0,
                ],
            ],
            'payments' => [
                [
                    'payment_method' => 'cash',
                    'amount'         => 100.00,
                ],
            ],
            'fulfillment_type' => 'pickup',
        ], $overrides);
    }

    // ──────────────────────────────────────────────
    //  Happy path tests
    // ──────────────────────────────────────────────

    public function test_create_cash_sale_returns_201(): void
    {
        Sanctum::actingAs($this->clerk, ['*']);

        $response = $this->postJson('/api/v1/pos/sales', $this->validSalePayload());

        $response->assertStatus(201);
        $response->assertJsonStructure([
            'data' => ['id', 'transaction_number', 'status', 'total_amount'],
        ]);
    }

    public function test_create_sale_status_is_completed_for_cash_payment(): void
    {
        Sanctum::actingAs($this->clerk, ['*']);

        $response = $this->postJson('/api/v1/pos/sales', $this->validSalePayload());

        $response->assertStatus(201)
            ->assertJsonPath('data.status', 'completed');
    }

    public function test_create_sale_decrements_inventory(): void
    {
        Sanctum::actingAs($this->clerk, ['*']);

        $this->postJson('/api/v1/pos/sales', $this->validSalePayload(['items' => [
            ['product_id' => $this->product->id, 'quantity' => 3, 'discount' => 0],
        ], 'payments' => [['payment_method' => 'cash', 'amount' => 300]]]));

        $this->assertDatabaseHas('inventory_stock', [
            'product_id'       => $this->product->id,
            'quantity_on_hand'  => 97, // 100 - 3
        ]);
    }

    public function test_create_sale_creates_a_journal_entry(): void
    {
        Sanctum::actingAs($this->clerk, ['*']);

        $this->postJson('/api/v1/pos/sales', $this->validSalePayload());

        $this->assertDatabaseHas('journal_entries', ['reference_type' => 'sale']);
    }

    public function test_created_sale_journal_entry_is_balanced(): void
    {
        Sanctum::actingAs($this->clerk, ['*']);

        $this->postJson('/api/v1/pos/sales', $this->validSalePayload());

        $entry = JournalEntry::with('lines')->where('reference_type', 'sale')->firstOrFail();

        $this->assertEqualsWithDelta(
            $entry->lines->sum('debit'),
            $entry->lines->sum('credit'),
            0.01,
            'Journal entry created by POS sale must be balanced'
        );
    }

    public function test_create_sale_records_inventory_movement(): void
    {
        Sanctum::actingAs($this->clerk, ['*']);

        $this->postJson('/api/v1/pos/sales', $this->validSalePayload());

        $this->assertDatabaseHas('inventory_movements', [
            'product_id'     => $this->product->id,
            'type'           => 'out',
            'reference_type' => 'sale',
        ]);
    }

    // ──────────────────────────────────────────────
    //  Deferred payment (credit / pending status)
    // ──────────────────────────────────────────────

    public function test_credit_sale_status_is_pending(): void
    {
        Sanctum::actingAs($this->clerk, ['*']);

        $response = $this->postJson('/api/v1/pos/sales', $this->validSalePayload([
            'payments' => [['payment_method' => 'credit', 'amount' => 100.00]],
        ]));

        $response->assertStatus(201)
            ->assertJsonPath('data.status', 'pending');
    }

    // ──────────────────────────────────────────────
    //  Validation tests
    // ──────────────────────────────────────────────

    public function test_create_sale_without_items_returns_422(): void
    {
        Sanctum::actingAs($this->clerk, ['*']);

        $response = $this->postJson('/api/v1/pos/sales', array_merge(
            $this->validSalePayload(),
            ['items' => []]
        ));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['items']);
    }

    public function test_create_sale_without_payments_returns_422(): void
    {
        Sanctum::actingAs($this->clerk, ['*']);

        $response = $this->postJson('/api/v1/pos/sales', array_merge(
            $this->validSalePayload(),
            ['payments' => []]
        ));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['payments']);
    }

    public function test_create_sale_with_invalid_payment_method_returns_422(): void
    {
        Sanctum::actingAs($this->clerk, ['*']);

        $response = $this->postJson('/api/v1/pos/sales', $this->validSalePayload([
            'payments' => [['payment_method' => 'cryptocurrency', 'amount' => 100]],
        ]));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['payments.0.payment_method']);
    }

    public function test_create_sale_with_nonexistent_product_returns_422(): void
    {
        Sanctum::actingAs($this->clerk, ['*']);

        $response = $this->postJson('/api/v1/pos/sales', $this->validSalePayload([
            'items' => [['product_id' => 99999, 'quantity' => 1, 'discount' => 0]],
        ]));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['items.0.product_id']);
    }

    public function test_create_sale_requires_authentication(): void
    {
        $response = $this->postJson('/api/v1/pos/sales', $this->validSalePayload());

        $response->assertStatus(401);
    }

    public function test_create_sale_with_quantity_zero_returns_422(): void
    {
        Sanctum::actingAs($this->clerk, ['*']);

        $response = $this->postJson('/api/v1/pos/sales', $this->validSalePayload([
            'items' => [['product_id' => $this->product->id, 'quantity' => 0, 'discount' => 0]],
        ]));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['items.0.quantity']);
    }
}
