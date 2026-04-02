<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClientStatement extends Model
{
    protected $fillable = [
        'client_id',
        'period_start',
        'period_end',
        'opening_balance',
        'total_charges',
        'total_payments',
        'closing_balance',
        'branch_id',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'opening_balance' => 'decimal:2',
            'total_charges' => 'decimal:2',
            'total_payments' => 'decimal:2',
            'closing_balance' => 'decimal:2',
        ];
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }
}
