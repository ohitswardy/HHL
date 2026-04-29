<?php

namespace App\Services;

use App\Models\InventoryMovement;
use App\Models\InventoryStock;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class InventoryService
{
    public function adjustStock(
        Product $product,
        int $quantity,
        string $type,
        ?string $referenceType,
        ?int $referenceId,
        ?float $unitCost,
        ?string $notes,
        User $user,
        bool $allowNegative = false,
    ): void {
        DB::transaction(function () use ($product, $quantity, $type, $referenceType, $referenceId, $unitCost, $notes, $user, $allowNegative) {
            $stock = InventoryStock::firstOrCreate(
                ['product_id' => $product->id],
                ['quantity_on_hand' => 0, 'quantity_reserved' => 0]
            );

            if ($type === 'out' && $stock->quantity_on_hand < $quantity) {
                if (! $allowNegative) {
                    throw new \RuntimeException(
                        "Insufficient stock for product [{$product->name}]. Available: {$stock->quantity_on_hand}, Requested: {$quantity}"
                    );
                }
                // Flag the movement notes so inventory module can surface the override
                $notes = trim('[STOCK OVERRIDE — sold with insufficient stock] ' . ($notes ?? ''));
            }

            InventoryMovement::create([
                'product_id' => $product->id,
                'type' => $type,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'quantity' => $quantity,
                'unit_cost' => $unitCost ?? $product->cost_price,
                'notes' => $notes,
                'user_id' => $user->id,
            ]);

            match ($type) {
                'in' => $stock->increment('quantity_on_hand', $quantity),
                'out' => $stock->decrement('quantity_on_hand', $quantity),
                'adjustment' => $stock->update(['quantity_on_hand' => $quantity]),
            };
        });
    }
}
