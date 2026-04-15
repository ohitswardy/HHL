<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PurchaseOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $items = $this->whenLoaded('items', fn () =>
            $this->items->map(fn ($item) => [
                'id'                => $item->id,
                'product_id'        => $item->product_id,
                'product'           => $item->product ? [
                    'id'   => $item->product->id,
                    'name' => $item->product->name,
                    'sku'  => $item->product->sku,
                ] : null,
                'quantity_ordered'  => $item->quantity_ordered,
                'quantity_received' => $item->quantity_received,
                'unit_cost'         => (float) $item->unit_cost,
            ])
        );

        // Compute received / cancelled totals from loaded items (available on list + detail)
        $receivedTotal   = null;
        $cancelledTotal  = null;
        $receivedQty     = null;
        $cancelledQty    = null;

        if ($this->relationLoaded('items')) {
            $receivedTotal  = $this->items->sum(fn ($it) => (float) $it->quantity_received * (float) $it->unit_cost);
            $cancelledTotal = $this->items->sum(fn ($it) => ((float) $it->quantity_ordered - (float) $it->quantity_received) * (float) $it->unit_cost);
            $receivedQty    = $this->items->sum(fn ($it) => (int) $it->quantity_received);
            $cancelledQty   = $this->items->sum(fn ($it) => (int) $it->quantity_ordered - (int) $it->quantity_received);
        }

        return [
            'id'                  => $this->id,
            'po_number'           => $this->po_number,
            'supplier_id'         => $this->supplier_id,
            'supplier'            => new SupplierResource($this->whenLoaded('supplier')),
            'user'                => new UserResource($this->whenLoaded('user')),
            'status'              => $this->status,
            'total_amount'        => (float) $this->total_amount,
            'expected_date'       => $this->expected_date?->toDateString(),
            'received_date'       => $this->received_date?->toDateString(),
            'cancelled_at'        => $this->cancelled_at?->toISOString(),
            'cancellation_notes'  => $this->cancellation_notes,
            'received_total'      => $receivedTotal,
            'cancelled_total'     => $cancelledTotal,
            'received_qty'        => $receivedQty,
            'cancelled_qty'       => $cancelledQty,
            'notes'               => $this->notes,
            'payment_method'      => $this->payment_method,
            'items'               => $items,
            'created_at'          => $this->created_at?->toISOString(),
        ];
    }
}
