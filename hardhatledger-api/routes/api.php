<?php

use App\Http\Controllers\Api\AccountingController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\ClientTierController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\PosController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

// v1 API routes
Route::prefix('v1')->group(function () {

    // Public auth
    Route::post('/auth/login', [AuthController::class, 'login']);

    // Protected routes
    Route::middleware('auth:sanctum')->group(function () {

        // Auth
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);

        // Dashboard (all authenticated users)
        Route::get('/dashboard', [DashboardController::class, 'summary']);

        // User Management (Super Admin only)
        Route::middleware('permission:users.view')->group(function () {
            Route::apiResource('users', UserController::class);
        });

        // Role Management
        Route::middleware('permission:roles.view')->group(function () {
            Route::get('/roles', [RoleController::class, 'index']);
            Route::get('/roles/permissions', [RoleController::class, 'permissions']);
            Route::get('/roles/{role}', [RoleController::class, 'show']);
        });
        Route::middleware('permission:roles.manage')->group(function () {
            Route::post('/roles', [RoleController::class, 'store']);
            Route::put('/roles/{role}', [RoleController::class, 'update']);
            Route::delete('/roles/{role}', [RoleController::class, 'destroy']);
        });

        // Client Tiers
        Route::middleware('permission:client-tiers.view')->group(function () {
            Route::get('/client-tiers', [ClientTierController::class, 'index']);
            Route::get('/client-tiers/{client_tier}', [ClientTierController::class, 'show']);
        });
        Route::middleware('permission:client-tiers.create')->post('/client-tiers', [ClientTierController::class, 'store']);
        Route::middleware('permission:client-tiers.edit')->put('/client-tiers/{client_tier}', [ClientTierController::class, 'update']);
        Route::middleware('permission:client-tiers.delete')->delete('/client-tiers/{client_tier}', [ClientTierController::class, 'destroy']);

        // Clients
        Route::middleware('permission:clients.view')->group(function () {
            Route::get('/clients', [ClientController::class, 'index']);
            Route::get('/clients/{client}', [ClientController::class, 'show']);
        });
        Route::middleware('permission:clients.create')->post('/clients', [ClientController::class, 'store']);
        Route::middleware('permission:clients.edit')->put('/clients/{client}', [ClientController::class, 'update']);
        Route::middleware('permission:clients.delete')->delete('/clients/{client}', [ClientController::class, 'destroy']);

        // Categories
        Route::middleware('permission:categories.view')->group(function () {
            Route::get('/categories', [CategoryController::class, 'index']);
            Route::get('/categories/{category}', [CategoryController::class, 'show']);
        });
        Route::middleware('permission:categories.create')->post('/categories', [CategoryController::class, 'store']);
        Route::middleware('permission:categories.edit')->put('/categories/{category}', [CategoryController::class, 'update']);
        Route::middleware('permission:categories.delete')->delete('/categories/{category}', [CategoryController::class, 'destroy']);

        // Suppliers
        Route::middleware('permission:suppliers.view')->group(function () {
            Route::get('/suppliers', [SupplierController::class, 'index']);
            Route::get('/suppliers/{supplier}', [SupplierController::class, 'show']);
        });
        Route::middleware('permission:suppliers.create')->post('/suppliers', [SupplierController::class, 'store']);
        Route::middleware('permission:suppliers.edit')->put('/suppliers/{supplier}', [SupplierController::class, 'update']);
        Route::middleware('permission:suppliers.delete')->delete('/suppliers/{supplier}', [SupplierController::class, 'destroy']);

        // Products
        Route::middleware('permission:products.view')->group(function () {
            Route::get('/products', [ProductController::class, 'index']);
            Route::get('/products/export/pdf', [ProductController::class, 'exportPdf']);
            Route::get('/products/export/csv', [ProductController::class, 'exportCsv']);
            Route::get('/products/export/xlsx', [ProductController::class, 'exportXlsx']);
            Route::get('/products/{product}', [ProductController::class, 'show']);
            Route::get('/products/{product}/price', [ProductController::class, 'getPrice']);
        });
        Route::middleware('permission:products.create')->group(function () {
            Route::post('/products', [ProductController::class, 'store']);
            Route::post('/products/import', [ProductController::class, 'import']);
        });
        Route::middleware('permission:products.edit')->group(function () {
            Route::put('/products/{product}', [ProductController::class, 'update']);
            Route::put('/products/{product}/tier-prices', [ProductController::class, 'updateTierPrices']);
        });
        Route::middleware('permission:products.delete')->delete('/products/{product}', [ProductController::class, 'destroy']);

        // Inventory
        Route::middleware('permission:inventory.view')->group(function () {
            Route::get('/inventory', [InventoryController::class, 'index']);
            Route::get('/inventory/movements', [InventoryController::class, 'movements']);
            Route::get('/inventory/movements/print', [InventoryController::class, 'printMovements']);
            Route::get('/inventory/low-stock', [InventoryController::class, 'lowStock']);
        });
        Route::middleware('permission:inventory.adjust')->post('/inventory/adjust', [InventoryController::class, 'adjustStock']);

        // Purchase Orders
        Route::middleware('permission:purchase-orders.view')->group(function () {
            Route::get('/purchase-orders', [PurchaseOrderController::class, 'index']);
            Route::get('/purchase-orders/{purchase_order}', [PurchaseOrderController::class, 'show']);
        });
        Route::middleware('permission:purchase-orders.create')->post('/purchase-orders', [PurchaseOrderController::class, 'store']);
        Route::middleware('permission:purchase-orders.receive')->post('/purchase-orders/{purchase_order}/receive', [PurchaseOrderController::class, 'receive']);

        // POS
        Route::prefix('pos')->group(function () {
            Route::middleware('permission:pos.access')->group(function () {
                Route::get('/sales', [PosController::class, 'index']);
                Route::get('/sales/{sale}', [PosController::class, 'show']);
                Route::get('/sales/{sale}/receipt', [PosController::class, 'receipt']);
                Route::get('/reports/export', [PosController::class, 'exportReport']);
            });
            Route::middleware('permission:pos.create-sale')->post('/sales', [PosController::class, 'createSale']);
            Route::middleware('permission:pos.void-sale')->post('/sales/{sale}/void', [PosController::class, 'voidSale']);
            Route::middleware('permission:pos.void-sale')->patch('/sales/{sale}', [PosController::class, 'updateSale']);
            Route::middleware('permission:pos.access')->patch('/sales/{sale}/complete', [PosController::class, 'markCompleted']);
            Route::middleware('permission:pos.access')->post('/sales/{sale}/record-payment', [PosController::class, 'recordPayment']);
            Route::middleware('permission:pos.view-daily-summary')->get('/daily-summary', [PosController::class, 'dailySummary']);
        });

        // Accounting
        Route::prefix('accounting')->middleware('permission:accounting.view')->group(function () {
            Route::get('/chart-of-accounts', [AccountingController::class, 'chartOfAccounts']);
            Route::get('/journal-entries', [AccountingController::class, 'journalEntries']);
            Route::get('/reports/income-statement', [AccountingController::class, 'incomeStatement']);
            Route::get('/reports/balance-sheet', [AccountingController::class, 'balanceSheet']);
            Route::get('/reports/cash-flow', [AccountingController::class, 'cashFlow']);
            Route::get('/reports/client-statement', [AccountingController::class, 'clientStatement']);
            Route::get('/reports/client-statement/pdf', [AccountingController::class, 'clientStatementPdf']);
        });
    });
});
