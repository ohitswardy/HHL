<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryStock extends Model
{
    protected $table = 'inventory_stock';

    protected $fillable = [
        'product_id',
        'quantity_on_hand',
        'quantity_reserved',
        'branch_id',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function getAvailableQuantityAttribute(): int
    {
        return $this->quantity_on_hand - $this->quantity_reserved;
    }
}
