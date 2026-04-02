<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class JournalEntry extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'reference_type',
        'reference_id',
        'description',
        'date',
        'user_id',
        'branch_id',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
        ];
    }

    public function lines()
    {
        return $this->hasMany(JournalLine::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
