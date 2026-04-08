<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chart_of_accounts', function (Blueprint $table) {
            $table->string('detail_type')->nullable()->after('type');
        });

        // Backfill detail_type for existing seeded accounts
        $mapping = [
            '1010' => 'Cash and cash equivalents',
            '1020' => 'Bank',
            '1100' => 'Accounts Receivable (A/R)',
            '1120' => 'Allowance for bad debts',
            '1200' => 'Inventory',
            '1300' => 'Prepaid Expenses',
            '1310' => 'Sales and service tax receivable',
            '1400' => 'Sales and service tax receivable',
            '1500' => 'Land',
            '1550' => 'Accumulated depreciation on property, plant and equipment',
            '2010' => 'Accounts payable',
            '2020' => 'Accrued liabilities',
            '2100' => 'Sales and service tax payable',
            '2110' => 'Income tax payable',
            '3010' => 'Share capital',
            '3020' => 'Retained Earnings',
            '3200' => 'Dividend disbursed',
            '4010' => 'Sales - retail',
            '4020' => 'Sales - wholesale',
            '5010' => 'Supplies and materials - COS',
            '5011' => 'Supplies and materials - COS',
            '5020' => 'Office/General Administrative Expenses',
            '5030' => 'Utilities',
            '5040' => 'Payroll Expenses',
            '5050' => 'Discounts given',
            '5060' => 'Supplies and materials - COS',
            '6230' => 'Other selling expenses',
        ];

        foreach ($mapping as $code => $detailType) {
            DB::table('chart_of_accounts')
                ->where('code', $code)
                ->whereNull('deleted_at')
                ->update(['detail_type' => $detailType]);
        }
    }

    public function down(): void
    {
        Schema::table('chart_of_accounts', function (Blueprint $table) {
            $table->dropColumn('detail_type');
        });
    }
};
