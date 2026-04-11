<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PurchaseOrder\ReceivePurchaseOrderRequest;
use App\Http\Requests\PurchaseOrder\StorePurchaseOrderRequest;
use App\Http\Resources\PurchaseOrderResource;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Services\ExpenseService;
use App\Services\InventoryService;
use App\Services\JournalService;
use App\Services\TransactionNumberService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseOrderController extends Controller
{
    public function __construct(
        private TransactionNumberService $transactionNumberService,
        private InventoryService $inventoryService,
        private JournalService $journalService,
        private ExpenseService $expenseService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = PurchaseOrder::with(['supplier', 'user', 'items.product']);

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($supplierId = $request->get('supplier_id')) {
            $query->where('supplier_id', $supplierId);
        }

        $pos = $query->orderByDesc('created_at')
            ->paginate($request->get('per_page', 20));

        return response()->json([
            'data' => PurchaseOrderResource::collection($pos),
            'meta' => [
                'current_page' => $pos->currentPage(),
                'last_page' => $pos->lastPage(),
                'per_page' => $pos->perPage(),
                'total' => $pos->total(),
            ],
        ]);
    }

    public function store(StorePurchaseOrderRequest $request): JsonResponse
    {
        $po = DB::transaction(function () use ($request) {
            $totalAmount = collect($request->items)->sum(fn ($item) =>
                $item['quantity_ordered'] * $item['unit_cost']
            );

            $po = PurchaseOrder::create([
                'po_number' => $this->transactionNumberService->generatePONumber(),
                'supplier_id' => $request->supplier_id,
                'user_id' => $request->user()->id,
                'status' => 'draft',
                'total_amount' => $totalAmount,
                'expected_date' => $request->expected_date,
                'notes' => $request->notes,
                'payment_method' => $request->payment_method ?? 'cash',
            ]);

            foreach ($request->items as $item) {
                $po->items()->create([
                    'product_id' => $item['product_id'],
                    'quantity_ordered' => $item['quantity_ordered'],
                    'unit_cost' => $item['unit_cost'],
                ]);
            }

            return $po;
        });

        $po->load(['supplier', 'user', 'items.product']);
        return response()->json(['data' => new PurchaseOrderResource($po)], 201);
    }

    public function show(PurchaseOrder $purchaseOrder): JsonResponse
    {
        $purchaseOrder->load(['supplier', 'user', 'items.product']);
        return response()->json(['data' => new PurchaseOrderResource($purchaseOrder)]);
    }

    public function receive(ReceivePurchaseOrderRequest $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        DB::transaction(function () use ($request, $purchaseOrder) {
            $allReceived = true;

            foreach ($request->items as $itemData) {
                $poItem = $purchaseOrder->items()
                    ->where('product_id', $itemData['product_id'])
                    ->firstOrFail();

                $poItem->increment('quantity_received', $itemData['quantity_received']);

                $product = Product::findOrFail($itemData['product_id']);
                $this->inventoryService->adjustStock(
                    product: $product,
                    quantity: $itemData['quantity_received'],
                    type: 'in',
                    referenceType: 'purchase_order',
                    referenceId: $purchaseOrder->id,
                    unitCost: (float) $poItem->unit_cost,
                    notes: "Received from PO #{$purchaseOrder->po_number}",
                    user: $request->user(),
                );

                if ($poItem->quantity_received < $poItem->quantity_ordered) {
                    $allReceived = false;
                }
            }

            $purchaseOrder->update([
                'status' => $allReceived ? 'received' : 'partial',
                'received_date' => $allReceived ? now() : null,
            ]);

            // Post journal entry only once when fully received to avoid duplicate accounting
            if ($allReceived) {
                $this->journalService->postPurchaseEntry($purchaseOrder);
            }
        });

        // After transaction: auto-create a draft expense when fully received
        $purchaseOrder->refresh();
        if ($purchaseOrder->status === 'received') {
            $purchaseOrder->loadMissing('supplier');
            $this->expenseService->createFromPurchaseOrder($purchaseOrder);
        }

        $purchaseOrder->load(['supplier', 'user', 'items.product']);
        return response()->json(['data' => new PurchaseOrderResource($purchaseOrder)]);
    }
}
