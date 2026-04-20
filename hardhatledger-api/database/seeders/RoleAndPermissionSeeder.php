<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleAndPermissionSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Inventory permissions
        $inventoryPermissions = [
            'products.view', 'products.create', 'products.edit', 'products.delete',
            'categories.view', 'categories.create', 'categories.edit', 'categories.delete',
            'inventory.view', 'inventory.adjust',
            'purchase-orders.view', 'purchase-orders.create', 'purchase-orders.edit', 'purchase-orders.receive', 'purchase-orders.cancel',
        ];

        // Supplier permissions
        $supplierPermissions = [
            'suppliers.view', 'suppliers.create', 'suppliers.edit', 'suppliers.delete',
        ];

        // Client permissions
        $clientPermissions = [
            'clients.view', 'clients.create', 'clients.edit', 'clients.delete',
            'client-tiers.view', 'client-tiers.create', 'client-tiers.edit', 'client-tiers.delete',
        ];

        // POS permissions
        $posPermissions = [
            'pos.access', 'pos.create-sale', 'pos.void-sale', 'pos.process-refund',
            'pos.apply-discount', 'pos.view-daily-summary',
        ];

        // Accounting permissions
        $accountingPermissions = [
            'accounting.view', 'accounting.journal-entries',
            'reports.income-statement', 'reports.balance-sheet', 'reports.cash-flow',
            'reports.client-statements', 'reports.sales-report',
            'bank-reconciliation.view', 'bank-reconciliation.manage',
        ];

        // System permissions
        $systemPermissions = [
            'users.view', 'users.create', 'users.edit', 'users.delete',
            'roles.view', 'roles.manage',
            'audit-logs.view',
            'settings.manage',
            'database-control.access',
        ];

        $allPermissions = array_merge(
            $inventoryPermissions,
            $supplierPermissions,
            $clientPermissions,
            $posPermissions,
            $accountingPermissions,
            $systemPermissions
        );

        foreach ($allPermissions as $permission) {
            Permission::create(['name' => $permission]);
        }

        // Sales Clerk: POS access + basic client/product viewing
        Role::create(['name' => 'Sales Clerk'])->givePermissionTo([
            'pos.access', 'pos.create-sale',
            'products.view', 'categories.view', 'inventory.view',
            'clients.view',
        ]);

        // Admin: review transactions, manage clients, view reports
        Role::create(['name' => 'Admin'])->givePermissionTo(array_merge(
            $posPermissions,
            $clientPermissions,
            ['products.view', 'categories.view', 'inventory.view'],
            ['suppliers.view'],
            ['accounting.view', 'reports.sales-report', 'reports.client-statements'],
            ['pos.view-daily-summary'],
        ));

        // Manager: full access except system config; full user management access
        Role::create(['name' => 'Manager'])->givePermissionTo(array_merge(
            $inventoryPermissions,
            $supplierPermissions,
            $clientPermissions,
            $posPermissions,
            $accountingPermissions,
            ['users.view', 'users.create', 'users.edit', 'users.delete'],
        ));

        // Super Admin: everything
        Role::create(['name' => 'Super Admin'])->givePermissionTo($allPermissions);
    }
}
