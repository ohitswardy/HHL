<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\AuditLog;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            AuditLog::create([
                'user_id'    => $user?->id,
                'action'     => 'login_failed',
                'table_name' => 'users',
                'record_id'  => $user?->id,
                'old_value'  => null,
                'new_value'  => ['email' => $request->email, 'reason' => 'invalid_credentials'],
                'ip_address' => $request->ip(),
                'branch_id'  => config('app.default_branch_id'),
            ]);
            return response()->json(['message' => 'Invalid credentials.'], 401);
        }

        if (!$user->is_active) {
            AuditLog::create([
                'user_id'    => $user->id,
                'action'     => 'login_failed',
                'table_name' => 'users',
                'record_id'  => $user->id,
                'old_value'  => null,
                'new_value'  => ['email' => $request->email, 'reason' => 'account_deactivated'],
                'ip_address' => $request->ip(),
                'branch_id'  => config('app.default_branch_id'),
            ]);
            return response()->json(['message' => 'Account is deactivated.'], 403);
        }

        $user->update(['last_login_at' => now()]);
        $token = $user->createToken('auth-token')->plainTextToken;

        // Log under the authenticated user so AuditService captures Auth::id() correctly
        Auth::login($user);
        AuditService::log('login', 'users', $user->id, null, ['email' => $user->email]);

        return response()->json([
            'user' => new UserResource($user),
            'token' => $token,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        AuditService::log('logout', 'users', $user->id, null, ['email' => $user->email]);

        $user->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => new UserResource($request->user()),
        ]);
    }
}
