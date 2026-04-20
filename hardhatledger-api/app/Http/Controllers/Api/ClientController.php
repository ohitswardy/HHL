<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Client\StoreClientRequest;
use App\Http\Requests\Client\UpdateClientRequest;
use App\Http\Resources\ClientResource;
use App\Models\Client;
use App\Models\ClientTier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClientController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Client::withComputedBalance()->with('tier');

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('business_name', 'like', "%{$search}%")
                  ->orWhere('contact_person', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if ($tierId = $request->get('client_tier_id')) {
            $query->where('client_tier_id', $tierId);
        }

        $clients = $query->orderBy('business_name')->paginate($request->get('per_page', 20));

        return response()->json([
            'data' => ClientResource::collection($clients),
            'meta' => [
                'current_page' => $clients->currentPage(),
                'last_page'    => $clients->lastPage(),
                'per_page'     => $clients->perPage(),
                'total'        => $clients->total(),
            ],
        ]);
    }

    public function store(StoreClientRequest $request): JsonResponse
    {
        $client = Client::create($request->validated());
        $client->load('tier');
        return response()->json(['data' => new ClientResource($client)], 201);
    }

    public function show(Client $client): JsonResponse
    {
        $client = Client::withComputedBalance()->with('tier')->findOrFail($client->id);
        return response()->json(['data' => new ClientResource($client)]);
    }

    public function update(UpdateClientRequest $request, Client $client): JsonResponse
    {
        $client->update($request->validated());
        $client->load('tier');
        return response()->json(['data' => new ClientResource($client)]);
    }

    public function destroy(Client $client): JsonResponse
    {
        $client->delete();
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

        $defaultTierId = $this->defaultTierId();

        $preview   = [];
        $newCount  = 0;
        $skipCount = 0;
        $dupCount  = 0;

        foreach ($rows as $i => $row) {
            $rowNum = $i + 2;
            $name   = trim($row['customer_name'] ?? $row['business_name'] ?? $row['name'] ?? '');

            // Skip blank or explicitly cancelled entries
            if (empty($name) || strtolower($name) === 'cancelled') {
                $preview[] = [
                    'row_num' => $rowNum,
                    'name'    => $name ?: '(empty)',
                    'status'  => 'skip',
                    'reason'  => empty($name) ? 'Missing name' : 'Marked CANCELLED',
                    'data'    => null,
                ];
                $skipCount++;
                continue;
            }

            $mapped = $this->mapRow($row, $name, $defaultTierId);

            $existing = Client::whereRaw('LOWER(business_name) = ?', [strtolower($name)])->first();

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

        $defaultTierId = $this->defaultTierId();

        if (!$defaultTierId) {
            return response()->json(['message' => 'No client tiers found. Please create at least one client tier before importing.'], 422);
        }

        $imported = 0;
        $skipped  = 0;
        $errors   = [];

        DB::beginTransaction();
        try {
            foreach ($rows as $i => $row) {
                $rowNum = $i + 2;
                $name   = trim($row['customer_name'] ?? $row['business_name'] ?? $row['name'] ?? '');

                if (empty($name) || strtolower($name) === 'cancelled') {
                    $skipped++;
                    continue;
                }

                // Skip duplicates
                if (Client::whereRaw('LOWER(business_name) = ?', [strtolower($name)])->exists()) {
                    $skipped++;
                    continue;
                }

                Client::create($this->mapRow($row, $name, $defaultTierId));
                $imported++;
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Import failed: ' . $e->getMessage()], 500);
        }

        $parts = [];
        if ($imported > 0) $parts[] = "{$imported} client(s) imported";
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
    private function defaultTierId(): ?int
    {
        $tier = ClientTier::where('name', 'Retail')->first()
            ?? ClientTier::orderBy('id')->first();

        return $tier?->id;
    }

    private function mapRow(array $row, string $name, int $defaultTierId): array
    {
        // Merge address + city + province into one field
        $addressParts = array_filter([
            trim($row['address'] ?? ''),
            trim($row['city'] ?? ''),
            trim($row['province'] ?? ''),
        ], fn($v) => $v !== '');
        $address = implode(', ', $addressParts) ?: null;

        // Phone: prefer phone column; fallback to customer_code if purely numeric
        $phone = trim($row['phone'] ?? '');
        if (empty($phone)) {
            $code  = trim($row['customer_code'] ?? '');
            $phone = preg_match('/^\d+$/', $code) ? $code : '';
        }

        return [
            'business_name'  => $name,
            'contact_person' => null,
            'email'          => filter_var(trim($row['email'] ?? ''), FILTER_VALIDATE_EMAIL) ?: null,
            'phone'          => $phone ?: null,
            'address'        => $address,
            'notes'          => trim($row['note'] ?? $row['notes'] ?? '') ?: null,
            'client_tier_id' => $defaultTierId,
            'credit_limit'   => 0,
            'branch_id'      => null,
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
