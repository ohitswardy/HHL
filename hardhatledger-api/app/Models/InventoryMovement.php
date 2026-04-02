<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryMovement extends Model
{
    protected $fillable = [
        'product_id',
        'type',
        'reference_type',
        'reference_id',
        'quantity',
        'unit_cost',
        'notes',
        'user_id',
        'branch_id',
    ];

    protected function casts(): array
    {
        return [
            'unit_cost' => 'decimal:2',
        ];
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
