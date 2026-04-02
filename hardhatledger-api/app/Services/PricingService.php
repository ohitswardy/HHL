<?php

namespace App\Services;

use App\Models\Client;
use App\Models\Product;

class PricingService
{
    public function resolvePrice(Product $product, ?Client $client): float
    {
        if ($client && $client->client_tier_id) {
            $tierPrice = $product->tierPrices()
                ->where('client_tier_id', $client->client_tier_id)
                ->first();

            if ($tierPrice) {
                return (float) $tierPrice->price;
            }
        }

        return (float) $product->base_selling_price;
    }
}
