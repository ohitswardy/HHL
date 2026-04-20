<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DataPurgeLog;
use App\Services\AuditService;
use App\Services\DataPurgeService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DataPurgeController extends Controller
{
    public function __construct(
        private DataPurgeService $purgeService
    ) {}

    /**
     * Get eligible months for purging and purge status.
     */
    public function eligibleMonths(): JsonResponse
    {
        $months = $this->purgeService->getEligibleMonths();

        // Mark already-purged months
        $months = array_map(function ($m) {
            $m['already_purged'] = $this->purgeService->isAlreadyPurged($m['year'], $m['month']);
            return $m;
        }, $months);

        return response()->json(['data' => $months]);
    }

    /**
     * Preview what will be purged for a given month.
     */
    public function preview(Request $request): JsonResponse
    {
        $request->validate([
            'year' => 'required|integer|min:2020',
            'month' => 'required|integer|min:1|max:12',
        ]);

        $year = (int) $request->year;
        $month = (int) $request->month;

        // Validate the month is at least 1 month old
        $targetDate = Carbon::create($year, $month, 1)->endOfMonth();
        $oneMonthAgo = Carbon::now()->subMonth()->startOfMonth();

        if ($targetDate->greaterThanOrEqualTo($oneMonthAgo)) {
            return response()->json([
                'message' => 'Cannot purge data less than 1 month old.',
            ], 422);
        }

        // Check if already purged
        if ($this->purgeService->isAlreadyPurged($year, $month)) {
            return response()->json([
                'message' => 'This month has already been purged.',
            ], 422);
        }

        $preview = $this->purgeService->preview($year, $month);

        return response()->json(['data' => $preview]);
    }

    /**
     * Execute the purge for a given month.
     */
    public function execute(Request $request): JsonResponse
    {
        $request->validate([
            'year' => 'required|integer|min:2020',
            'month' => 'required|integer|min:1|max:12',
            'confirmation' => 'required|string|in:PURGE',
            'notes' => 'nullable|string|max:500',
        ]);

        $year = (int) $request->year;
        $month = (int) $request->month;

        // Validate the month is at least 1 month old
        $targetDate = Carbon::create($year, $month, 1)->endOfMonth();
        $oneMonthAgo = Carbon::now()->subMonth()->startOfMonth();

        if ($targetDate->greaterThanOrEqualTo($oneMonthAgo)) {
            return response()->json([
                'message' => 'Cannot purge data less than 1 month old.',
            ], 422);
        }

        // Check if already purged
        if ($this->purgeService->isAlreadyPurged($year, $month)) {
            return response()->json([
                'message' => 'This month has already been purged.',
            ], 422);
        }

        $purgeLog = $this->purgeService->execute(
            $year,
            $month,
            $request->user()->id,
            $request->notes
        );

        // Audit trail
        AuditService::log(
            'data_purge',
            'data_purge_logs',
            $purgeLog->id,
            null,
            $purgeLog->toArray()
        );

        return response()->json([
            'message' => 'Data purge completed successfully.',
            'data' => $purgeLog,
        ]);
    }

    /**
     * Get purge history.
     */
    public function history(Request $request): JsonResponse
    {
        $logs = DataPurgeLog::with('user:id,name')
            ->orderByDesc('created_at')
            ->paginate($request->get('per_page', 15));

        return response()->json($logs);
    }
}
