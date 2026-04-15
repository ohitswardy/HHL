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
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

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

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('po_number', 'like', "%{$search}%")
                  ->orWhereHas('supplier', fn ($s) => $s->where('name', 'like', "%{$search}%"));
            });
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

    public function cancel(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        if (in_array($purchaseOrder->status, ['received', 'cancelled'])) {
            return response()->json([
                'message' => 'Cannot cancel a ' . $purchaseOrder->status . ' purchase order.',
            ], 422);
        }

        $request->validate([
            'cancellation_notes' => ['nullable', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($request, $purchaseOrder) {
            $purchaseOrder->load(['items', 'supplier', 'expense']);

            // For partial POs: post journal for received items and handle linked expense
            if ($purchaseOrder->status === 'partial') {
                $receivedTotal = $purchaseOrder->items->sum(
                    fn ($item) => (float) $item->quantity_received * (float) $item->unit_cost
                );

                if ($receivedTotal > 0) {
                    // Post journal for received portion (keeps accounting correct)
                    $this->journalService->postPartialPurchaseEntry($purchaseOrder);

                    // Update linked draft expense to reflect only the received amount
                    if ($purchaseOrder->expense && $purchaseOrder->expense->status === 'draft') {
                        $purchaseOrder->expense->update([
                            'subtotal'     => $receivedTotal,
                            'total_amount' => $receivedTotal,
                            'notes'        => trim(($purchaseOrder->expense->notes ?? '') . ' [PO cancelled — partial receipt journalised]'),
                        ]);
                    } elseif (!$purchaseOrder->expense) {
                        // Auto-create a draft expense for the received portion only
                        // (pass $receivedTotal so the expense matches the journal entry,
                        //  NOT the original full PO total_amount)
                        $this->expenseService->createFromPurchaseOrder($purchaseOrder, $receivedTotal);
                    }
                }
            } else {
                // draft / sent: void any linked draft expense (nothing was received)
                if ($purchaseOrder->expense && $purchaseOrder->expense->status === 'draft') {
                    $this->expenseService->voidExpense($purchaseOrder->expense);
                }
            }

            $purchaseOrder->update([
                'status'             => 'cancelled',
                'cancelled_at'       => now(),
                'cancellation_notes' => $request->cancellation_notes,
            ]);
        });

        $purchaseOrder->load(['supplier', 'user', 'items.product']);
        return response()->json(['data' => new PurchaseOrderResource($purchaseOrder)]);
    }

    private function buildListQuery(Request $request): \Illuminate\Database\Eloquent\Builder
    {
        $query = PurchaseOrder::with(['supplier', 'user', 'items.product']);
        if ($status = $request->get('status')) { $query->where('status', $status); }
        if ($supplierId = $request->get('supplier_id')) { $query->where('supplier_id', $supplierId); }
        if ($search = $request->get('search')) {
            $query->where(fn ($q) =>
                $q->where('po_number', 'like', "%{$search}%")
                  ->orWhereHas('supplier', fn ($s) => $s->where('name', 'like', "%{$search}%"))
            );
        }
        if ($from = $request->get('from')) { $query->whereDate('created_at', '>=', $from); }
        if ($to = $request->get('to'))     { $query->whereDate('created_at', '<=', $to); }
        return $query->orderByDesc('created_at');
    }

    public function exportListPdf(Request $request): \Illuminate\Http\Response
    {
        $pos = $this->buildListQuery($request)->get();

        $pdf = Pdf::loadView('reports.purchase-orders', [
            'pos'         => $pos,
            'generatedAt' => now(),
            'filters'     => [
                'status'      => $request->get('status'),
                'supplier_id' => $request->get('supplier_id'),
                'search'      => $request->get('search'),
                'from'        => $request->get('from'),
                'to'          => $request->get('to'),
            ],
        ])->setOptions([
            'enable_php'           => true,
            'isHtml5ParserEnabled' => true,
            'isRemoteEnabled'      => false,
            'defaultFont'          => 'DejaVu Sans',
            'dpi'                  => 150,
        ])->setPaper('a4', 'landscape');

        return $pdf->download('purchase-orders-' . now()->format('Y-m-d') . '.pdf');
    }

    public function exportListCsv(Request $request): StreamedResponse
    {
        $pos = $this->buildListQuery($request)->get();
        $filename = 'purchase-orders-' . now()->format('Y-m-d') . '.csv';

        return response()->streamDownload(function () use ($pos) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['PO #', 'Supplier', 'Status', 'Items', 'Total (PHP)', 'Expected Date', 'Created Date', 'Notes']);
            foreach ($pos as $po) {
                fputcsv($handle, [
                    $po->po_number,
                    $po->supplier?->name ?? '—',
                    $po->status,
                    $po->items?->count() ?? 0,
                    number_format((float) $po->total_amount, 2, '.', ''),
                    $po->expected_date ? \Carbon\Carbon::parse($po->expected_date)->format('M d, Y') : '—',
                    \Carbon\Carbon::parse($po->created_at)->format('M d, Y'),
                    $po->notes ?? '',
                ]);
            }
            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
