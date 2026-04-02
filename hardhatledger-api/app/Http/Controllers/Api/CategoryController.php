<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Category\StoreCategoryRequest;
use App\Http\Requests\Category\UpdateCategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = Category::whereNull('parent_id')
            ->with('children')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => CategoryResource::collection($categories)]);
    }

    public function store(StoreCategoryRequest $request): JsonResponse
    {
        $category = Category::create($request->validated());
        $category->load('children');
        return response()->json(['data' => new CategoryResource($category)], 201);
    }

    public function show(Category $category): JsonResponse
    {
        $category->load('children');
        return response()->json(['data' => new CategoryResource($category)]);
    }

    public function update(UpdateCategoryRequest $request, Category $category): JsonResponse
    {
        $category->update($request->validated());
        $category->load('children');
        return response()->json(['data' => new CategoryResource($category)]);
    }

    public function destroy(Category $category): JsonResponse
    {
        $category->delete();
        return response()->json(null, 204);
    }
}
