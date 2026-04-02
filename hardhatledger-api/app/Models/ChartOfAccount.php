<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ChartOfAccount extends Model
{
    use SoftDeletes;

    protected $table = 'chart_of_accounts';

    protected $fillable = [
        'code',
        'name',
        'type',
        'parent_id',
        'is_active',
        'branch_id',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function parent()
    {
        return $this->belongsTo(ChartOfAccount::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(ChartOfAccount::class, 'parent_id');
    }

    public function journalLines()
    {
        return $this->hasMany(JournalLine::class, 'account_id');
    }

    public function getBalanceAttribute(): float
    {
        $debits = (float) $this->journalLines()->sum('debit');
        $credits = (float) $this->journalLines()->sum('credit');

        return in_array($this->type, ['asset', 'expense'])
            ? $debits - $credits
            : $credits - $debits;
    }
}
