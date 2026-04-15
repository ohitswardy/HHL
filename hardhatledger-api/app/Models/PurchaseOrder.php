<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseOrder extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'po_number',
        'supplier_id',
        'user_id',
        'status',
        'total_amount',
        'expected_date',
        'received_date',
        'cancelled_at',
        'cancellation_notes',
        'notes',
        'payment_method',
        'branch_id',
    ];

    protected function casts(): array
    {
        return [
            'total_amount' => 'decimal:2',
            'expected_date' => 'date',
            'received_date' => 'date',
            'cancelled_at' => 'datetime',
        ];
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function items()
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    public function expense()
    {
        return $this->hasOne(\App\Models\Expense::class, 'purchase_order_id');
    }
}
