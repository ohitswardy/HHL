<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class JournalEntryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference_type' => $this->reference_type,
            'reference_id' => $this->reference_id,
            'description' => $this->description,
            'date' => $this->date->toDateString(),
            'user' => new UserResource($this->whenLoaded('user')),
            'lines' => $this->whenLoaded('lines', fn () =>
                $this->lines->map(fn ($line) => [
                    'id' => $line->id,
                    'account_id' => $line->account_id,
                    'account' => $line->account ? [
                        'id' => $line->account->id,
                        'code' => $line->account->code,
                        'name' => $line->account->name,
                    ] : null,
                    'debit' => (float) $line->debit,
                    'credit' => (float) $line->credit,
                ])
            ),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
