<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Client extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'business_name',
        'tin',
        'contact_person',
        'phone',
        'address',
        'email',
        'client_tier_id',
        'credit_limit',
        'outstanding_balance',
        'notes',
        'branch_id',
    ];

    protected function casts(): array
    {
        return [
            'credit_limit' => 'decimal:2',
            'outstanding_balance' => 'decimal:2',
        ];
    }

    public function tier()
    {
        return $this->belongsTo(ClientTier::class, 'client_tier_id');
    }

    public function salesTransactions()
    {
        return $this->hasMany(SalesTransaction::class);
    }

    public function statements()
    {
        return $this->hasMany(ClientStatement::class);
    }

    public function scopeWithComputedBalance($query)
    {
        return $query->selectRaw(
            'clients.*, ' .
            '(SELECT COALESCE(SUM(p.amount), 0) ' .
            ' FROM payments p ' .
            ' INNER JOIN sales_transactions st ON p.sales_transaction_id = st.id ' .
            ' WHERE st.client_id = clients.id ' .
            '   AND p.status = "pending" ' .
            '   AND p.payment_method IN ("credit", "bank_transfer", "check", "business_bank") ' .
            '   AND p.deleted_at IS NULL ' .
            '   AND st.deleted_at IS NULL) as outstanding_balance'
        );
    }
}
