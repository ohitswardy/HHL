<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add 'business_bank' to payments.payment_method enum
        DB::statement("ALTER TABLE payments MODIFY COLUMN payment_method ENUM('cash','card','bank_transfer','check','credit','business_bank') NOT NULL DEFAULT 'cash'");

        // 2. Add payment_method to expenses table
        Schema::table('expenses', function (Blueprint $table) {
            $table->string('payment_method', 30)->default('cash')->after('notes');
        });

        // 3. Add payment_method to purchase_orders table
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('payment_method', 30)->default('cash')->after('notes');
        });
    }

    public function down(): void
    {
        // Remove business_bank from enum
        DB::statement("ALTER TABLE payments MODIFY COLUMN payment_method ENUM('cash','card','bank_transfer','check','credit') NOT NULL DEFAULT 'cash'");

        Schema::table('expenses', function (Blueprint $table) {
            $table->dropColumn('payment_method');
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn('payment_method');
        });
    }
};
