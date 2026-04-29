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
use App\Services\AuditService;
use App\Services\InventoryService;
use App\Services\PricingService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    public function __construct(
        private PricingService $pricingService,
        private InventoryService $inventoryService,
    ) {}

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

        AuditService::log('created', 'products', $product->id, null, [
            'sku'                => $product->sku,
            'name'               => $product->name,
            'cost_price'         => (float) $product->cost_price,
            'base_selling_price' => (float) $product->base_selling_price,
            'category_id'        => $product->category_id,
            'supplier_id'        => $product->supplier_id,
        ]);

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
        $old = [
            'sku'                => $product->sku,
            'name'               => $product->name,
            'cost_price'         => (float) $product->cost_price,
            'base_selling_price' => (float) $product->base_selling_price,
            'category_id'        => $product->category_id,
            'supplier_id'        => $product->supplier_id,
            'is_active'          => (bool) $product->is_active,
        ];

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

        $fresh = $product->fresh();
        AuditService::log('updated', 'products', $product->id, $old, [
            'sku'                => $fresh->sku,
            'name'               => $fresh->name,
            'cost_price'         => (float) $fresh->cost_price,
            'base_selling_price' => (float) $fresh->base_selling_price,
            'category_id'        => $fresh->category_id,
            'supplier_id'        => $fresh->supplier_id,
            'is_active'          => (bool) $fresh->is_active,
        ]);

        $product->load(['category', 'supplier', 'stock', 'tierPrices']);
        return response()->json(['data' => new ProductResource($product)]);
    }

    public function destroy(Product $product): JsonResponse
    {
        $snapshot = ['sku' => $product->sku, 'name' => $product->name];
        $product->delete();

        AuditService::log('deleted', 'products', $product->id, $snapshot, null);

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

        $oldPrices = $product->tierPrices()->get()
            ->mapWithKeys(fn ($tp) => [(int) $tp->client_tier_id => (float) $tp->price])
            ->toArray();

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

        $newPrices = $product->tierPrices
            ->mapWithKeys(fn ($tp) => [(int) $tp->client_tier_id => (float) $tp->price])
            ->toArray();
        AuditService::log('tier_prices_updated', 'products', $product->id,
            ['tier_prices' => $oldPrices],
            ['tier_prices' => $newPrices]
        );

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
        $columns  = $request->has('columns') ? (array) $request->input('columns') : null;

        $pdf = Pdf::loadView('products.export', [
            'products' => $products,
            'date'     => now()->format('F d, Y'),
            'columns'  => $columns,
        ]);
        $pdf->setPaper('a4', 'landscape');
        $pdf->setOptions(['enable_php' => false]);

        return $pdf->download('products-' . now()->format('Y-m-d') . '.pdf');
    }

    public function exportCsv(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $products = $this->buildExportQuery($request)->get();
        $selectedCols = $request->has('columns') ? (array) $request->input('columns') : null;

        $filename = 'products-' . now()->format('Y-m-d') . '.csv';

        // All possible columns in order
        $allCols = [
            'sku'           => fn ($p) => $p->sku,
            'name'          => fn ($p) => $p->name,
            'category'      => fn ($p) => $p->category?->name ?? '',
            'unit'          => fn ($p) => $p->unit,
            'cost_price'    => fn ($p) => $p->cost_price,
            'selling_price' => fn ($p) => $p->base_selling_price,
            'stock'         => fn ($p) => $p->stock?->quantity_on_hand ?? 0,
            'reorder_level' => fn ($p) => $p->reorder_level,
            'status'        => fn ($p) => $p->is_active ? 'Active' : 'Inactive',
        ];
        $headerMap = [
            'sku' => 'SKU', 'name' => 'Name', 'category' => 'Category', 'unit' => 'Unit',
            'cost_price' => 'Cost Price', 'selling_price' => 'Selling Price',
            'stock' => 'Stock', 'reorder_level' => 'Reorder Level', 'status' => 'Status',
        ];

        $activeCols = $selectedCols ? array_filter($allCols, fn ($k) => in_array($k, $selectedCols), ARRAY_FILTER_USE_KEY) : $allCols;

        return response()->streamDownload(function () use ($products, $activeCols, $headerMap) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, array_values(array_intersect_key($headerMap, $activeCols)));
            foreach ($products as $p) {
                fputcsv($handle, array_values(array_map(fn ($fn) => $fn($p), $activeCols)));
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

        $selectedCols = $request->has('columns') ? (array) $request->input('columns') : null;

        $allColDefs = [
            'sku'           => ['header' => 'SKU',           'value' => fn ($p) => $p->sku,                              'money' => false],
            'name'          => ['header' => 'Name',          'value' => fn ($p) => $p->name,                             'money' => false],
            'unit'          => ['header' => 'Unit',          'value' => fn ($p) => $p->unit,                             'money' => false],
            'cost_price'    => ['header' => 'Cost Price',    'value' => fn ($p) => (float) $p->cost_price,               'money' => true ],
            'selling_price' => ['header' => 'Selling Price', 'value' => fn ($p) => (float) $p->base_selling_price,       'money' => true ],
            'stock'         => ['header' => 'Stock',         'value' => fn ($p) => $p->stock?->quantity_on_hand ?? 0,    'money' => false],
            'reorder_level' => ['header' => 'Reorder Level', 'value' => fn ($p) => $p->reorder_level,                   'money' => false],
            'status'        => ['header' => 'Status',        'value' => fn ($p) => $p->is_active ? 'Active' : 'Inactive','money' => false],
            'category'      => ['header' => 'Category',      'value' => fn ($p) => $p->category?->name ?? '',            'money' => false],
        ];
        // Keep original order, add category after name if selected
        $orderedKeys = ['sku','name','category','unit','cost_price','selling_price','stock','reorder_level','status'];
        if ($selectedCols) {
            $orderedKeys = array_filter($orderedKeys, fn ($k) => in_array($k, $selectedCols));
        }
        $activeCols = array_intersect_key(array_merge(array_flip($orderedKeys), $allColDefs), array_flip($orderedKeys));
        $activeCols = array_map(fn ($k) => $allColDefs[$k], $orderedKeys);

        $headers = array_column($activeCols, 'header');
        $lastColLetter = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex(count($headers));

        $products = $this->buildExportQuery($request)->get();

        $grouped = $products->groupBy(fn ($p) => $p->category?->name ?? 'Uncategorized');
        $grouped->prepend($products, 'All Products');

        foreach ($grouped as $categoryName => $items) {
            $sheetTitle = mb_substr(preg_replace('/[\/\\\?\*\[\]:]/', '', (string) $categoryName), 0, 31);

            $sheet = new \PhpOffice\PhpSpreadsheet\Worksheet\Worksheet($spreadsheet, $sheetTitle);
            $spreadsheet->addSheet($sheet);

            $sheet->fromArray($headers, null, 'A1');
            $sheet->getStyle("A1:{$lastColLetter}1")->applyFromArray([
                'font'    => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
                'fill'    => ['fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF1B3A5C']],
                'borders' => ['allBorders' => ['borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN, 'color' => ['argb' => 'FFD1D5DB']]],
            ]);

            $row = 2;
            foreach ($items as $p) {
                $rowData = array_values(array_map(fn ($def) => ($def['value'])($p), $activeCols));
                $sheet->fromArray($rowData, null, "A{$row}");

                // Apply money format to monetary columns
                $colIdx = 1;
                foreach ($activeCols as $def) {
                    if ($def['money']) {
                        $colLetter = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($colIdx);
                        $sheet->getStyle("{$colLetter}{$row}")->getNumberFormat()->setFormatCode('#,##0.00');
                    }
                    $colIdx++;
                }

                if ($row % 2 === 0) {
                    $sheet->getStyle("A{$row}:{$lastColLetter}{$row}")->getFill()
                        ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                        ->getStartColor()->setARGB('FFF9FAFB');
                }
                $row++;
            }

            foreach (range(1, count($headers)) as $colIdx) {
                $sheet->getColumnDimensionByColumn($colIdx)->setAutoSize(true);
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

    public function importPreview(Request $request): JsonResponse
    {
        $request->validate(['file' => 'required|file|max:10240']);

        $file      = $request->file('file');
        $extension = strtolower($file->getClientOriginalExtension());

        try {
            $rows = match(true) {
                $extension === 'tsv'                  => $this->parseFlatFile($file->getPathname(), "\t"),
                in_array($extension, ['xlsx', 'xls']) => $this->parseSpreadsheet($file->getPathname()),
                default                               => $this->parseFlatFile($file->getPathname(), ','),
            };
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Could not parse file: ' . $e->getMessage()], 422);
        }

        if (empty($rows)) {
            return response()->json(['message' => 'No data rows found in file.'], 422);
        }

        // Detect quantity column presence from the header keys of the first data row
        $firstRow          = $rows[0] ?? [];
        $hasQuantityColumn = array_key_exists('stock', $firstRow) || array_key_exists('quantity', $firstRow);

        $previewRows = [];
        $newCount    = 0;
        $updateCount = 0;
        $skipCount   = 0;

        foreach ($rows as $i => $row) {
            $rowNum = $i + 2;
            $name   = trim($row['name'] ?? '');
            $sku    = trim($row['sku'] ?? '');

            if (empty($name)) {
                $previewRows[] = [
                    'row_num'          => $rowNum,
                    'name'             => null,
                    'sku'              => $sku ?: null,
                    'status'           => 'skip',
                    'reason'           => "Missing 'name'",
                    'import_data'      => null,
                    'existing_product' => null,
                ];
                $skipCount++;
                continue;
            }

            $importQty  = $hasQuantityColumn ? (int) ($row['stock'] ?? $row['quantity'] ?? 0) : null;
            $importData = [
                'name'               => $name,
                'sku'                => $sku ?: null,
                'category'           => trim($row['category'] ?? '') ?: null,
                'unit'               => trim($row['unit'] ?? 'pc') ?: 'pc',
                'cost_price'         => (float) ($row['cost_price'] ?? $row['cost'] ?? 0),
                'base_selling_price' => (float) ($row['retail_price'] ?? $row['selling_price'] ?? $row['base_selling_price'] ?? 0),
                'quantity'           => $importQty,
            ];

            // Check if this product already exists — priority: SKU → name (case-insensitive)
            $matchedBy       = null;
            $existingProduct = null;
            if ($sku) {
                $existingProduct = Product::with(['category', 'stock'])->where('sku', $sku)->first();
                if ($existingProduct) $matchedBy = 'sku';
            }
            if (!$existingProduct) {
                $existingProduct = Product::with(['category', 'stock'])
                    ->whereRaw('LOWER(name) = ?', [strtolower($name)])
                    ->first();
                if ($existingProduct) $matchedBy = 'name';
            }

            $existing = null;
            if ($existingProduct) {
                $existing = [
                    'id'                 => $existingProduct->id,
                    'name'               => $existingProduct->name,
                    'sku'                => $existingProduct->sku,
                    'category'           => $existingProduct->category?->name,
                    'unit'               => $existingProduct->unit,
                    'cost_price'         => (float) $existingProduct->cost_price,
                    'base_selling_price' => (float) $existingProduct->base_selling_price,
                    'current_stock'      => $existingProduct->stock?->quantity_on_hand ?? 0,
                    'matched_by'         => $matchedBy,
                ];
            }

            if ($existing) {
                $matchLabel = $matchedBy === 'sku' ? "SKU '{$existing['sku']}'" : "name '{$name}'";
                if ($hasQuantityColumn) {
                    $previewRows[] = [
                        'row_num'          => $rowNum,
                        'name'             => $name,
                        'sku'              => $sku ?: $existing['sku'],
                        'status'           => 'existing',
                        'reason'           => "Matched by {$matchLabel} — stock will be updated",
                        'import_data'      => $importData,
                        'existing_product' => $existing,
                    ];
                    $updateCount++;
                } else {
                    $previewRows[] = [
                        'row_num'          => $rowNum,
                        'name'             => $name,
                        'sku'              => $sku ?: $existing['sku'],
                        'status'           => 'skip',
                        'reason'           => "Matched by {$matchLabel} — no quantity column to update",
                        'import_data'      => $importData,
                        'existing_product' => $existing,
                    ];
                    $skipCount++;
                }
            } else {
                $previewRows[] = [
                    'row_num'          => $rowNum,
                    'name'             => $name,
                    'sku'              => $sku ?: null,
                    'status'           => 'new',
                    'reason'           => null,
                    'import_data'      => $importData,
                    'existing_product' => null,
                ];
                $newCount++;
            }
        }

        return response()->json([
            'has_quantity_column' => $hasQuantityColumn,
            'rows'                => $previewRows,
            'summary'             => [
                'new_count'    => $newCount,
                'update_count' => $updateCount,
                'skip_count'   => $skipCount,
                'total'        => count($rows),
            ],
        ]);
    }

    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file'          => 'required|file|max:10240',
            'quantity_mode' => 'nullable|in:add,override',
        ]);

        $file         = $request->file('file');
        $extension    = strtolower($file->getClientOriginalExtension());
        $quantityMode = $request->input('quantity_mode', 'add');

        try {
            $rows = match(true) {
                $extension === 'tsv'                  => $this->parseFlatFile($file->getPathname(), "\t"),
                in_array($extension, ['xlsx', 'xls']) => $this->parseSpreadsheet($file->getPathname()),
                default                               => $this->parseFlatFile($file->getPathname(), ','),
            };
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Could not parse file: ' . $e->getMessage()], 422);
        }

        if (empty($rows)) {
            return response()->json(['message' => 'No data rows found in file.'], 422);
        }

        $retailTier    = ClientTier::where('name', 'Retail')->first();
        $wholesaleTier = ClientTier::where('name', 'Wholesale')->first();

        // Detect quantity column presence
        $firstRow          = $rows[0] ?? [];
        $hasQuantityColumn = array_key_exists('stock', $firstRow) || array_key_exists('quantity', $firstRow);

        $imported = 0;
        $updated  = 0;
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

                // Handle existing products — priority: SKU → name (case-insensitive)
                $existingProduct = $sku ? Product::where('sku', $sku)->first() : null;
                if (!$existingProduct) {
                    $existingProduct = Product::whereRaw('LOWER(name) = ?', [strtolower($name)])->first();
                }

                if ($existingProduct) {
                    if ($hasQuantityColumn) {
                        $importQty  = (int) ($row['stock'] ?? $row['quantity'] ?? 0);
                        $adjustType = $quantityMode === 'override' ? 'adjustment' : 'in';
                        $this->inventoryService->adjustStock(
                            $existingProduct,
                            $importQty,
                            $adjustType,
                            'import',
                            null,
                            null,
                            "Stock updated via import ({$quantityMode})",
                            $request->user()
                        );
                        $updated++;
                    } else {
                        $errors[] = "Row {$rowNum}: SKU '{$sku}' already exists — skipped (no quantity column).";
                        $skipped++;
                    }
                    continue;
                }

                // --- New product ---
                if (empty($sku)) {
                    $base      = 'IMP';
                    $candidate = Product::where('sku', 'like', "{$base}-%")->count() + 1 + $imported;
                    do {
                        $sku = $base . '-' . str_pad($candidate, 4, '0', STR_PAD_LEFT);
                        $candidate++;
                    } while (Product::where('sku', $sku)->exists());
                }

                $categoryId   = null;
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

        $parts = [];
        if ($imported > 0) $parts[] = "{$imported} product(s) created";
        if ($updated  > 0) $parts[] = "{$updated} stock update(s)";
        if ($skipped  > 0) $parts[] = "{$skipped} skipped";
        $message = 'Import complete. ' . implode(', ', $parts) . '.';

        if ($imported > 0 || $updated > 0) {
            AuditService::log('imported', 'products', null, null, [
                'imported'      => $imported,
                'updated'       => $updated,
                'skipped'       => $skipped,
                'quantity_mode' => $quantityMode,
            ]);
        }

        return response()->json([
            'imported' => $imported,
            'updated'  => $updated,
            'skipped'  => $skipped,
            'errors'   => $errors,
            'message'  => $message,
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
