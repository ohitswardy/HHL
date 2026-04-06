<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SalesTransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'transaction_number' => $this->transaction_number,
            'client_id' => $this->client_id,
            'client' => new ClientResource($this->whenLoaded('client')),
            'user_id' => $this->user_id,
            'user' => new UserResource($this->whenLoaded('user')),
            'fulfillment_type' => $this->fulfillment_type,
            'status' => $this->status,
            'subtotal'        => (float) $this->subtotal,
            'discount_amount' => (float) $this->discount_amount,
            'delivery_fee'    => (float) $this->delivery_fee,
            'tax_amount'      => (float) $this->tax_amount,
            'total_amount'    => (float) $this->total_amount,
            'total_paid' => $this->total_paid,
            'balance_due' => $this->balance_due,
            'notes' => $this->notes,
            'items' => $this->whenLoaded('items', fn () =>
                $this->items->map(fn ($item) => [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'product' => $item->product ? [
                        'id' => $item->product->id,
                        'name' => $item->product->name,
                        'sku' => $item->product->sku,
                    ] : null,
                    'quantity' => $item->quantity,
                    'unit_price' => (float) $item->unit_price,
                    'discount' => (float) $item->discount,
                    'line_total' => (float) $item->line_total,
                ])
            ),
            'payments' => $this->whenLoaded('payments', fn () =>
                $this->payments->map(fn ($p) => [
                    'id' => $p->id,
                    'payment_method' => $p->payment_method,
                    'amount' => (float) $p->amount,
                    'reference_number' => $p->reference_number,
                    'status' => $p->status,
                    'paid_at' => $p->paid_at?->toISOString(),
                ])
            ),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
