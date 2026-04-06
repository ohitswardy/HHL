<?php

namespace App\Http\Requests\Inventory;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdjustStockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'product_id' => ['required', 'exists:products,id'],
            'quantity'   => ['required', 'integer', 'min:1'],
            'type'       => ['required', Rule::in(['in', 'out', 'adjustment'])],
            'unit_cost'  => ['nullable', 'numeric', 'min:0'],
            'notes'      => ['nullable', 'string', 'max:500'],
        ];
    }
}
