<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesTransaction extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'transaction_number',
        'client_id',
        'user_id',
        'fulfillment_type',
        'status',
        'subtotal',
        'discount_amount',
        'delivery_fee',
        'tax_amount',
        'total_amount',
        'notes',
        'branch_id',
    ];

    protected function casts(): array
    {
        return [
            'subtotal'       => 'decimal:2',
            'discount_amount'=> 'decimal:2',
            'delivery_fee'   => 'decimal:2',
            'tax_amount'     => 'decimal:2',
            'total_amount'   => 'decimal:2',
        ];
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function items()
    {
        return $this->hasMany(SaleItem::class, 'sales_transaction_id');
    }

    public function payments()
    {
        return $this->hasMany(Payment::class, 'sales_transaction_id');
    }

    public function getTotalPaidAttribute(): float
    {
        return (float) $this->payments()->where('status', 'confirmed')->sum('amount');
    }

    public function getBalanceDueAttribute(): float
    {
        return (float) $this->total_amount - $this->total_paid;
    }
}
