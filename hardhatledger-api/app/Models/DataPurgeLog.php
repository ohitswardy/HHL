<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DataPurgeLog extends Model
{
    protected $fillable = [
        'user_id',
        'branch_id',
        'purge_year',
        'purge_month',
        'sales_purged',
        'sale_items_purged',
        'payments_purged',
        'purchase_orders_purged',
        'po_items_purged',
        'journal_entries_purged',
        'journal_lines_purged',
        'expenses_purged',
        'status',
        'notes',
    ];

    protected $casts = [
        'purge_year' => 'integer',
        'purge_month' => 'integer',
        'sales_purged' => 'integer',
        'sale_items_purged' => 'integer',
        'payments_purged' => 'integer',
        'purchase_orders_purged' => 'integer',
        'po_items_purged' => 'integer',
        'journal_entries_purged' => 'integer',
        'journal_lines_purged' => 'integer',
        'expenses_purged' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class);
    }
}
