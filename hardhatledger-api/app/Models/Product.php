<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'sku',
        'name',
        'description',
        'category_id',
        'unit',
        'supplier_id',
        'cost_price',
        'base_selling_price',
        'reorder_level',
        'is_active',
        'branch_id',
    ];

    protected function casts(): array
    {
        return [
            'cost_price' => 'decimal:2',
            'base_selling_price' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function tierPrices()
    {
        return $this->hasMany(ProductPrice::class);
    }

    public function stock()
    {
        return $this->hasOne(InventoryStock::class);
    }

    public function movements()
    {
        return $this->hasMany(InventoryMovement::class);
    }
}
