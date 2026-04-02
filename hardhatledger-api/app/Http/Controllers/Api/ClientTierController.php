<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ClientTierResource;
use App\Models\ClientTier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientTierController extends Controller
{
    public function index(): JsonResponse
    {
        $tiers = ClientTier::all();
        return response()->json(['data' => ClientTierResource::collection($tiers)]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'discount_percent' => 'numeric|min:0|max:100',
            'markup_percent' => 'numeric|min:0|max:100',
            'description' => 'nullable|string',
        ]);

        $tier = ClientTier::create($validated);
        return response()->json(['data' => new ClientTierResource($tier)], 201);
    }

    public function show(ClientTier $clientTier): JsonResponse
    {
        return response()->json(['data' => new ClientTierResource($clientTier)]);
    }

    public function update(Request $request, ClientTier $clientTier): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'discount_percent' => 'numeric|min:0|max:100',
            'markup_percent' => 'numeric|min:0|max:100',
            'description' => 'nullable|string',
        ]);

        $clientTier->update($validated);
        return response()->json(['data' => new ClientTierResource($clientTier)]);
    }

    public function destroy(ClientTier $clientTier): JsonResponse
    {
        $clientTier->delete();
        return response()->json(null, 204);
    }
}
