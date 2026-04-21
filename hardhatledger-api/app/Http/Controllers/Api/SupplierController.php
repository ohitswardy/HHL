<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Supplier\StoreSupplierRequest;
use App\Http\Requests\Supplier\UpdateSupplierRequest;
use App\Http\Resources\SupplierResource;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SupplierController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Supplier::query();

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('contact_person', 'like', "%{$search}%");
            });
        }

        $suppliers = $query->orderBy('name')->paginate($request->get('per_page', 20));

        return response()->json([
            'data' => SupplierResource::collection($suppliers),
            'meta' => [
                'current_page' => $suppliers->currentPage(),
                'last_page'    => $suppliers->lastPage(),
                'per_page'     => $suppliers->perPage(),
                'total'        => $suppliers->total(),
            ],
        ]);
    }

    public function store(StoreSupplierRequest $request): JsonResponse
    {
        $supplier = Supplier::create($request->validated());
        return response()->json(['data' => new SupplierResource($supplier)], 201);
    }

    public function show(Supplier $supplier): JsonResponse
    {
        return response()->json(['data' => new SupplierResource($supplier)]);
    }

    public function update(UpdateSupplierRequest $request, Supplier $supplier): JsonResponse
    {
        $supplier->update($request->validated());
        return response()->json(['data' => new SupplierResource($supplier)]);
    }

    public function destroy(Supplier $supplier): JsonResponse
    {
        $supplier->delete();
        return response()->json(null, 204);
    }

    // -------------------------------------------------------------------------
    // IMPORT — Preview
    // -------------------------------------------------------------------------
    public function importPreview(Request $request): JsonResponse
    {
        $request->validate(['file' => 'required|file|mimes:csv,txt,xlsx,xls|max:10240']);

        $file      = $request->file('file');
        $extension = strtolower($file->getClientOriginalExtension());

        try {
            $rows = in_array($extension, ['xlsx', 'xls'])
                ? $this->parseSpreadsheet($file->getPathname())
                : $this->parseCsv($file->getPathname());
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Could not parse file: ' . $e->getMessage()], 422);
        }

        if (empty($rows)) {
            return response()->json(['message' => 'No data rows found in file.'], 422);
        }

        $preview   = [];
        $newCount  = 0;
        $skipCount = 0;
        $dupCount  = 0;

        foreach ($rows as $i => $row) {
            $rowNum = $i + 2;
            $name   = trim($row['supplier_name'] ?? $row['name'] ?? '');

            if (empty($name)) {
                $preview[] = [
                    'row_num' => $rowNum,
                    'name'    => '(empty)',
                    'status'  => 'skip',
                    'reason'  => 'Missing name',
                    'data'    => null,
                ];
                $skipCount++;
                continue;
            }

            $mapped   = $this->mapRow($row, $name);
            $existing = Supplier::whereRaw('LOWER(name) = ?', [strtolower($name)])->first();

            if ($existing) {
                $preview[] = [
                    'row_num' => $rowNum,
                    'name'    => $name,
                    'status'  => 'duplicate',
                    'reason'  => "Already exists (ID {$existing->id})",
                    'data'    => $mapped,
                ];
                $dupCount++;
            } else {
                $preview[] = [
                    'row_num' => $rowNum,
                    'name'    => $name,
                    'status'  => 'new',
                    'reason'  => null,
                    'data'    => $mapped,
                ];
                $newCount++;
            }
        }

        return response()->json([
            'rows'    => $preview,
            'summary' => [
                'new_count'  => $newCount,
                'dup_count'  => $dupCount,
                'skip_count' => $skipCount,
                'total'      => count($rows),
            ],
        ]);
    }

    // -------------------------------------------------------------------------
    // IMPORT — Commit
    // -------------------------------------------------------------------------
    public function import(Request $request): JsonResponse
    {
        $request->validate(['file' => 'required|file|mimes:csv,txt,xlsx,xls|max:10240']);

        $file      = $request->file('file');
        $extension = strtolower($file->getClientOriginalExtension());

        try {
            $rows = in_array($extension, ['xlsx', 'xls'])
                ? $this->parseSpreadsheet($file->getPathname())
                : $this->parseCsv($file->getPathname());
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Could not parse file: ' . $e->getMessage()], 422);
        }

        if (empty($rows)) {
            return response()->json(['message' => 'No data rows found.'], 422);
        }

        $imported = 0;
        $skipped  = 0;
        $errors   = [];

        DB::beginTransaction();
        try {
            foreach ($rows as $i => $row) {
                $name = trim($row['supplier_name'] ?? $row['name'] ?? '');

                if (empty($name)) {
                    $skipped++;
                    continue;
                }

                if (Supplier::whereRaw('LOWER(name) = ?', [strtolower($name)])->exists()) {
                    $skipped++;
                    continue;
                }

                Supplier::create($this->mapRow($row, $name));
                $imported++;
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Import failed: ' . $e->getMessage()], 500);
        }

        $parts = [];
        if ($imported > 0) $parts[] = "{$imported} supplier(s) imported";
        if ($skipped  > 0) $parts[] = "{$skipped} skipped";

        return response()->json([
            'imported' => $imported,
            'skipped'  => $skipped,
            'errors'   => $errors,
            'message'  => 'Import complete. ' . implode(', ', $parts) . '.',
        ]);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------
    private function mapRow(array $row, string $name): array
    {
        // Merge address + city + region into one field (website is dropped)
        $addressParts = array_filter([
            trim($row['address'] ?? ''),
            trim($row['city'] ?? ''),
            trim($row['region'] ?? ''),
        ], fn($v) => $v !== '');
        $address = implode(', ', $addressParts) ?: null;

        return [
            'name'          => $name,
            'contact_person'=> null,
            'phone'         => null,
            'email'         => null,
            'address'       => $address,
            'payment_terms' => trim($row['terms'] ?? $row['payment_terms'] ?? '') ?: null,
            'notes'         => trim($row['note'] ?? $row['notes'] ?? '') ?: null,
            'is_vatable'    => false,
        ];
    }

    private function normalizeHeader(string $h): string
    {
        $h = preg_replace('/^\xEF\xBB\xBF/', '', $h); // strip UTF-8 BOM
        return strtolower(trim(str_replace([' ', '-'], '_', $h)));
    }

    private function parseCsv(string $path): array
    {
        $rows   = [];
        $handle = fopen($path, 'r');
        if (!$handle) {
            throw new \RuntimeException('Cannot open uploaded file.');
        }

        $headers = null;
        while (($line = fgetcsv($handle, 0, ',')) !== false) {
            if ($headers === null) {
                $headers = array_map(fn($h) => $this->normalizeHeader($h), $line);
                continue;
            }
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
