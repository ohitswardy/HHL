<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('sku')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->string('unit')->default('pc');
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->decimal('cost_price', 14, 2)->default(0);
            $table->decimal('base_selling_price', 14, 2)->default(0);
            $table->integer('reorder_level')->default(0);
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('branch_id')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('name');
            $table->index('sku');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
