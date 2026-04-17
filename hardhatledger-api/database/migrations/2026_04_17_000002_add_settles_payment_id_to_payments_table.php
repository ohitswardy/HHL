<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->unsignedBigInteger('settles_payment_id')->nullable()->after('notes')
                ->comment('ID of the credit payment entry this collection settles (installment link)');
            $table->foreign('settles_payment_id')->references('id')->on('payments')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['settles_payment_id']);
            $table->dropColumn('settles_payment_id');
        });
    }
};
