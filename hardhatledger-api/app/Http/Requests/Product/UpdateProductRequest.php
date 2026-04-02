<?php

namespace App\Http\Requests\Product;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'sku' => ['sometimes', 'required', 'string', 'max:100', Rule::unique('products', 'sku')->ignore($this->route('product'))],
            'description' => ['nullable', 'string'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'unit' => ['nullable', 'string', 'max:50'],
            'supplier_id' => ['nullable', 'exists:suppliers,id'],
            'cost_price' => ['sometimes', 'required', 'numeric', 'min:0'],
            'base_selling_price' => ['sometimes', 'required', 'numeric', 'min:0'],
            'reorder_level' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'tier_prices' => ['nullable', 'array'],
            'tier_prices.*.client_tier_id' => ['required_with:tier_prices', 'exists:client_tiers,id'],
            'tier_prices.*.price' => ['required_with:tier_prices', 'numeric', 'min:0'],
        ];
    }
}
