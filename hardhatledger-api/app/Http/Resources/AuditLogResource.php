<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuditLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'user'       => $this->user ? [
                'id'   => $this->user->id,
                'name' => $this->user->name,
            ] : null,
            'action'     => $this->action,
            'table_name' => $this->table_name,
            'record_id'  => $this->record_id,
            'old_value'  => $this->old_value,
            'new_value'  => $this->new_value,
            'ip_address' => $this->ip_address,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
