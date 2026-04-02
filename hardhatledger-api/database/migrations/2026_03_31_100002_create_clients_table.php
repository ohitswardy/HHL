<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->string('business_name');
            $table->string('contact_person')->nullable();
            $table->string('phone')->nullable();
            $table->text('address')->nullable();
            $table->string('email')->nullable();
            $table->foreignId('client_tier_id')->constrained('client_tiers')->restrictOnDelete();
            $table->decimal('credit_limit', 14, 2)->default(0);
            $table->decimal('outstanding_balance', 14, 2)->default(0);
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('branch_id')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('business_name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clients');
    }
};
