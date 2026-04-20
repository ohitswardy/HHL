<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\AdjustStockRequest;
use App\Http\Resources\InventoryMovementResource;
use App\Http\Resources\ProductResource;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Services\InventoryService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class InventoryController extends Controller
{
    public function __construct(private InventoryService $inventoryService) {}

    public function index(Request $request): JsonResponse
    {
        $query = Product::with(['category', 'stock'])
            ->where('is_active', true);

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%");
            });
        }

        if ($request->boolean('low_stock')) {
            $query->whereHas('stock', fn ($q) =>
                $q->whereRaw('quantity_on_hand <= (SELECT reorder_level FROM products WHERE products.id = inventory_stock.product_id)')
            );
        }

        $products = $query->orderBy('name')->paginate((int) $request->input('per_page', 20));

        $lowStockCount = Product::whereHas('stock', fn ($q) =>
            $q->whereRaw('quantity_on_hand <= (SELECT reorder_level FROM products WHERE products.id = inventory_stock.product_id)')
        )->where('is_active', true)->count();

        return response()->json([
            'data' => ProductResource::collection($products),
            'meta' => [
                'current_page'    => $products->currentPage(),
                'last_page'       => $products->lastPage(),
                'per_page'        => $products->perPage(),
                'total'           => $products->total(),
                'low_stock_count' => $lowStockCount,
            ],
        ]);
    }

    public function movements(Request $request): JsonResponse
    {
        $query = InventoryMovement::with(['product', 'user']);

        if ($productId = $request->input('product_id')) {
            $query->where('product_id', $productId);
        }

        if ($type = $request->input('type')) {
            $query->where('type', $type);
        }

        if ($from = $request->input('from')) {
            $query->whereDate('created_at', '>=', $from);
        }

        if ($to = $request->input('to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        $movements = $query->orderByDesc('created_at')
            ->paginate((int) $request->input('per_page', 20));

        return response()->json([
            'data' => InventoryMovementResource::collection($movements),
            'meta' => [
                'current_page' => $movements->currentPage(),
                'last_page'    => $movements->lastPage(),
                'per_page'     => $movements->perPage(),
                'total'        => $movements->total(),
            ],
        ]);
    }

    public function adjustStock(AdjustStockRequest $request): JsonResponse
    {
        $product = Product::findOrFail($request->input('product_id'));

        $this->inventoryService->adjustStock(
            product: $product,
            quantity: (int) $request->input('quantity'),
            type: $request->input('type'),
            referenceType: 'manual_adjustment',
            referenceId: null,
            unitCost: $request->input('unit_cost') !== null ? (float) $request->input('unit_cost') : null,
            notes: $request->input('notes'),
            user: $request->user(),
        );

        $product->load('stock');
        return response()->json(['data' => new ProductResource($product)]);
    }

    public function printMovements(Request $request): Response
    {
        $query = InventoryMovement::with(['product', 'user']);

        $type   = $request->input('type');
        $from   = $request->input('from');
        $to     = $request->input('to');
        $search = $request->input('search');

        if ($type)   { $query->where('type', $type); }
        if ($from)   { $query->whereDate('created_at', '>=', $from); }
        if ($to)     { $query->whereDate('created_at', '<=', $to); }
        if ($search) {
            $query->whereHas('product', fn ($q) =>
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%")
            );
        }

        $movements = $query->orderByDesc('created_at')->get();

        $columns = $request->has('columns') ? (array) $request->input('columns') : null;

        $pdf = Pdf::loadView('reports.movements', [
            'movements' => $movements,
            'from'      => $from,
            'to'        => $to,
            'type'      => $type,
            'search'    => $search,
            'columns'   => $columns,
        ]);

        $pdf->setPaper('A4', 'landscape');
        $pdf->setOptions(['enable_php' => true]);

        $filename = 'inventory-movements'
            . ($from ? '-'.$from : '')
            . ($to   ? '-to-'.$to : '')
            . '.pdf';

        return $pdf->download($filename);
    }

    public function exportMovementsCsv(Request $request): StreamedResponse
    {
        $query = InventoryMovement::with(['product', 'user']);

        $type   = $request->input('type');
        $from   = $request->input('from');
        $to     = $request->input('to');
        $search = $request->input('search');

        if ($type)   { $query->where('type', $type); }
        if ($from)   { $query->whereDate('created_at', '>=', $from); }
        if ($to)     { $query->whereDate('created_at', '<=', $to); }
        if ($search) {
            $query->whereHas('product', fn ($q) =>
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%")
            );
        }

        $movements = $query->orderByDesc('created_at')->get();
        $filename = 'inventory-movements-' . now()->format('Y-m-d') . '.csv';
        $selectedCols = $request->has('columns') ? (array) $request->input('columns') : null;

        $allCols = [
            'date'           => ['header' => 'Date & Time',    'value' => fn ($m) => $m->created_at?->format('Y-m-d H:i:s')],
            'product'        => ['header' => 'Product',        'value' => fn ($m) => $m->product?->name ?? ''],
            'sku'            => ['header' => 'SKU',            'value' => fn ($m) => $m->product?->sku ?? ''],
            'type'           => ['header' => 'Type',           'value' => fn ($m) => $m->type],
            'quantity'       => ['header' => 'Quantity',       'value' => fn ($m) => $m->quantity],
            'unit_cost'      => ['header' => 'Unit Cost',      'value' => fn ($m) => $m->unit_cost !== null ? number_format((float) $m->unit_cost, 2, '.', '') : ''],
            'reference_type' => ['header' => 'Reference Type', 'value' => fn ($m) => $m->reference_type ?? ''],
            'reference_id'   => ['header' => 'Reference ID',   'value' => fn ($m) => $m->reference_id ?? ''],
            'notes'          => ['header' => 'Notes',          'value' => fn ($m) => $m->notes ?? ''],
            'user'           => ['header' => 'User',           'value' => fn ($m) => $m->user?->name ?? ''],
        ];
        $activeCols = $selectedCols ? array_filter($allCols, fn ($k) => in_array($k, $selectedCols), ARRAY_FILTER_USE_KEY) : $allCols;

        return response()->streamDownload(function () use ($movements, $activeCols) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF"); // UTF-8 BOM
            fputcsv($handle, array_column($activeCols, 'header'));
            foreach ($movements as $m) {
                fputcsv($handle, array_values(array_map(fn ($def) => ($def['value'])($m), $activeCols)));
            }
            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function exportStockPdf(Request $request): Response
    {
        $query = Product::with(['category', 'stock'])->where('is_active', true);

        $search   = $request->input('search');
        $lowStock = $request->boolean('low_stock');

        if ($search) {
            $query->where(fn ($q) =>
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%")
            );
        }
        if ($lowStock) {
            $query->whereHas('stock', fn ($q) =>
                $q->whereRaw('quantity_on_hand <= (SELECT reorder_level FROM products WHERE products.id = inventory_stock.product_id)')
            );
        }

        $products = $query->orderBy('name')->get();

        $columns = $request->has('columns') ? (array) $request->input('columns') : null;

        $pdf = Pdf::loadView('reports.stock', [
            'products'  => $products,
            'search'    => $search,
            'low_stock' => $lowStock,
            'columns'   => $columns,
        ])->setOptions([
            'enable_php'           => true,
            'isHtml5ParserEnabled' => true,
            'isRemoteEnabled'      => false,
            'defaultFont'          => 'DejaVu Sans',
            'dpi'                  => 150,
        ])->setPaper('a4', 'portrait');

        return $pdf->download('stock-report-' . now()->format('Y-m-d') . '.pdf');
    }

    public function exportStockCsv(Request $request): StreamedResponse
    {
        $query = Product::with(['category', 'stock'])->where('is_active', true);

        $search   = $request->input('search');
        $lowStock = $request->boolean('low_stock');

        if ($search) {
            $query->where(fn ($q) =>
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%")
            );
        }
        if ($lowStock) {
            $query->whereHas('stock', fn ($q) =>
                $q->whereRaw('quantity_on_hand <= (SELECT reorder_level FROM products WHERE products.id = inventory_stock.product_id)')
            );
        }

        $products = $query->orderBy('name')->get();
        $filename = 'stock-report-' . now()->format('Y-m-d') . '.csv';
        $selectedCols = $request->has('columns') ? (array) $request->input('columns') : null;

        $allCols = [
            'name'          => ['header' => 'Product Name', 'value' => fn ($p) => $p->name],
            'sku'           => ['header' => 'SKU',          'value' => fn ($p) => $p->sku],
            'category'      => ['header' => 'Category',     'value' => fn ($p) => $p->category?->name ?? ''],
            'unit'          => ['header' => 'Unit',         'value' => fn ($p) => $p->unit],
            'on_hand'       => ['header' => 'On Hand',      'value' => fn ($p) => (int) ($p->stock?->quantity_on_hand ?? 0)],
            'reserved'      => ['header' => 'Reserved',     'value' => fn ($p) => (int) ($p->stock?->quantity_reserved ?? 0)],
            'available'     => ['header' => 'Available',    'value' => fn ($p) => (int) ($p->stock?->quantity_on_hand ?? 0) - (int) ($p->stock?->quantity_reserved ?? 0)],
            'reorder_level' => ['header' => 'Reorder Level','value' => fn ($p) => $p->reorder_level],
            'status'        => ['header' => 'Status',       'value' => fn ($p) => ((int) ($p->stock?->quantity_on_hand ?? 0)) <= $p->reorder_level ? 'Low Stock' : 'OK'],
        ];
        $activeCols = $selectedCols ? array_filter($allCols, fn ($k) => in_array($k, $selectedCols), ARRAY_FILTER_USE_KEY) : $allCols;

        return response()->streamDownload(function () use ($products, $activeCols) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, array_column($activeCols, 'header'));
            foreach ($products as $p) {
                fputcsv($handle, array_values(array_map(fn ($def) => ($def['value'])($p), $activeCols)));
            }
            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
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
