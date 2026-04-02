<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_stock', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->integer('quantity_on_hand')->default(0);
            $table->integer('quantity_reserved')->default(0);
            $table->unsignedBigInteger('branch_id')->nullable();
            $table->timestamps();

            $table->unique(['product_id', 'branch_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_stock');
    }
};
