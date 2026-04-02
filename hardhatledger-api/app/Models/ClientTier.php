<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ClientTier extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'discount_percent',
        'markup_percent',
        'description',
        'branch_id',
    ];

    protected function casts(): array
    {
        return [
            'discount_percent' => 'decimal:2',
            'markup_percent' => 'decimal:2',
        ];
    }

    public function clients()
    {
        return $this->hasMany(Client::class);
    }

    public function productPrices()
    {
        return $this->hasMany(ProductPrice::class);
    }
}
