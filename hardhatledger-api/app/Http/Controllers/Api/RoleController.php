<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        $roles = Role::with('permissions')
            ->orderBy('name')
            ->get()
            ->map(fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
                'guard_name' => $role->guard_name,
                'permissions' => $role->permissions->pluck('name'),
                'users_count' => $role->users()->count(),
                'created_at' => $role->created_at?->toISOString(),
            ]);

        return response()->json(['data' => $roles]);
    }

    public function show(Role $role): JsonResponse
    {
        return response()->json([
            'data' => [
                'id' => $role->id,
                'name' => $role->name,
                'guard_name' => $role->guard_name,
                'permissions' => $role->permissions->pluck('name'),
                'users_count' => $role->users()->count(),
                'created_at' => $role->created_at?->toISOString(),
            ],
        ]);
    }

    public function permissions(): JsonResponse
    {
        $permissions = Permission::orderBy('name')
            ->pluck('name')
            ->groupBy(fn (string $p) => explode('.', $p)[0]);

        return response()->json(['data' => $permissions]);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        $validated = $request->validate([
            'permissions' => 'required|array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $oldPerms = $role->permissions->pluck('name')->sort()->values()->toArray();

        $role->syncPermissions($validated['permissions']);

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        AuditService::log('permissions_updated', 'roles', $role->id,
            ['permissions' => $oldPerms],
            ['permissions' => collect($validated['permissions'])->sort()->values()->toArray()]
        );

        return response()->json([
            'data' => [
                'id' => $role->id,
                'name' => $role->name,
                'guard_name' => $role->guard_name,
                'permissions' => $role->permissions()->pluck('name'),
                'users_count' => $role->users()->count(),
                'created_at' => $role->created_at?->toISOString(),
            ],
            'message' => 'Role permissions updated successfully.',
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('roles', 'name')],
            'permissions' => 'array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $role = Role::create(['name' => $validated['name'], 'guard_name' => 'web']);

        if (!empty($validated['permissions'])) {
            $role->syncPermissions($validated['permissions']);
        }

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        AuditService::log('created', 'roles', $role->id, null, ['name' => $role->name]);

        return response()->json([
            'data' => [
                'id' => $role->id,
                'name' => $role->name,
                'guard_name' => $role->guard_name,
                'permissions' => $role->permissions()->pluck('name'),
                'users_count' => 0,
                'created_at' => $role->created_at?->toISOString(),
            ],
            'message' => 'Role created successfully.',
        ], 201);
    }

    public function destroy(Role $role): JsonResponse
    {
        $protected = ['Super Admin', 'Admin', 'Manager', 'Sales Clerk'];
        if (in_array($role->name, $protected)) {
            return response()->json(['message' => 'System roles cannot be deleted.'], 403);
        }

        if ($role->users()->count() > 0) {
            return response()->json(['message' => 'Cannot delete a role that is assigned to users.'], 422);
        }

        AuditService::log('deleted', 'roles', $role->id, ['name' => $role->name], null);

        $role->delete();

        return response()->json(['message' => 'Role deleted successfully.']);
    }

    public function rename(Request $request, Role $role): JsonResponse
    {
        $protected = ['Super Admin', 'Admin', 'Manager', 'Sales Clerk'];
        if (in_array($role->name, $protected)) {
            return response()->json(['message' => 'System roles cannot be renamed.'], 403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('roles', 'name')->ignore($role->id)],
        ]);

        $oldName = $role->name;
        $role->update(['name' => $validated['name']]);

        AuditService::log('renamed', 'roles', $role->id, ['name' => $oldName], ['name' => $role->name]);

        return response()->json([
            'data' => [
                'id' => $role->id,
                'name' => $role->name,
                'guard_name' => $role->guard_name,
                'permissions' => $role->permissions()->pluck('name'),
                'users_count' => $role->users()->count(),
                'created_at' => $role->created_at?->toISOString(),
            ],
            'message' => 'Role renamed successfully.',
        ]);
    }

    public function clone(Request $request, Role $role): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('roles', 'name')],
        ]);

        $newRole = Role::create(['name' => $validated['name'], 'guard_name' => 'web']);
        $newRole->syncPermissions($role->permissions);

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        AuditService::log('cloned', 'roles', $newRole->id, ['cloned_from' => $role->name], ['name' => $newRole->name]);

        return response()->json([
            'data' => [
                'id' => $newRole->id,
                'name' => $newRole->name,
                'guard_name' => $newRole->guard_name,
                'permissions' => $newRole->permissions()->pluck('name'),
                'users_count' => 0,
                'created_at' => $newRole->created_at?->toISOString(),
            ],
            'message' => "Role \"{$newRole->name}\" created as a copy of \"{$role->name}\".",
        ], 201);
    }
}
