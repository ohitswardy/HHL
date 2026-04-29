<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class AddDashboardPermissionSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $permission = Permission::firstOrCreate([
            'name'       => 'dashboard.view',
            'guard_name' => 'web',
        ]);

        // Grant to all standard roles — Super Admin gets it implicitly via wildcard
        foreach (['Sales Clerk', 'Admin', 'Manager', 'Super Admin'] as $roleName) {
            $role = Role::where('name', $roleName)->where('guard_name', 'web')->first();
            if ($role) {
                $role->givePermissionTo($permission);
                $this->command->info("Assigned dashboard.view to {$roleName}");
            }
        }
    }
}
