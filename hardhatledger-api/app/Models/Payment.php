<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Payment extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'sales_transaction_id',
        'payment_method',
        'amount',
        'reference_number',
        'status',
        'paid_at',
        'due_date',
        'notes',
        'settles_payment_id',
        'branch_id',
    ];

    protected function casts(): array
    {
        return [
            'amount'   => 'decimal:2',
            'paid_at'  => 'datetime',
            'due_date' => 'date',
        ];
    }

    public function salesTransaction()
    {
        return $this->belongsTo(SalesTransaction::class, 'sales_transaction_id');
    }
}
