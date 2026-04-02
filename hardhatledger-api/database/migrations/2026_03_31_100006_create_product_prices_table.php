<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('client_tier_id')->constrained('client_tiers')->cascadeOnDelete();
            $table->decimal('price', 14, 2);
            $table->timestamps();

            $table->unique(['product_id', 'client_tier_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_prices');
    }
};
