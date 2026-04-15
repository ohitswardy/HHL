<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->text('value')->nullable();
            $table->string('label')->nullable();
            $table->string('description')->nullable();
            $table->timestamps();
        });

        // Seed default tax rate (stored as a percentage, e.g. 12 = 12%)
        DB::table('settings')->insert([
            'key'         => 'tax_rate',
            'value'       => '12',
            'label'       => 'VAT / Sales Tax Rate',
            'description' => 'Applied to VATable sales and purchases. Enter as a whole number (e.g. 12 for 12%).',
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
