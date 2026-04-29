<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Category\StoreCategoryRequest;
use App\Http\Requests\Category\UpdateCategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = Category::whereNull('parent_id')
            ->with(['children' => fn ($q) => $q->withCount('products')->orderBy('name')])
            ->withCount('products')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => CategoryResource::collection($categories)]);
    }

    public function store(StoreCategoryRequest $request): JsonResponse
    {
        $category = Category::create($request->validated());
        $category->loadCount('products');
        $category->load(['children' => fn ($q) => $q->withCount('products')->orderBy('name')]);

        AuditService::log('created', 'categories', $category->id, null, [
            'name'      => $category->name,
            'parent_id' => $category->parent_id,
        ]);

        return response()->json(['data' => new CategoryResource($category)], 201);
    }

    public function show(Category $category): JsonResponse
    {
        $category->loadCount('products');
        $category->load(['children' => fn ($q) => $q->withCount('products')->orderBy('name')]);
        return response()->json(['data' => new CategoryResource($category)]);
    }

    public function update(UpdateCategoryRequest $request, Category $category): JsonResponse
    {
        $old = [
            'name'      => $category->name,
            'parent_id' => $category->parent_id,
        ];

        $category->update($request->validated());
        $category->loadCount('products');
        $category->load(['children' => fn ($q) => $q->withCount('products')->orderBy('name')]);

        AuditService::log('updated', 'categories', $category->id, $old, [
            'name'      => $category->name,
            'parent_id' => $category->parent_id,
        ]);

        return response()->json(['data' => new CategoryResource($category)]);
    }

    public function destroy(Category $category): JsonResponse
    {
        $totalProducts = $category->products()->count()
            + $category->children()->withCount('products')->get()->sum('products_count');

        if ($totalProducts > 0) {
            return response()->json([
                'message' => "Cannot delete '{$category->name}': it has {$totalProducts} product(s) assigned. Reassign them first.",
            ], 422);
        }

        $snapshot = ['name' => $category->name, 'parent_id' => $category->parent_id];

        $category->delete();

        AuditService::log('deleted', 'categories', $category->id, $snapshot, null);

        return response()->json(null, 204);
    }
}
