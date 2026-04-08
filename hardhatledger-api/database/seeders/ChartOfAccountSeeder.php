<?php

namespace Database\Seeders;

use App\Models\ChartOfAccount;
use Illuminate\Database\Seeder;

class ChartOfAccountSeeder extends Seeder
{
    public function run(): void
    {
        $accounts = [
            // ─── ASSETS (1xxx) ───
            ['code' => '1000', 'name' => 'Assets', 'type' => 'asset', 'parent_id' => null],
            ['code' => '1010', 'name' => 'Cash on Hand', 'type' => 'asset', 'parent_code' => '1000'],
            ['code' => '1020', 'name' => 'Cash in Bank', 'type' => 'asset', 'parent_code' => '1000'],
            ['code' => '1100', 'name' => 'Accounts Receivable', 'type' => 'asset', 'parent_code' => '1000'],
            ['code' => '1120', 'name' => 'Allowance for Bad Debts', 'type' => 'asset', 'parent_code' => '1000'],
            ['code' => '1200', 'name' => 'Inventory', 'type' => 'asset', 'parent_code' => '1000'],
            ['code' => '1300', 'name' => 'Prepaid Expenses', 'type' => 'asset', 'parent_code' => '1000'],
            ['code' => '1310', 'name' => 'VAT on Purchases (Input VAT)', 'type' => 'asset', 'parent_code' => '1000'],
            ['code' => '1400', 'name' => 'Input VAT', 'type' => 'asset', 'parent_code' => '1000'],
            ['code' => '1500', 'name' => 'Property, Plant & Equipment', 'type' => 'asset', 'parent_code' => '1000'],
            ['code' => '1550', 'name' => 'Accumulated Depreciation', 'type' => 'asset', 'parent_code' => '1000'],

            // ─── LIABILITIES (2xxx) ───
            ['code' => '2000', 'name' => 'Liabilities', 'type' => 'liability', 'parent_id' => null],
            ['code' => '2010', 'name' => 'Accounts Payable', 'type' => 'liability', 'parent_code' => '2000'],
            ['code' => '2020', 'name' => 'Accrued Expenses', 'type' => 'liability', 'parent_code' => '2000'],
            ['code' => '2100', 'name' => 'VAT Payable', 'type' => 'liability', 'parent_code' => '2000'],
            ['code' => '2110', 'name' => 'Income Tax Payable', 'type' => 'liability', 'parent_code' => '2000'],

            // ─── EQUITY (3xxx) ───
            ['code' => '3000', 'name' => 'Equity', 'type' => 'equity', 'parent_id' => null],
            ['code' => '3010', 'name' => 'Share Capital', 'type' => 'equity', 'parent_code' => '3000'],
            ['code' => '3020', 'name' => 'Retained Earnings', 'type' => 'equity', 'parent_code' => '3000'],
            ['code' => '3200', 'name' => 'Dividend Disbursed', 'type' => 'equity', 'parent_code' => '3000'],

            // ─── REVENUE (4xxx) ───
            ['code' => '4000', 'name' => 'Revenue', 'type' => 'revenue', 'parent_id' => null],
            ['code' => '4010', 'name' => 'Sales', 'type' => 'revenue', 'parent_code' => '4000'],
            ['code' => '4020', 'name' => 'Sales (VATable / NonVAT)', 'type' => 'revenue', 'parent_code' => '4000'],

            // ─── COST OF SALES (5xxx) ───
            ['code' => '5000', 'name' => 'Cost of Sales', 'type' => 'expense', 'parent_id' => null],
            ['code' => '5010', 'name' => 'COGS VATable', 'type' => 'expense', 'parent_code' => '5000'],
            ['code' => '5011', 'name' => 'COGS NonVATable', 'type' => 'expense', 'parent_code' => '5000'],
            ['code' => '5020', 'name' => 'Operating Expenses', 'type' => 'expense', 'parent_code' => '5000'],
            ['code' => '5030', 'name' => 'Utilities', 'type' => 'expense', 'parent_code' => '5000'],
            ['code' => '5040', 'name' => 'Salaries & Wages', 'type' => 'expense', 'parent_code' => '5000'],
            ['code' => '5050', 'name' => 'Discounts Given', 'type' => 'expense', 'parent_code' => '5000'],
            ['code' => '5060', 'name' => 'Cost of Sales', 'type' => 'expense', 'parent_code' => '5000'],

            // ─── OTHER EXPENSES (6xxx) ───
            ['code' => '6000', 'name' => 'Other Expenses', 'type' => 'expense', 'parent_id' => null],
            ['code' => '6230', 'name' => 'Reconciliation Discrepancies', 'type' => 'expense', 'parent_code' => '6000'],
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
