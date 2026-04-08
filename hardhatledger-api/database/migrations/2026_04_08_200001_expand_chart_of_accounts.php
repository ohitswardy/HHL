<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Rename existing accounts to match the QuickBooks / ACCOUNTING_LOGIC naming
        DB::table('chart_of_accounts')->where('code', '4010')->whereNull('deleted_at')
            ->update(['name' => 'Sales']);

        DB::table('chart_of_accounts')->where('code', '4020')->whereNull('deleted_at')
            ->update(['name' => 'Sales (VATable / NonVAT)']);

        DB::table('chart_of_accounts')->where('code', '5010')->whereNull('deleted_at')
            ->update(['name' => 'COGS VATable']);

        // Add VAT Payable (Output VAT) — liability account
        $liabParent = DB::table('chart_of_accounts')
            ->where('code', '2000')->whereNull('deleted_at')->first();

        if ($liabParent && !DB::table('chart_of_accounts')->where('code', '2100')->whereNull('deleted_at')->exists()) {
            DB::table('chart_of_accounts')->insert([
                'code'      => '2100',
                'name'      => 'VAT Payable',
                'type'      => 'liability',
                'parent_id' => $liabParent->id,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Add Reconciliation Discrepancies expense account
        $expParent = DB::table('chart_of_accounts')
            ->where('code', '5000')->whereNull('deleted_at')->first();

        if ($expParent && !DB::table('chart_of_accounts')->where('code', '6230')->whereNull('deleted_at')->exists()) {
            DB::table('chart_of_accounts')->insert([
                'code'      => '6230',
                'name'      => 'Reconciliation Discrepancies',
                'type'      => 'expense',
                'parent_id' => $expParent->id,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Add Dividend Disbursed equity account
        $eqParent = DB::table('chart_of_accounts')
            ->where('code', '3000')->whereNull('deleted_at')->first();

        if ($eqParent && !DB::table('chart_of_accounts')->where('code', '3200')->whereNull('deleted_at')->exists()) {
            DB::table('chart_of_accounts')->insert([
                'code'      => '3200',
                'name'      => 'Dividend Disbursed',
                'type'      => 'equity',
                'parent_id' => $eqParent->id,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        // Revert names
        DB::table('chart_of_accounts')->where('code', '4010')->whereNull('deleted_at')
            ->update(['name' => 'Sales Revenue']);
        DB::table('chart_of_accounts')->where('code', '4020')->whereNull('deleted_at')
            ->update(['name' => 'Other Income']);
        DB::table('chart_of_accounts')->where('code', '5010')->whereNull('deleted_at')
            ->update(['name' => 'Cost of Goods Sold']);

        // Remove added accounts
        DB::table('chart_of_accounts')->where('code', '2100')->delete();
        DB::table('chart_of_accounts')->where('code', '6230')->delete();
        DB::table('chart_of_accounts')->where('code', '3200')->delete();
    }
};
