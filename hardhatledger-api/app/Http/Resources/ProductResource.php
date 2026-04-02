<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'sku' => $this->sku,
            'name' => $this->name,
            'description' => $this->description,
            'category_id' => $this->category_id,
            'category' => new CategoryResource($this->whenLoaded('category')),
            'unit' => $this->unit,
            'supplier_id' => $this->supplier_id,
            'supplier' => new SupplierResource($this->whenLoaded('supplier')),
            'cost_price' => (float) $this->cost_price,
            'base_selling_price' => (float) $this->base_selling_price,
            'reorder_level' => $this->reorder_level,
            'is_active' => $this->is_active,
            'stock' => $this->whenLoaded('stock', fn () => [
                'quantity_on_hand' => $this->stock->quantity_on_hand,
                'quantity_reserved' => $this->stock->quantity_reserved,
                'available_quantity' => $this->stock->available_quantity,
            ]),
            'tier_prices' => $this->whenLoaded('tierPrices', fn () =>
                $this->tierPrices->map(fn ($tp) => [
                    'id' => $tp->id,
                    'client_tier_id' => $tp->client_tier_id,
                    'price' => (float) $tp->price,
                ])
            ),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
