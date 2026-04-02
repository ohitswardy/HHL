<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Client\StoreClientRequest;
use App\Http\Requests\Client\UpdateClientRequest;
use App\Http\Resources\ClientResource;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Client::with('tier');

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('business_name', 'like', "%{$search}%")
                  ->orWhere('contact_person', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if ($tierId = $request->get('client_tier_id')) {
            $query->where('client_tier_id', $tierId);
        }

        $clients = $query->orderBy('business_name')->paginate($request->get('per_page', 20));

        return response()->json([
            'data' => ClientResource::collection($clients),
            'meta' => [
                'current_page' => $clients->currentPage(),
                'last_page' => $clients->lastPage(),
                'per_page' => $clients->perPage(),
                'total' => $clients->total(),
            ],
        ]);
    }

    public function store(StoreClientRequest $request): JsonResponse
    {
        $client = Client::create($request->validated());
        $client->load('tier');
        return response()->json(['data' => new ClientResource($client)], 201);
    }

    public function show(Client $client): JsonResponse
    {
        $client->load('tier');
        return response()->json(['data' => new ClientResource($client)]);
    }

    public function update(UpdateClientRequest $request, Client $client): JsonResponse
    {
        $client->update($request->validated());
        $client->load('tier');
        return response()->json(['data' => new ClientResource($client)]);
    }

    public function destroy(Client $client): JsonResponse
    {
        $client->delete();
        return response()->json(null, 204);
    }
}
