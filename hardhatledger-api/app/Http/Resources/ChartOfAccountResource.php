<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ChartOfAccountResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'type' => $this->type,
            'detail_type' => $this->detail_type,
            'parent_id' => $this->parent_id,
            'is_active' => $this->is_active,
            'balance' => $this->balance,
            'children' => ChartOfAccountResource::collection($this->whenLoaded('children')),
        ];
    }
}
