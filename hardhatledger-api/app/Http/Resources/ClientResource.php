<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'business_name' => $this->business_name,
            'tin' => $this->tin,
            'contact_person' => $this->contact_person,
            'phone' => $this->phone,
            'address' => $this->address,
            'email' => $this->email,
            'client_tier_id' => $this->client_tier_id,
            'tier' => new ClientTierResource($this->whenLoaded('tier')),
            'credit_limit' => (float) $this->credit_limit,
            'outstanding_balance' => (float) $this->outstanding_balance,
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
