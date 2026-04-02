<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientTierResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'discount_percent' => (float) $this->discount_percent,
            'markup_percent' => (float) $this->markup_percent,
            'description' => $this->description,
        ];
    }
}
