<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('data_purge_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('branch_id')->nullable();
            $table->integer('purge_year');
            $table->integer('purge_month');
            $table->unsignedInteger('sales_purged')->default(0);
            $table->unsignedInteger('sale_items_purged')->default(0);
            $table->unsignedInteger('payments_purged')->default(0);
            $table->unsignedInteger('purchase_orders_purged')->default(0);
            $table->unsignedInteger('po_items_purged')->default(0);
            $table->unsignedInteger('journal_entries_purged')->default(0);
            $table->unsignedInteger('journal_lines_purged')->default(0);
            $table->unsignedInteger('expenses_purged')->default(0);
            $table->string('status')->default('completed'); // completed, failed
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users');
            $table->index(['purge_year', 'purge_month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('data_purge_logs');
    }
};
