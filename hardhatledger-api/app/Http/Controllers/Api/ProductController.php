<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Product\StoreProductRequest;
use App\Http\Requests\Product\UpdateProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Client;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Services\PricingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function __construct(private PricingService $pricingService) {}

    public function index(Request $request): JsonResponse
    {
        $query = Product::with(['category', 'supplier', 'stock', 'tierPrices']);

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%");
            });
        }

        if ($categoryId = $request->get('category_id')) {
            $query->where('category_id', $categoryId);
        }

        if ($supplierId = $request->get('supplier_id')) {
            $query->where('supplier_id', $supplierId);
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $products = $query->orderBy('name')->paginate($request->get('per_page', 20));

        return response()->json([
            'data' => ProductResource::collection($products),
            'meta' => [
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
                'per_page' => $products->perPage(),
                'total' => $products->total(),
            ],
        ]);
    }

    public function store(StoreProductRequest $request): JsonResponse
    {
        $product = Product::create($request->validated());

        if ($request->has('tier_prices')) {
            foreach ($request->tier_prices as $tp) {
                ProductPrice::create([
                    'product_id' => $product->id,
                    'client_tier_id' => $tp['client_tier_id'],
                    'price' => $tp['price'],
                ]);
            }
        }

        $product->load(['category', 'supplier', 'stock', 'tierPrices']);
        return response()->json(['data' => new ProductResource($product)], 201);
    }

    public function show(Product $product): JsonResponse
    {
        $product->load(['category', 'supplier', 'stock', 'tierPrices']);
        return response()->json(['data' => new ProductResource($product)]);
    }

    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
        $product->update($request->validated());

        if ($request->has('tier_prices')) {
            $product->tierPrices()->delete();
            foreach ($request->tier_prices as $tp) {
                ProductPrice::create([
                    'product_id' => $product->id,
                    'client_tier_id' => $tp['client_tier_id'],
                    'price' => $tp['price'],
                ]);
            }
        }

        $product->load(['category', 'supplier', 'stock', 'tierPrices']);
        return response()->json(['data' => new ProductResource($product)]);
    }

    public function destroy(Product $product): JsonResponse
    {
        $product->delete();
        return response()->json(null, 204);
    }

    public function getPrice(Product $product, Request $request): JsonResponse
    {
        $client = $request->has('client_id')
            ? Client::findOrFail($request->client_id)
            : null;

        $price = $this->pricingService->resolvePrice($product, $client);

        return response()->json(['price' => $price]);
    }
}
