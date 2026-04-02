<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Sale\StoreSaleRequest;
use App\Http\Resources\SalesTransactionResource;
use App\Models\Client;
use App\Models\Product;
use App\Models\SalesTransaction;
use App\Services\InventoryService;
use App\Services\JournalService;
use App\Services\PricingService;
use App\Services\TransactionNumberService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class PosController extends Controller
{
    public function __construct(
        private TransactionNumberService $transactionNumberService,
        private PricingService $pricingService,
        private InventoryService $inventoryService,
        private JournalService $journalService,
    ) {}

    public function createSale(StoreSaleRequest $request): JsonResponse
    {
        $sale = DB::transaction(function () use ($request) {
            $client = $request->client_id ? Client::find($request->client_id) : null;
            $subtotal = 0;
            $discountAmount = 0;

            // Calculate item totals
            $itemsData = [];
            foreach ($request->items as $item) {
                $product = Product::findOrFail($item['product_id']);
                $unitPrice = $this->pricingService->resolvePrice($product, $client);
                $itemDiscount = $item['discount'] ?? 0;
                $lineTotal = ($unitPrice * $item['quantity']) - $itemDiscount;

                $itemsData[] = [
                    'product_id' => $product->id,
                    'quantity' => $item['quantity'],
                    'unit_price' => $unitPrice,
                    'discount' => $itemDiscount,
                    'line_total' => $lineTotal,
                ];

                $subtotal += $unitPrice * $item['quantity'];
                $discountAmount += $itemDiscount;
            }

            $totalAmount = $subtotal - $discountAmount;

            // Create transaction
            $sale = SalesTransaction::create([
                'transaction_number' => $this->transactionNumberService->generateSaleNumber(),
                'client_id' => $client?->id,
                'user_id' => $request->user()->id,
                'fulfillment_type' => $request->fulfillment_type ?? 'pickup',
                'status' => 'completed',
                'subtotal' => $subtotal,
                'discount_amount' => $discountAmount,
                'tax_amount' => 0,
                'total_amount' => $totalAmount,
                'notes' => $request->notes,
            ]);

            // Create sale items
            foreach ($itemsData as $itemData) {
                $sale->items()->create($itemData);
            }

            // Process payments
            $paymentStatus = 'confirmed';
            foreach ($request->payments as $payment) {
                $method = $payment['payment_method'];
                if ($method === 'credit') {
                    $paymentStatus = 'pending';
                }

                $sale->payments()->create([
                    'payment_method' => $method,
                    'amount' => $payment['amount'],
                    'reference_number' => $payment['reference_number'] ?? null,
                    'status' => $method === 'credit' ? 'pending' : 'confirmed',
                    'paid_at' => $method === 'credit' ? null : now(),
                ]);
            }

            // If credit sale, update client outstanding balance
            $creditAmount = collect($request->payments)
                ->where('payment_method', 'credit')
                ->sum('amount');

            if ($creditAmount > 0 && $client) {
                $client->increment('outstanding_balance', $creditAmount);
            }

            // Deduct inventory
            foreach ($itemsData as $itemData) {
                $product = Product::find($itemData['product_id']);
                $this->inventoryService->adjustStock(
                    product: $product,
                    quantity: $itemData['quantity'],
                    type: 'out',
                    referenceType: 'sale',
                    referenceId: $sale->id,
                    unitCost: $product->cost_price,
                    notes: "Sale #{$sale->transaction_number}",
                    user: $request->user(),
                );
            }

            // Post journal entry
            $this->journalService->postSaleEntry($sale);

            return $sale;
        });

        $sale->load(['client.tier', 'user', 'items.product', 'payments']);
        return response()->json(['data' => new SalesTransactionResource($sale)], 201);
    }

    public function show(SalesTransaction $sale): JsonResponse
    {
        $sale->load(['client.tier', 'user', 'items.product', 'payments']);
        return response()->json(['data' => new SalesTransactionResource($sale)]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = SalesTransaction::with(['client', 'user', 'payments']);

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($from = $request->get('from')) {
            $query->whereDate('created_at', '>=', $from);
        }

        if ($to = $request->get('to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        if ($clientId = $request->get('client_id')) {
            $query->where('client_id', $clientId);
        }

        $transactions = $query->orderByDesc('created_at')
            ->paginate($request->get('per_page', 20));

        return response()->json([
            'data' => SalesTransactionResource::collection($transactions),
            'meta' => [
                'current_page' => $transactions->currentPage(),
                'last_page' => $transactions->lastPage(),
                'per_page' => $transactions->perPage(),
                'total' => $transactions->total(),
            ],
        ]);
    }

    public function voidSale(SalesTransaction $sale): JsonResponse
    {
        if ($sale->status === 'voided') {
            return response()->json(['message' => 'Transaction already voided.'], 422);
        }

        DB::transaction(function () use ($sale) {
            $sale->load('items.product');

            // Reverse inventory
            foreach ($sale->items as $item) {
                $this->inventoryService->adjustStock(
                    product: $item->product,
                    quantity: $item->quantity,
                    type: 'in',
                    referenceType: 'sale_void',
                    referenceId: $sale->id,
                    unitCost: $item->product->cost_price,
                    notes: "Void of sale #{$sale->transaction_number}",
                    user: auth()->user(),
                );
            }

            // Reverse client outstanding balance if credit
            if ($sale->client_id) {
                $creditAmount = $sale->payments()
                    ->where('payment_method', 'credit')
                    ->sum('amount');
                if ($creditAmount > 0) {
                    $sale->client->decrement('outstanding_balance', $creditAmount);
                }
            }

            // Reverse journal entry
            $this->journalService->reverseSaleEntry($sale);

            $sale->update(['status' => 'voided']);
        });

        $sale->load(['client.tier', 'user', 'items.product', 'payments']);
        return response()->json(['data' => new SalesTransactionResource($sale)]);
    }

    public function dailySummary(Request $request): JsonResponse
    {
        $date = $request->get('date', now()->toDateString());

        $sales = SalesTransaction::whereDate('created_at', $date)
            ->where('status', 'completed')
            ->get();

        $totalSales = $sales->sum('total_amount');
        $totalDiscount = $sales->sum('discount_amount');
        $transactionCount = $sales->count();

        $byPaymentMethod = DB::table('payments')
            ->join('sales_transactions', 'payments.sales_transaction_id', '=', 'sales_transactions.id')
            ->whereDate('sales_transactions.created_at', $date)
            ->where('sales_transactions.status', 'completed')
            ->where('payments.status', 'confirmed')
            ->select('payments.payment_method', DB::raw('SUM(payments.amount) as total'))
            ->groupBy('payments.payment_method')
            ->get();

        return response()->json([
            'date' => $date,
            'total_sales' => (float) $totalSales,
            'total_discount' => (float) $totalDiscount,
            'transaction_count' => $transactionCount,
            'by_payment_method' => $byPaymentMethod,
        ]);
    }

    public function receipt(SalesTransaction $sale): Response
    {
        $sale->load(['client.tier', 'user', 'items.product', 'payments']);

        $pdf = Pdf::loadView('receipts.sale', [
            'sale' => $sale,
        ]);

        $pdf->setPaper([0, 0, 226.77, 600], 'portrait'); // 80mm thermal receipt

        return $pdf->download("receipt-{$sale->transaction_number}.pdf");
    }
}
