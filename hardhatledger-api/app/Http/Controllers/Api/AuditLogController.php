<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::with('user')->latest();

        // Free-text search: user name, table, action, IP
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('table_name', 'like', "%{$search}%")
                  ->orWhere('action', 'like', "%{$search}%")
                  ->orWhere('ip_address', 'like', "%{$search}%")
                  ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$search}%"));
            });
        }

        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }

        if ($request->filled('table_name')) {
            $query->where('table_name', $request->table_name);
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        $logs = $query->paginate($request->get('per_page', 25));

        // Distinct action + table_name lists for filter dropdowns
        $actions    = AuditLog::distinct()->orderBy('action')->pluck('action');
        $tables     = AuditLog::distinct()->orderBy('table_name')->pluck('table_name');

        return response()->json([
            'data' => AuditLogResource::collection($logs),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page'    => $logs->lastPage(),
                'per_page'     => $logs->perPage(),
                'total'        => $logs->total(),
            ],
            'filters' => [
                'actions'     => $actions,
                'table_names' => $tables,
            ],
        ]);
    }

    public function show(AuditLog $auditLog): JsonResponse
    {
        return response()->json([
            'data' => new AuditLogResource($auditLog->load('user')),
        ]);
    }

    public function stats(): JsonResponse
    {
        $today = now()->toDateString();

        return response()->json([
            'data' => [
                'total'        => AuditLog::count(),
                'today'        => AuditLog::whereDate('created_at', $today)->count(),
                'unique_users' => AuditLog::whereNotNull('user_id')->distinct('user_id')->count(),
            ],
        ]);
    }
}
