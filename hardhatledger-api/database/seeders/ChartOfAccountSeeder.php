<?php

namespace Database\Seeders;

use App\Models\ChartOfAccount;
use Illuminate\Database\Seeder;

class ChartOfAccountSeeder extends Seeder
{
    public function run(): void
    {
        $accounts = [
            // Assets (1xxx)
            ['code' => '1000', 'name' => 'Assets', 'type' => 'asset', 'parent_id' => null],
            ['code' => '1010', 'name' => 'Cash on Hand', 'type' => 'asset', 'parent_code' => '1000'],
            ['code' => '1020', 'name' => 'Cash in Bank', 'type' => 'asset', 'parent_code' => '1000'],
            ['code' => '1100', 'name' => 'Accounts Receivable', 'type' => 'asset', 'parent_code' => '1000'],
            ['code' => '1200', 'name' => 'Inventory', 'type' => 'asset', 'parent_code' => '1000'],
            ['code' => '1300', 'name' => 'Equipment', 'type' => 'asset', 'parent_code' => '1000'],

            // Liabilities (2xxx)
            ['code' => '2000', 'name' => 'Liabilities', 'type' => 'liability', 'parent_id' => null],
            ['code' => '2010', 'name' => 'Accounts Payable', 'type' => 'liability', 'parent_code' => '2000'],
            ['code' => '2020', 'name' => 'Accrued Expenses', 'type' => 'liability', 'parent_code' => '2000'],

            // Equity (3xxx)
            ['code' => '3000', 'name' => 'Equity', 'type' => 'equity', 'parent_id' => null],
            ['code' => '3010', 'name' => "Owner's Capital", 'type' => 'equity', 'parent_code' => '3000'],
            ['code' => '3020', 'name' => 'Retained Earnings', 'type' => 'equity', 'parent_code' => '3000'],

            // Revenue (4xxx)
            ['code' => '4000', 'name' => 'Revenue', 'type' => 'revenue', 'parent_id' => null],
            ['code' => '4010', 'name' => 'Sales Revenue', 'type' => 'revenue', 'parent_code' => '4000'],
            ['code' => '4020', 'name' => 'Other Income', 'type' => 'revenue', 'parent_code' => '4000'],

            // Expenses (5xxx)
            ['code' => '5000', 'name' => 'Expenses', 'type' => 'expense', 'parent_id' => null],
            ['code' => '5010', 'name' => 'Cost of Goods Sold', 'type' => 'expense', 'parent_code' => '5000'],
            ['code' => '5020', 'name' => 'Operating Expenses', 'type' => 'expense', 'parent_code' => '5000'],
            ['code' => '5030', 'name' => 'Utilities', 'type' => 'expense', 'parent_code' => '5000'],
            ['code' => '5040', 'name' => 'Salaries', 'type' => 'expense', 'parent_code' => '5000'],
            ['code' => '5050', 'name' => 'Discounts Given', 'type' => 'expense', 'parent_code' => '5000'],
        ];

        $codeToId = [];

        foreach ($accounts as $account) {
            $parentId = null;
            if (isset($account['parent_code'])) {
                $parentId = $codeToId[$account['parent_code']] ?? null;
                unset($account['parent_code']);
            }

            $created = ChartOfAccount::create([
                'code' => $account['code'],
                'name' => $account['name'],
                'type' => $account['type'],
                'parent_id' => $parentId ?? ($account['parent_id'] ?? null),
            ]);

            $codeToId[$account['code']] = $created->id;
        }
    }
}
