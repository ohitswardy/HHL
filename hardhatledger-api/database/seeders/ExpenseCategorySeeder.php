<?php

namespace Database\Seeders;

use App\Models\ChartOfAccount;
use App\Models\ExpenseCategory;
use Illuminate\Database\Seeder;

class ExpenseCategorySeeder extends Seeder
{
    public function run(): void
    {
        // Add missing COA accounts if they don't exist
        $newAccounts = [
            ['code' => '1400', 'name' => 'Input VAT', 'type' => 'asset', 'parent_code' => '1000'],
            ['code' => '5011', 'name' => 'COGS Non-VATable', 'type' => 'expense', 'parent_code' => '5000'],
            ['code' => '5060', 'name' => 'Cost of Sales', 'type' => 'expense', 'parent_code' => '5000'],
        ];

        foreach ($newAccounts as $account) {
            if (!ChartOfAccount::where('code', $account['code'])->exists()) {
                $parent = ChartOfAccount::where('code', $account['parent_code'])->first();
                ChartOfAccount::create([
                    'code' => $account['code'],
                    'name' => $account['name'],
                    'type' => $account['type'],
                    'parent_id' => $parent?->id,
                ]);
            }
        }

        // Seed expense categories
        $categories = [
            ['name' => 'COGS VATable', 'account_code' => '5010', 'description' => 'Cost of goods sold with VAT'],
            ['name' => 'COGS NonVATable', 'account_code' => '5011', 'description' => 'Cost of goods sold without VAT'],
            ['name' => 'Cost of Sales', 'account_code' => '5060', 'description' => 'Direct cost of sales'],
            ['name' => 'Operating Expenses', 'account_code' => '5020', 'description' => 'General operating expenses'],
            ['name' => 'Utilities', 'account_code' => '5030', 'description' => 'Electricity, water, internet'],
            ['name' => 'Salaries', 'account_code' => '5040', 'description' => 'Employee salaries and wages'],
            ['name' => 'Discounts Given', 'account_code' => '5050', 'description' => 'Discounts provided to customers'],
        ];

        foreach ($categories as $category) {
            ExpenseCategory::firstOrCreate(
                ['name' => $category['name']],
                $category,
            );
        }
    }
}
