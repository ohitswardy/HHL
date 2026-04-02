<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\InventoryStock;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\SalesTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function summary(): JsonResponse
    {
        $todaysSales = SalesTransaction::whereDate('created_at', today())
            ->where('status', 'completed')
            ->sum('total_amount');

        $pendingPOs = PurchaseOrder::whereIn('status', ['draft', 'sent', 'partial'])->count();

        $lowStockCount = Product::where('is_active', true)
            ->whereHas('stock', function ($q) {
                $q->whereRaw('quantity_on_hand <= (SELECT reorder_level FROM products WHERE products.id = inventory_stock.product_id)');
            })
            ->count();

        $totalClients = Client::count();
        $totalProducts = Product::where('is_active', true)->count();

        $recentTransactions = SalesTransaction::with(['client', 'user'])
            ->orderByDesc('created_at')
            ->limit(10)
            ->get()
            ->map(fn ($t) => [
                'id' => $t->id,
                'transaction_number' => $t->transaction_number,
                'client' => $t->client?->business_name ?? 'Walk-in',
                'user' => $t->user?->name,
                'total_amount' => (float) $t->total_amount,
                'status' => $t->status,
                'created_at' => $t->created_at->toISOString(),
            ]);

        // Sales trend (last 7 days)
        $salesTrend = SalesTransaction::where('status', 'completed')
            ->where('created_at', '>=', now()->subDays(7))
            ->select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('SUM(total_amount) as total'),
                DB::raw('COUNT(*) as count')
            )
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return response()->json([
            'todays_sales' => (float) $todaysSales,
            'pending_pos' => $pendingPOs,
            'low_stock_count' => $lowStockCount,
            'total_clients' => $totalClients,
            'total_products' => $totalProducts,
            'recent_transactions' => $recentTransactions,
            'sales_trend' => $salesTrend,
        ]);
    }
}
