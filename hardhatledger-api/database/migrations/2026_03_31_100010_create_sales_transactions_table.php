<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('transaction_number')->unique();
            $table->foreignId('client_id')->nullable()->constrained('clients')->restrictOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->enum('fulfillment_type', ['delivery', 'pickup'])->default('pickup');
            $table->enum('status', ['pending', 'completed', 'voided', 'refunded'])->default('pending');
            $table->decimal('subtotal', 14, 2)->default(0);
            $table->decimal('discount_amount', 14, 2)->default(0);
            $table->decimal('tax_amount', 14, 2)->default(0);
            $table->decimal('total_amount', 14, 2)->default(0);
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('branch_id')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('transaction_number');
            $table->index('created_at');
        });

        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sales_transaction_id')->constrained('sales_transactions')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->integer('quantity');
            $table->decimal('unit_price', 14, 2);
            $table->decimal('discount', 14, 2)->default(0);
            $table->decimal('line_total', 14, 2);
            $table->timestamps();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sales_transaction_id')->constrained('sales_transactions')->cascadeOnDelete();
            $table->enum('payment_method', ['cash', 'card', 'bank_transfer', 'check', 'credit'])->default('cash');
            $table->decimal('amount', 14, 2);
            $table->string('reference_number')->nullable();
            $table->enum('status', ['pending', 'confirmed', 'failed'])->default('pending');
            $table->timestamp('paid_at')->nullable();
            $table->unsignedBigInteger('branch_id')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('sale_items');
        Schema::dropIfExists('sales_transactions');
    }
};
