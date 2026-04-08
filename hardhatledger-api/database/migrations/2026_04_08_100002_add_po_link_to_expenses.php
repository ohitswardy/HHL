<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add 'draft' to status enum first
        DB::statement("ALTER TABLE expenses MODIFY COLUMN status ENUM('draft', 'recorded', 'voided') NOT NULL DEFAULT 'recorded'");

        Schema::table('expenses', function (Blueprint $table) {
            $table->foreignId('purchase_order_id')
                ->nullable()
                ->after('branch_id')
                ->constrained('purchase_orders')
                ->nullOnDelete();
            $table->string('source', 20)->default('manual')->after('purchase_order_id');
        });
    }

    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropForeign(['purchase_order_id']);
            $table->dropColumn(['purchase_order_id', 'source']);
        });

        DB::statement("ALTER TABLE expenses MODIFY COLUMN status ENUM('recorded', 'voided') NOT NULL DEFAULT 'recorded'");
    }
};
