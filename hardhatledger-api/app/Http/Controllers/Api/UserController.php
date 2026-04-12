<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::with('roles');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->filled('role')) {
            $query->role($request->role);
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $users = $query->orderBy('name')->paginate($request->get('per_page', 15));

        return response()->json([
            'data' => UserResource::collection($users),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
            'role' => 'required|string|exists:roles,name',
            'is_active' => 'boolean',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => $validated['password'],
            'is_active' => $validated['is_active'] ?? true,
        ]);

        $user->assignRole($validated['role']);

        AuditService::log('created', 'users', $user->id, null, [
            'name'  => $user->name,
            'email' => $user->email,
            'role'  => $validated['role'],
        ]);

        return response()->json([
            'data' => new UserResource($user->load('roles')),
            'message' => 'User created successfully.',
        ], 201);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json([
            'data' => new UserResource($user->load('roles')),
        ]);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('users')->ignore($user->id)],
            'password' => 'sometimes|string|min:8|confirmed',
            'role' => 'sometimes|string|exists:roles,name',
            'is_active' => 'sometimes|boolean',
        ]);

        $old = ['name' => $user->name, 'email' => $user->email, 'is_active' => $user->is_active, 'role' => $user->getRoleNames()->first()];

        $user->update(collect($validated)->except('role')->toArray());

        if (isset($validated['role'])) {
            $user->syncRoles([$validated['role']]);
        }

        AuditService::log('updated', 'users', $user->id, $old, [
            'name'      => $user->fresh()->name,
            'email'     => $user->fresh()->email,
            'is_active' => $user->fresh()->is_active,
            'role'      => $user->fresh()->getRoleNames()->first(),
        ]);

        return response()->json([
            'data' => new UserResource($user->fresh()->load('roles')),
            'message' => 'User updated successfully.',
        ]);
    }

    public function destroy(User $user): JsonResponse
    {
        if ($user->id === auth()->id()) {
            return response()->json(['message' => 'You cannot delete your own account.'], 403);
        }

        $snapshot = ['name' => $user->name, 'email' => $user->email, 'role' => $user->getRoleNames()->first()];

        $user->tokens()->delete();
        $user->delete();

        AuditService::log('deleted', 'users', $user->id, $snapshot, null);

        return response()->json(['message' => 'User deleted successfully.']);
    }
}
