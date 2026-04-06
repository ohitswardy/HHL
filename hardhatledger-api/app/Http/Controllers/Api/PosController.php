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

            $deliveryFee = $request->fulfillment_type === 'delivery'
                ? (float) ($request->delivery_fee ?? 0)
                : 0;
            $totalAmount = $subtotal - $discountAmount + $deliveryFee;

            // Create transaction
            $sale = SalesTransaction::create([
                'transaction_number' => $this->transactionNumberService->generateSaleNumber(),
                'client_id'          => $client?->id,
                'user_id'            => $request->user()->id,
                'fulfillment_type'   => $request->fulfillment_type ?? 'pickup',
                'status'             => 'completed',
                'subtotal'           => $subtotal,
                'discount_amount'    => $discountAmount,
                'delivery_fee'       => $deliveryFee,
                'tax_amount'         => 0,
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

    public function exportReport(Request $request): Response
    {
        $query = SalesTransaction::with(['client', 'user', 'items.product', 'payments'])
            ->where('status', 'completed');

        // Apply date filters
        $period = $request->get('period', 'daily'); // daily, weekly, monthly
        $date   = $request->get('date', now()->toDateString());
        $carbon = \Illuminate\Support\Carbon::parse($date);

        match ($period) {
            'daily'   => $query->whereDate('created_at', $date),
            'weekly'  => $query->whereBetween('created_at', [
                            $carbon->copy()->startOfWeek()->startOfDay(),
                            $carbon->copy()->endOfWeek()->endOfDay(),
                         ]),
            'monthly' => $query->whereYear('created_at', $carbon->year)
                               ->whereMonth('created_at', $carbon->month),
            default   => null,
        };

        $format = $request->get('format', 'pdf'); // pdf, csv, xlsx

        $sales = $query->orderByDesc('created_at')->get();

        return match ($format) {
            'csv' => $this->exportCsv($sales, $period),
            'xlsx' => $this->exportXlsx($sales, $period),
            default => $this->exportPdf($sales, $period, $date),
        };
    }

    private function exportCsv($sales, $period): Response
    {
        $filename = "transactions-{$period}-" . now()->format('Y-m-d') . '.csv';
        $headers = [
            'Transaction #',
            'Date',
            'Client',
            'Fulfillment Type',
            'Subtotal',
            'Discount',
            'Total',
            'Payment Method',
            'Cashier',
        ];

        $handle = fopen('php://memory', 'r+');
        fputcsv($handle, $headers);

        foreach ($sales as $sale) {
            $paymentMethods = $sale->payments->pluck('payment_method')->join(', ');
            fputcsv($handle, [
                $sale->transaction_number,
                $sale->created_at->format('Y-m-d H:i'),
                $sale->client?->business_name ?? 'Walk-in',
                $sale->fulfillment_type,
                number_format($sale->subtotal, 2),
                number_format($sale->discount_amount, 2),
                number_format($sale->total_amount, 2),
                $paymentMethods,
                $sale->user?->name ?? 'Unknown',
            ]);
        }

        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        return response($csv, 200)
            ->header('Content-Type', 'text/csv; charset=utf-8')
            ->header('Content-Disposition', "attachment; filename=\"$filename\"");
    }

    private function exportXlsx($sales, $period): Response
    {
        $filename = "transactions-{$period}-" . now()->format('Y-m-d') . '.xlsx';

        $rows = [];
        $rows[] = ['Transaction #', 'Date', 'Client', 'Fulfillment Type', 'Subtotal', 'Discount', 'Total', 'Payment Method', 'Cashier'];

        foreach ($sales as $sale) {
            $paymentMethods = $sale->payments->pluck('payment_method')->join(', ');
            $rows[] = [
                $sale->transaction_number,
                $sale->created_at->format('Y-m-d H:i'),
                $sale->client?->business_name ?? 'Walk-in',
                $sale->fulfillment_type,
                (float) $sale->subtotal,
                (float) $sale->discount_amount,
                (float) $sale->total_amount,
                $paymentMethods,
                $sale->user?->name ?? 'Unknown',
            ];
        }

        $xlsx = $this->buildXlsx($rows);

        return response($xlsx, 200)
            ->header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->header('Content-Disposition', "attachment; filename=\"{$filename}\"");
    }

    /**
     * Build a minimal but valid .xlsx binary from a 2-D array of rows.
     * Uses only PHP's built-in ZipArchive — no Composer packages required.
     */
    private function buildXlsx(array $rows): string
    {
        // Collect all unique strings into a shared-strings table
        $strings = [];
        $strIndex = [];

        $xmlRows = '';
        foreach ($rows as $r => $row) {
            $xmlRows .= '<row r="' . ($r + 1) . '">';
            foreach ($row as $c => $value) {
                $col = $this->xlsxColLetter($c) . ($r + 1);
                if (is_numeric($value) && $value !== '') {
                    $xmlRows .= "<c r=\"{$col}\"><v>{$value}</v></c>";
                } else {
                    $str = (string) $value;
                    if (!isset($strIndex[$str])) {
                        $strIndex[$str] = count($strings);
                        $strings[] = $str;
                    }
                    $xmlRows .= "<c r=\"{$col}\" t=\"s\"><v>{$strIndex[$str]}</v></c>";
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

    private function exportPdf($sales, $period, $date): Response
    {
        $filename = "transactions-{$period}-" . now()->format('Y-m-d') . '.pdf';

        $pdf = Pdf::loadView('reports.transactions', [
            'sales' => $sales,
            'period' => $period,
            'date' => $date,
        ]);

        return $pdf->download($filename);
    }
}
