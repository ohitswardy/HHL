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
use Illuminate\Validation\Rule;

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

            $deliveryFee = $request->fulfillment_type === 'delivery'
                ? (float) ($request->delivery_fee ?? 0)
                : 0;
            // tax_amount is VAT-inclusive (already inside the price), not additive
            $taxAmount   = (float) ($request->tax_amount ?? 0);
            $totalAmount = $subtotal - $discountAmount + $deliveryFee;

            // Determine sale status: pending if any payments are deferred
            // business_bank is deferred — it requires confirmation that the cheque/transfer was received
            $methods = collect($request->payments)->pluck('payment_method');
            $hasImmediateMethod = $methods->intersect(['cash', 'card'])->isNotEmpty();
            $hasDeferredMethod  = $methods->intersect(['bank_transfer', 'check', 'credit', 'business_bank'])->isNotEmpty();
            $saleStatus = $hasDeferredMethod ? 'pending' : 'completed';

            // Create transaction
            $sale = SalesTransaction::create([
                'transaction_number' => $this->transactionNumberService->generateSaleNumber(),
                'client_id'          => $client?->id,
                'user_id'            => $request->user()->id,
                'fulfillment_type'   => $request->fulfillment_type ?? 'pickup',
                'status'             => $saleStatus,
                'subtotal'           => $subtotal,
                'discount_amount'    => $discountAmount,
                'delivery_fee'       => $deliveryFee,
                'tax_amount'         => $taxAmount,
                'total_amount'       => $totalAmount,
                'notes'              => $request->notes,
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

                // business_bank is also deferred — awaiting bank confirmation of cheque/transfer
                $isPending = in_array($method, ['credit', 'bank_transfer', 'check', 'business_bank']);
                $sale->payments()->create([
                    'payment_method'   => $method,
                    'amount'           => $payment['amount'],
                    'reference_number' => $payment['reference_number'] ?? null,
                    'status'           => $isPending ? 'pending' : 'confirmed',
                    'paid_at'          => $isPending ? null : now(),
                    'due_date'         => $payment['due_date'] ?? null,
                ]);
            }

            // Track outstanding balance for all deferred payment methods (incl. business_bank)
            $pendingAmount = collect($request->payments)
                ->whereIn('payment_method', ['credit', 'bank_transfer', 'check', 'business_bank'])
                ->sum('amount');

            if ($pendingAmount > 0 && $client) {
                $client->increment('outstanding_balance', $pendingAmount);
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

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('transaction_number', 'like', "%{$search}%")
                  ->orWhereHas('client', fn ($q2) => $q2->where('business_name', 'like', "%{$search}%"));
            });
        }

        if ($fulfillmentType = $request->get('fulfillment_type')) {
            $query->where('fulfillment_type', $fulfillmentType);
        }

        if ($paymentMethod = $request->get('payment_method')) {
            $query->whereHas('payments', fn ($q) => $q->where('payment_method', $paymentMethod));
        }

        if ($request->boolean('overdue')) {
            $today = now()->toDateString();
            $query->whereHas('payments', function ($q) use ($today) {
                $q->where('payment_method', 'credit')
                  ->where('status', 'pending')
                  ->whereDate('due_date', '<', $today);
            });
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

            // Reverse client outstanding balance — use balance_due (total minus confirmed
            // payments) so we only reverse what hasn't already been reconciled by
            // recordPayment or markCompleted.  This avoids double-decrements.
            if ($sale->client_id) {
                $remainingBalance = max(0, (float) $sale->balance_due);
                if ($remainingBalance > 0) {
                    $sale->client->decrement('outstanding_balance', $remainingBalance);
                }
            }

            // Reverse journal entry
            $this->journalService->reverseSaleEntry($sale);

            $sale->update(['status' => 'voided']);
        });

        $sale->load(['client.tier', 'user', 'items.product', 'payments']);
        return response()->json(['data' => new SalesTransactionResource($sale)]);
    }

    public function markCompleted(SalesTransaction $sale): JsonResponse
    {
        if ($sale->status !== 'pending') {
            return response()->json(['message' => 'Only pending transactions can be marked as completed.'], 422);
        }

        // Capture ALL pending deferred payments BEFORE bulk-confirming, so we can post their journal entries
        $pendingDeferredPayments = $sale->payments()
            ->where('status', 'pending')
            ->whereIn('payment_method', ['credit', 'bank_transfer', 'check', 'business_bank'])
            ->get();

        $sale->update(['status' => 'completed']);
        $sale->payments()
            ->where('status', 'pending')
            ->whereIn('payment_method', ['bank_transfer', 'check', 'credit', 'business_bank'])
            ->update(['status' => 'confirmed', 'paid_at' => now()]);

        // Post DR Cash/Bank / CR AR for each confirmed deferred payment.
        // Skip credit-method rows — they are AR placeholders whose journal entry was
        // already created in postSaleEntry (DR AR). Actual cash receipt is posted by
        // postPaymentEntry when the real cash/check payment is recorded via recordPayment.
        foreach ($pendingDeferredPayments as $deferredPayment) {
            if ($deferredPayment->payment_method === 'credit') {
                continue;
            }
            $deferredPayment->refresh();
            $this->journalService->postPaymentEntry($deferredPayment);
        }

        // Decrement outstanding balance only for the payments that were PENDING before
        // this call. Using the pre-captured collection avoids double-decrementing amounts
        // that recordPayment already decremented (for confirmed cash/card collections).
        if ($sale->client_id) {
            $sale->load('client');
            $amountBeingConfirmed = $pendingDeferredPayments->sum('amount');
            if ($amountBeingConfirmed > 0) {
                $sale->client->decrement('outstanding_balance', $amountBeingConfirmed);
            }
        }

        $sale->load(['client.tier', 'user', 'items.product', 'payments']);
        return response()->json(['data' => new SalesTransactionResource($sale)]);
    }

    public function recordPayment(Request $request, SalesTransaction $sale): JsonResponse
    {
        if ($sale->status === 'voided') {
            return response()->json(['message' => 'Cannot record payment on a voided transaction.'], 422);
        }

        if ($sale->status === 'completed') {
            return response()->json(['message' => 'Transaction is already fully paid.'], 422);
        }

        $request->validate([
            'payment_method'   => ['required', 'in:cash,card,bank_transfer,check,business_bank'],
            'amount'           => ['required', 'numeric', 'min:0.01'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'notes'            => ['nullable', 'string', 'max:500'],
            'target_payment_id' => ['nullable', 'integer'],
        ]);

        $balanceDue = $sale->balance_due;

        if ($request->amount > $balanceDue + 0.01) {
            return response()->json(['message' => "Payment amount exceeds balance due (₱" . number_format($balanceDue, 2) . ")."], 422);
        }

        // Validate target_payment_id if provided
        $targetCreditPayment = null;
        if ($request->filled('target_payment_id')) {
            $targetCreditPayment = $sale->payments()
                ->where('id', $request->target_payment_id)
                ->where('payment_method', 'credit')
                ->where('status', 'pending')
                ->first();

            if (!$targetCreditPayment) {
                return response()->json(['message' => 'Target installment not found or already settled.'], 422);
            }
        }

        DB::transaction(function () use ($request, $sale, $balanceDue, $targetCreditPayment) {
            $isPending = in_array($request->payment_method, ['bank_transfer', 'check', 'business_bank']);

            // Create the new payment record
            $payment = $sale->payments()->create([
                'payment_method'   => $request->payment_method,
                'amount'           => $request->amount,
                'reference_number' => $request->reference_number,
                'notes'            => $request->notes,
                'status'           => $isPending ? 'pending' : 'confirmed',
                'paid_at'          => $isPending ? null : now(),
                'branch_id'        => $sale->branch_id ?? 1,
            ]);

            // Post journal entry for confirmed payments (DR Cash/Bank, CR AR)
            if (!$isPending) {
                $this->journalService->postPaymentEntry($payment);
            }

            // Mark the targeted credit installment as confirmed (settled)
            if ($targetCreditPayment) {
                $targetCreditPayment->update([
                    'status'  => 'confirmed',
                    'paid_at' => now(),
                ]);
                // Link the collected payment back to the installment it settles
                $payment->update(['settles_payment_id' => $targetCreditPayment->id]);
            }

            // Decrement outstanding balance only for payments confirmed immediately (cash/card).
            // Pending payments (check, bank_transfer, business_bank) are decremented later
            // when markCompleted confirms them. This prevents double-decrementing.
            if ($sale->client_id && !$isPending) {
                $sale->load('client');
                $sale->client->decrement('outstanding_balance', min($request->amount, $balanceDue));
            }

            // Refresh to recalculate balance_due
            $sale->refresh();

            // Auto-complete if the real (non-credit) payments now cover the full amount
            if ($sale->balance_due <= 0.01) {
                $sale->update(['status' => 'completed']);
                // Note: pending credit payments are intentionally left as-is.
                // They are AR tracking entries — the new cash/card payment is the actual receipt.
            }
        });

        $sale->load(['client.tier', 'user', 'items.product', 'payments']);
        return response()->json(['data' => new SalesTransactionResource($sale)]);
    }

    public function updateCreditDueDate(Request $request, SalesTransaction $sale): JsonResponse
    {
        if ($sale->status === 'voided') {
            return response()->json(['message' => 'Cannot update a voided transaction.'], 422);
        }

        $request->validate([
            'payment_id' => ['required', 'integer'],
            'due_date'   => ['required', 'date'],
        ]);

        $payment = $sale->payments()
            ->where('id', $request->payment_id)
            ->where('payment_method', 'credit')
            ->where('status', 'pending')
            ->first();

        if (!$payment) {
            return response()->json(['message' => 'Credit payment not found or already settled.'], 422);
        }

        $payment->update(['due_date' => $request->due_date]);

        $sale->load(['client.tier', 'user', 'items.product', 'payments']);
        return response()->json(['data' => new SalesTransactionResource($sale)]);
    }

    public function updateTransactionNumber(Request $request, SalesTransaction $sale): JsonResponse
    {
        if ($sale->status === 'voided') {
            return response()->json(['message' => 'Voided transactions cannot be edited.'], 422);
        }

        $request->validate([
            'transaction_number' => [
                'required',
                'string',
                'max:100',
                Rule::unique('sales_transactions', 'transaction_number')
                    ->ignore($sale->id)
                    ->whereNull('deleted_at'),
            ],
        ]);

        $sale->update(['transaction_number' => $request->transaction_number]);

        $sale->load(['client.tier', 'user', 'items.product', 'payments']);
        return response()->json(['data' => new SalesTransactionResource($sale)]);
    }

    public function updateSale(Request $request, SalesTransaction $sale): JsonResponse
    {
        if ($sale->status === 'voided') {
            return response()->json(['message' => 'Voided transactions cannot be edited.'], 422);
        }

        $request->validate([
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['sometimes', 'array', 'min:1'],
            'items.*.id'         => ['required_with:items', 'integer'],
            'items.*.unit_price' => ['required_with:items', 'numeric', 'min:0'],
            'items.*.discount'   => ['required_with:items', 'numeric', 'min:0'],
        ]);

        DB::transaction(function () use ($request, $sale) {
            $originalTotal = (float) $sale->total_amount;

            if ($request->has('items')) {
                $sale->load('items');
                $subtotal       = 0;
                $discountAmount = 0;

                foreach ($request->items as $itemData) {
                    $item = $sale->items->firstWhere('id', $itemData['id']);
                    if (!$item) continue;

                    $unitPrice = (float) $itemData['unit_price'];
                    $discount  = (float) $itemData['discount'];
                    $lineTotal = max(0, ($unitPrice * $item->quantity) - $discount);

                    $item->update([
                        'unit_price' => $unitPrice,
                        'discount'   => $discount,
                        'line_total' => $lineTotal,
                    ]);

                    $subtotal       += $unitPrice * $item->quantity;
                    $discountAmount += $discount;
                }

                $newTotal = max(0, $subtotal - $discountAmount + (float) $sale->delivery_fee);

                $sale->update([
                    'notes'           => $request->notes,
                    'subtotal'        => $subtotal,
                    'discount_amount' => $discountAmount,
                    'total_amount'    => $newTotal,
                ]);

                // If sale total changed, reverse the original journal entry and post a fresh one
                if (abs($newTotal - $originalTotal) >= 0.01) {
                    $this->journalService->reverseSaleEntry($sale);
                    $sale->refresh()->load('items.product', 'payments');
                    $this->journalService->postSaleEntry($sale);
                }
            } else {
                // Notes-only update — no financial impact
                $sale->update(['notes' => $request->notes]);
            }
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
            ->where('payments.payment_method', '!=', 'credit') // credit rows are AR placeholders, not cash receipts
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

        $taxRate = (float) (\App\Models\Setting::where('key', 'tax_rate')->value('value') ?? 12);

        $pdf = Pdf::loadView('receipts.sale', [
            'sale'    => $sale,
            'taxRate' => $taxRate,
        ]);

        $pdf->setPaper([0, 0, 226.77, 600], 'portrait'); // 80mm thermal receipt

        return $pdf->download("receipt-{$sale->transaction_number}.pdf");
    }

    public function exportReport(Request $request): Response
    {
        $query = SalesTransaction::with(['client', 'user', 'items.product', 'payments']);

        $from = $request->get('from', now()->toDateString());
        $to   = $request->get('to',   now()->toDateString());

        $query->whereDate('created_at', '>=', $from)
              ->whereDate('created_at', '<=', $to);

        $status          = $request->get('status');
        $fulfillmentType = $request->get('fulfillment_type');
        $paymentMethod   = $request->get('payment_method');
        $search          = $request->get('search');

        if ($status)          $query->where('status', $status);
        if ($fulfillmentType) $query->where('fulfillment_type', $fulfillmentType);
        if ($paymentMethod)   $query->whereHas('payments', fn ($q) => $q->where('payment_method', $paymentMethod));
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('transaction_number', 'like', "%{$search}%")
                  ->orWhereHas('client', fn ($q2) => $q2->where('business_name', 'like', "%{$search}%"));
            });
        }

        $fromCarbon = \Illuminate\Support\Carbon::parse($from);
        $toCarbon   = \Illuminate\Support\Carbon::parse($to);
        $label      = $from === $to
            ? $fromCarbon->format('M j, Y')
            : $fromCarbon->format('M j, Y') . ' \u2013 ' . $toCarbon->format('M j, Y');

        $statusLabel      = $status          ? ucfirst($status)                          : 'All';
        $fulfillmentLabel = $fulfillmentType ? ucfirst($fulfillmentType)                 : 'All';
        $paymentLabel     = $paymentMethod   ? ucfirst(str_replace('_', ' ', $paymentMethod)) : 'All';

        $format  = $request->get('format', 'pdf');
        $sales   = $query->orderByDesc('created_at')->get();
        $columns = $request->has('columns') ? (array) $request->input('columns') : null;

        return match ($format) {
            'csv'   => $this->exportCsv($sales, $label, $columns),
            'xlsx'  => $this->exportXlsx($sales, $label, $columns),
            default => $this->exportPdf($sales, $label, $statusLabel, $fulfillmentLabel, $paymentLabel, $columns),
        };
    }

    private function exportCsv($sales, string $label, ?array $selectedCols = null): Response
    {
        $filename = 'transactions-' . now()->format('Y-m-d') . '.csv';

        $allCols = [
            'transaction_number' => ['header' => 'Transaction #',   'value' => fn($s) => $s->transaction_number],
            'date'               => ['header' => 'Date',            'value' => fn($s) => $s->created_at->format('Y-m-d H:i')],
            'client'             => ['header' => 'Client',          'value' => fn($s) => $s->client?->business_name ?? 'Walk-in'],
            'fulfillment_type'   => ['header' => 'Fulfillment Type','value' => fn($s) => $s->fulfillment_type],
            'status'             => ['header' => 'Status',          'value' => fn($s) => $s->status],
            'subtotal'           => ['header' => 'Subtotal',        'value' => fn($s) => number_format($s->subtotal, 2)],
            'discount'           => ['header' => 'Discount',        'value' => fn($s) => number_format($s->discount_amount, 2)],
            'total'              => ['header' => 'Total',           'value' => fn($s) => number_format($s->total_amount, 2)],
            'payment_method'     => ['header' => 'Payment Method',  'value' => fn($s) => $s->payments->pluck('payment_method')->join(', ')],
            'cashier'            => ['header' => 'Cashier',         'value' => fn($s) => $s->user?->name ?? 'Unknown'],
            'notes'              => ['header' => 'Notes',           'value' => fn($s) => $s->notes ?? ''],
        ];
        $orderedKeys = ['transaction_number','date','client','fulfillment_type','status','subtotal','discount','total','payment_method','cashier','notes'];
        $activeCols = array_filter(
            array_intersect_key($allCols, array_flip($orderedKeys)),
            fn($key) => $selectedCols === null || in_array($key, $selectedCols),
            ARRAY_FILTER_USE_KEY
        );

        $handle = fopen('php://memory', 'r+');
        fputcsv($handle, array_column($activeCols, 'header'));

        foreach ($sales as $sale) {
            fputcsv($handle, array_map(fn($col) => ($col['value'])($sale), $activeCols));
        }

        // Summary rows — voided transactions are listed above but excluded from totals
        $activeSales  = $sales->reject(fn ($s) => $s->status === 'voided');
        $voidedCount  = $sales->count() - $activeSales->count();
        fputcsv($handle, []);
        $totalsRow = array_map(function ($key, $col) use ($activeSales) {
            return match ($key) {
                'transaction_number' => 'TOTALS (voided excluded)',
                'subtotal'           => number_format($activeSales->sum('subtotal'), 2),
                'discount'           => number_format($activeSales->sum('discount_amount'), 2),
                'total'              => number_format($activeSales->sum('total_amount'), 2),
                default              => '',
            };
        }, array_keys($activeCols), $activeCols);
        fputcsv($handle, $totalsRow);
        if ($voidedCount > 0) {
            fputcsv($handle, ["Note: {$voidedCount} voided transaction(s) listed above are excluded from the totals row"]);
        }

        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        return response($csv, 200)
            ->header('Content-Type', 'text/csv; charset=utf-8')
            ->header('Content-Disposition', "attachment; filename=\"$filename\"");
    }

    private function exportXlsx($sales, string $label, ?array $selectedCols = null): Response
    {
        $filename = 'transactions-' . now()->format('Y-m-d') . '.xlsx';

        $allColDefs = [
            'transaction_number' => ['header' => 'Transaction #',    'value' => fn($s) => $s->transaction_number,                                   'numeric' => false],
            'date'               => ['header' => 'Date',             'value' => fn($s) => $s->created_at->format('Y-m-d H:i'),                      'numeric' => false],
            'client'             => ['header' => 'Client',           'value' => fn($s) => $s->client?->business_name ?? 'Walk-in',                  'numeric' => false],
            'fulfillment_type'   => ['header' => 'Fulfillment Type', 'value' => fn($s) => $s->fulfillment_type,                                     'numeric' => false],
            'status'             => ['header' => 'Status',           'value' => fn($s) => $s->status,                                               'numeric' => false],
            'subtotal'           => ['header' => 'Subtotal',         'value' => fn($s) => (float) $s->subtotal,                                     'numeric' => true],
            'discount'           => ['header' => 'Discount',         'value' => fn($s) => (float) $s->discount_amount,                              'numeric' => true],
            'total'              => ['header' => 'Total',            'value' => fn($s) => (float) $s->total_amount,                                 'numeric' => true],
            'payment_method'     => ['header' => 'Payment Method',   'value' => fn($s) => $s->payments->pluck('payment_method')->join(', '),        'numeric' => false],
            'cashier'            => ['header' => 'Cashier',          'value' => fn($s) => $s->user?->name ?? 'Unknown',                             'numeric' => false],
            'notes'              => ['header' => 'Notes',            'value' => fn($s) => $s->notes ?? '',                                          'numeric' => false],
        ];
        $orderedKeys = ['transaction_number','date','client','fulfillment_type','status','subtotal','discount','total','payment_method','cashier','notes'];
        $activeCols = array_filter(
            array_intersect_key($allColDefs, array_flip($orderedKeys)),
            fn($key) => $selectedCols === null || in_array($key, $selectedCols),
            ARRAY_FILTER_USE_KEY
        );

        $rows = [];
        $rows[] = array_column($activeCols, 'header');
        $strikeThroughRows = [];

        foreach ($sales as $sale) {
            if ($sale->status === 'voided') {
                $strikeThroughRows[] = count($rows);
            }
            $rows[] = array_map(fn($col) => ($col['value'])($sale), $activeCols);
        }

        // Summary rows
        $activeSales = $sales->reject(fn ($s) => $s->status === 'voided');
        $voidedCount = $sales->count() - $activeSales->count();
        $rows[] = [];
        $totals = array_map(function ($key, $col) use ($activeSales) {
            return match ($key) {
                'transaction_number' => 'TOTALS (voided excluded)',
                'subtotal'  => (float) $activeSales->sum('subtotal'),
                'discount'  => (float) $activeSales->sum('discount_amount'),
                'total'     => (float) $activeSales->sum('total_amount'),
                default     => '',
            };
        }, array_keys($activeCols), $activeCols);
        $rows[] = $totals;
        if ($voidedCount > 0) {
            $rows[] = ["Note: {$voidedCount} voided transaction(s) shown with strikethrough above are excluded from totals"];
        }

        $xlsx = $this->buildXlsx($rows, $strikeThroughRows);

        return response($xlsx, 200)
            ->header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->header('Content-Disposition', "attachment; filename=\"{$filename}\"");
    }

    /**
     * Build a minimal but valid .xlsx binary from a 2-D array of rows.
     * Uses only PHP's built-in ZipArchive — no Composer packages required.
     * $strikeThroughRows: 0-based row indices that should be rendered with strikethrough.
     */
    private function buildXlsx(array $rows, array $strikeThroughRows = []): string
    {
        $strikeThroughSet = array_flip($strikeThroughRows);

        // Collect all unique strings into a shared-strings table
        $strings = [];
        $strIndex = [];

        $xmlRows = '';
        foreach ($rows as $r => $row) {
            $isStrike = isset($strikeThroughSet[$r]);
            $xmlRows .= '<row r="' . ($r + 1) . '">';
            foreach ($row as $c => $value) {
                $col   = $this->xlsxColLetter($c) . ($r + 1);
                $sAttr = $isStrike ? ' s="1"' : '';
                if (is_numeric($value) && $value !== '') {
                    $xmlRows .= "<c r=\"{$col}\"{$sAttr}><v>{$value}</v></c>";
                } else {
                    $str = (string) $value;
                    if (!isset($strIndex[$str])) {
                        $strIndex[$str] = count($strings);
                        $strings[] = $str;
                    }
                    $xmlRows .= "<c r=\"{$col}\" t=\"s\"{$sAttr}><v>{$strIndex[$str]}</v></c>";
                }
            }
            $xmlRows .= '</row>';
        }

        // Shared strings XML
        $sst = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' . count($strings) . '" uniqueCount="' . count($strings) . '">';
        foreach ($strings as $s) {
            $sst .= '<si><t>' . htmlspecialchars($s, ENT_XML1, 'UTF-8') . '</t></si>';
        }
        $sst .= '</sst>';

        // Styles XML — index 0 = default, index 1 = strikethrough gray
        $stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<fonts count="2">'
            . '<font><sz val="11"/><name val="Calibri"/></font>'
            . '<font><strike/><sz val="11"/><color rgb="FF999999"/><name val="Calibri"/></font>'
            . '</fonts>'
            . '<fills count="2">'
            . '<fill><patternFill patternType="none"/></fill>'
            . '<fill><patternFill patternType="gray125"/></fill>'
            . '</fills>'
            . '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
            . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            . '<cellXfs count="2">'
            . '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
            . '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
            . '</cellXfs>'
            . '</styleSheet>';

        // Sheet XML
        $sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<sheetData>' . $xmlRows . '</sheetData>'
            . '</worksheet>';

        // Workbook XML
        $workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
            . ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . '<sheets><sheet name="Transactions" sheetId="1" r:id="rId1"/></sheets>'
            . '</workbook>';

        // Relationships
        $wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
            . '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            . '</Relationships>';

        $pkgRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            . '</Relationships>';

        $contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            . '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
            . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            . '</Types>';

        // Build the zip in memory
        $tmp = tempnam(sys_get_temp_dir(), 'xlsx_');
        $zip = new \ZipArchive();
        $zip->open($tmp, \ZipArchive::OVERWRITE);
        $zip->addFromString('[Content_Types].xml',         $contentTypes);
        $zip->addFromString('_rels/.rels',                  $pkgRels);
        $zip->addFromString('xl/workbook.xml',              $workbook);
        $zip->addFromString('xl/_rels/workbook.xml.rels',   $wbRels);
        $zip->addFromString('xl/worksheets/sheet1.xml',     $sheet);
        $zip->addFromString('xl/sharedStrings.xml',         $sst);
        $zip->addFromString('xl/styles.xml',                $stylesXml);
        $zip->close();

        $binary = file_get_contents($tmp);
        unlink($tmp);

        return $binary;
    }

    private function xlsxColLetter(int $index): string
    {
        $letter = '';
        $index++;
        while ($index > 0) {
            $index--;
            $letter = chr(65 + ($index % 26)) . $letter;
            $index = intdiv($index, 26);
        }
        return $letter;
    }

    private function exportPdf($sales, string $label, string $statusLabel, string $fulfillmentLabel, string $paymentLabel, ?array $columns = null): Response
    {
        $filename = 'transactions-' . now()->format('Y-m-d') . '.pdf';

        $pdf = Pdf::loadView('reports.transactions', [
            'sales'            => $sales,
            'label'            => $label,
            'statusLabel'      => $statusLabel,
            'fulfillmentLabel' => $fulfillmentLabel,
            'paymentLabel'     => $paymentLabel,
            'columns'          => $columns,
        ]);
        $pdf->setOptions(['enable_php' => true]);

        return $pdf->download($filename);
    }
}
