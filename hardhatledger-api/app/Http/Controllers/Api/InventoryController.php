<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\AdjustStockRequest;
use App\Http\Resources\InventoryMovementResource;
use App\Http\Resources\ProductResource;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    public function __construct(private InventoryService $inventoryService) {}

    public function index(Request $request): JsonResponse
    {
        $query = Product::with(['category', 'stock'])
            ->where('is_active', true);

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%");
            });
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

    public function movements(Request $request): JsonResponse
    {
        $query = InventoryMovement::with(['product', 'user']);

        if ($productId = $request->get('product_id')) {
            $query->where('product_id', $productId);
        }

        if ($type = $request->get('type')) {
            $query->where('type', $type);
        }

        if ($from = $request->get('from')) {
            $query->whereDate('created_at', '>=', $from);
        }

        if ($to = $request->get('to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        $movements = $query->orderByDesc('created_at')
            ->paginate($request->get('per_page', 20));

        return response()->json([
            'data' => InventoryMovementResource::collection($movements),
            'meta' => [
                'current_page' => $movements->currentPage(),
                'last_page' => $movements->lastPage(),
                'per_page' => $movements->perPage(),
                'total' => $movements->total(),
            ],
        ]);
    }

    public function adjustStock(AdjustStockRequest $request): JsonResponse
    {
        $product = Product::findOrFail($request->product_id);

        $this->inventoryService->adjustStock(
            product: $product,
            quantity: $request->quantity,
            type: $request->type,
            referenceType: 'manual_adjustment',
            referenceId: null,
            unitCost: $request->unit_cost,
            notes: $request->notes,
            user: $request->user(),
        );

        $product->load('stock');
        return response()->json(['data' => new ProductResource($product)]);
    }

    public function lowStock(): JsonResponse
    {
        $products = Product::with(['category', 'stock', 'supplier'])
            ->where('is_active', true)
            ->whereHas('stock', function ($q) {
                $q->whereRaw('quantity_on_hand <= (SELECT reorder_level FROM products WHERE products.id = inventory_stock.product_id)');
            })
            ->orWhere(function ($q) {
                $q->where('is_active', true)
                   ->doesntHave('stock');
            })
            ->orderBy('name')
            ->get();

        return response()->json(['data' => ProductResource::collection($products)]);
    }
}
