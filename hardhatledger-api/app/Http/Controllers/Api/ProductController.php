<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Product\StoreProductRequest;
use App\Http\Requests\Product\UpdateProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Category;
use App\Models\Client;
use App\Models\ClientTier;
use App\Models\InventoryStock;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Services\PricingService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

    public function updateTierPrices(Request $request, Product $product): JsonResponse
    {
        $request->validate([
            'prices'                   => 'required|array',
            'prices.*.client_tier_id'  => 'required|integer|exists:client_tiers,id',
            'prices.*.price'           => 'nullable|numeric|min:0',
        ]);

        DB::transaction(function () use ($request, $product) {
            foreach ($request->prices as $tp) {
                if (is_null($tp['price'])) {
                    ProductPrice::where([
                        'product_id'     => $product->id,
                        'client_tier_id' => $tp['client_tier_id'],
                    ])->delete();
                } else {
                    ProductPrice::updateOrCreate(
                        ['product_id' => $product->id, 'client_tier_id' => $tp['client_tier_id']],
                        ['price'      => $tp['price']]
                    );
                }
            }
        });

        $product->load('tierPrices');

        return response()->json([
            'data' => $product->tierPrices->map(fn ($tp) => [
                'id'             => $tp->id,
                'client_tier_id' => $tp->client_tier_id,
                'price'          => (float) $tp->price,
            ]),
        ]);
    }

    private function buildExportQuery(Request $request)
    {
        $query = Product::with(['category', 'stock'])->orderBy('name');

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%");
            });
        }

        if ($categoryId = $request->get('category_id')) {
            $query->where('category_id', $categoryId);
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        return $query;
    }

    public function exportPdf(Request $request): \Illuminate\Http\Response
    {
        $products = $this->buildExportQuery($request)->get();

        $pdf = Pdf::loadView('products.export', [
            'products' => $products,
            'date'     => now()->format('F d, Y'),
        ]);
        $pdf->setPaper('a4', 'landscape');
        $pdf->setOptions(['enable_php' => true]);

        return $pdf->download('products-' . now()->format('Y-m-d') . '.pdf');
    }

    public function exportCsv(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $products = $this->buildExportQuery($request)->get();

        $filename = 'products-' . now()->format('Y-m-d') . '.csv';

        return response()->streamDownload(function () use ($products) {
            $handle = fopen('php://output', 'w');
            // UTF-8 BOM so Excel opens it correctly
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['SKU', 'Name', 'Category', 'Unit', 'Cost Price', 'Selling Price', 'Stock', 'Reorder Level', 'Status']);
            foreach ($products as $p) {
                fputcsv($handle, [
                    $p->sku,
                    $p->name,
                    $p->category?->name ?? '',
                    $p->unit,
                    $p->cost_price,
                    $p->base_selling_price,
                    $p->stock?->quantity_on_hand ?? 0,
                    $p->reorder_level,
                    $p->is_active ? 'Active' : 'Inactive',
                ]);
            }
            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function exportXlsx(Request $request): \Symfony\Component\HttpFoundation\BinaryFileResponse
    {
        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $spreadsheet->removeSheetByIndex(0); // remove default blank sheet

        $headers = ['SKU', 'Name', 'Unit', 'Cost Price', 'Selling Price', 'Stock', 'Reorder Level', 'Status'];

        $products = $this->buildExportQuery($request)->get();

        $grouped = $products->groupBy(fn ($p) => $p->category?->name ?? 'Uncategorized');
        $grouped->prepend($products, 'All Products');

        foreach ($grouped as $categoryName => $items) {
            $sheetTitle = mb_substr(preg_replace('/[\/\\\?\*\[\]:]/', '', (string) $categoryName), 0, 31);

            $sheet = new \PhpOffice\PhpSpreadsheet\Worksheet\Worksheet($spreadsheet, $sheetTitle);
            $spreadsheet->addSheet($sheet);

            $sheet->fromArray($headers, null, 'A1');
            $sheet->getStyle('A1:H1')->applyFromArray([
                'font'    => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
                'fill'    => ['fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF1B3A5C']],
                'borders' => ['allBorders' => ['borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN, 'color' => ['argb' => 'FFD1D5DB']]],
            ]);

            $row = 2;
            foreach ($items as $p) {
                $sheet->fromArray([
                    $p->sku,
                    $p->name,
                    $p->unit,
                    (float) $p->cost_price,
                    (float) $p->base_selling_price,
                    $p->stock?->quantity_on_hand ?? 0,
                    $p->reorder_level,
                    $p->is_active ? 'Active' : 'Inactive',
                ], null, "A{$row}");

                $sheet->getStyle("D{$row}:E{$row}")->getNumberFormat()->setFormatCode('#,##0.00');

                if ($row % 2 === 0) {
                    $sheet->getStyle("A{$row}:H{$row}")->getFill()
                        ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                        ->getStartColor()->setARGB('FFF9FAFB');
                }
                $row++;
            }

            foreach (range('A', 'H') as $col) {
                $sheet->getColumnDimension($col)->setAutoSize(true);
            }

            $sheet->freezePane('A2');
        }

        $writer   = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
        $filename = 'products-' . now()->format('Y-m-d') . '.xlsx';
        $tmpPath  = sys_get_temp_dir() . DIRECTORY_SEPARATOR . $filename;
        $writer->save($tmpPath);

        return response()->download($tmpPath, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    public function import(Request $request): JsonResponse
    {
        $request->validate(['file' => 'required|file|max:10240']);

        $file      = $request->file('file');
        $extension = strtolower($file->getClientOriginalExtension());

        try {
            $rows = match(true) {
                $extension === 'tsv'                    => $this->parseFlatFile($file->getPathname(), "\t"),
                in_array($extension, ['xlsx', 'xls'])   => $this->parseSpreadsheet($file->getPathname()),
                default                                 => $this->parseFlatFile($file->getPathname(), ','),
            };
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Could not parse file: ' . $e->getMessage()], 422);
        }

        if (empty($rows)) {
            return response()->json(['message' => 'No data rows found in file.'], 422);
        }

        $retailTier   = ClientTier::where('name', 'Retail')->first();
        $wholesaleTier = ClientTier::where('name', 'Wholesale')->first();

        $imported = 0;
        $skipped  = 0;
        $errors   = [];

        DB::beginTransaction();
        try {
            foreach ($rows as $i => $row) {
                $rowNum = $i + 2;
                $name   = trim($row['name'] ?? '');

                if (empty($name)) {
                    $errors[] = "Row {$rowNum}: missing 'name' — skipped.";
                    $skipped++;
                    continue;
                }

                $sku = trim($row['sku'] ?? '');
                if ($sku && Product::where('sku', $sku)->exists()) {
                    $errors[] = "Row {$rowNum}: SKU '{$sku}' already exists — skipped.";
                    $skipped++;
                    continue;
                }

                if (empty($sku)) {
                    $base  = 'IMP';
                    $count = Product::where('sku', 'like', "{$base}-%")->count() + 1 + $imported;
                    $sku   = $base . '-' . str_pad($count, 4, '0', STR_PAD_LEFT);
                }

                $categoryId  = null;
                $categoryName = trim($row['category'] ?? '');
                if ($categoryName) {
                    $categoryId = Category::firstOrCreate(['name' => $categoryName])->id;
                }

                $retailPrice    = (float) ($row['retail_price'] ?? $row['selling_price'] ?? $row['base_selling_price'] ?? 0);
                $wholesalePrice = (float) ($row['wholesale_price'] ?? $row['hardware_price'] ?? 0);

                $product = Product::create([
                    'sku'                => $sku,
                    'name'               => $name,
                    'description'        => trim($row['description'] ?? '') ?: null,
                    'category_id'        => $categoryId,
                    'unit'               => trim($row['unit'] ?? 'pc') ?: 'pc',
                    'cost_price'         => (float) ($row['cost_price'] ?? $row['cost'] ?? 0),
                    'base_selling_price' => $retailPrice,
                    'reorder_level'      => (int) ($row['reorder_level'] ?? 0),
                    'is_active'          => true,
                    'branch_id'          => null,
                ]);

                InventoryStock::create([
                    'product_id'        => $product->id,
                    'quantity_on_hand'  => (int) ($row['stock'] ?? $row['quantity'] ?? 0),
                    'quantity_reserved' => 0,
                    'branch_id'         => null,
                ]);

                if ($retailTier && $retailPrice > 0) {
                    ProductPrice::create([
                        'product_id'     => $product->id,
                        'client_tier_id' => $retailTier->id,
                        'price'          => $retailPrice,
                    ]);
                }

                if ($wholesaleTier && $wholesalePrice > 0) {
                    ProductPrice::create([
                        'product_id'     => $product->id,
                        'client_tier_id' => $wholesaleTier->id,
                        'price'          => $wholesalePrice,
                    ]);
                }

                $imported++;
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Import failed: ' . $e->getMessage()], 500);
        }

        return response()->json([
            'imported' => $imported,
            'skipped'  => $skipped,
            'errors'   => $errors,
            'message'  => "Import complete. {$imported} product(s) imported, {$skipped} skipped.",
        ]);
    }

    private function normalizeHeader(string $h): string
    {
        // Strip UTF-8 BOM that Excel/spreadsheet apps sometimes prepend to the first cell
        $h = preg_replace('/^\xEF\xBB\xBF/', '', $h);
        return strtolower(trim(str_replace([' ', '-'], '_', $h)));
    }

    private function parseFlatFile(string $path, string $delimiter): array
    {
        $rows   = [];
        $handle = fopen($path, 'r');
        if (!$handle) {
            throw new \RuntimeException('Cannot open uploaded file.');
        }

        $headers = null;
        while (($line = fgetcsv($handle, 0, $delimiter)) !== false) {
            if ($headers === null) {
                $headers = array_map(fn($h) => $this->normalizeHeader($h), $line);
                continue;
            }
            // Skip completely blank rows
            if (empty(array_filter($line, fn($v) => trim((string) $v) !== ''))) {
                continue;
            }
            if (count($line) < count($headers)) {
                $line = array_pad($line, count($headers), '');
            }
            $rows[] = array_combine($headers, array_slice($line, 0, count($headers)));
        }
        fclose($handle);

        return $rows;
    }

    private function parseSpreadsheet(string $path): array
    {
        $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($path);
        $data        = $spreadsheet->getActiveSheet()->toArray();

        if (empty($data)) {
            return [];
        }

        $headers = array_map(
            fn($h) => $this->normalizeHeader((string) $h),
            array_shift($data)
        );

        $rows = [];
        foreach ($data as $line) {
            $line = array_map('strval', $line);
            if (count($line) < count($headers)) {
                $line = array_pad($line, count($headers), '');
            }
            $row = array_combine($headers, array_slice($line, 0, count($headers)));
            if (!empty(array_filter($row, fn($v) => $v !== ''))) {
                $rows[] = $row;
            }
        }

        return $rows;
    }
}
