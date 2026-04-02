<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_tiers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->decimal('discount_percent', 5, 2)->default(0);
            $table->decimal('markup_percent', 5, 2)->default(0);
            $table->text('description')->nullable();
            $table->unsignedBigInteger('branch_id')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_tiers');
    }
};
