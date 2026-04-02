<?php

namespace App\Http\Requests\Sale;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'client_id' => ['nullable', 'exists:clients,id'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0'],
            'payments' => ['required', 'array', 'min:1'],
            'payments.*.payment_method' => ['required', Rule::in(['cash', 'card', 'bank_transfer', 'check', 'credit'])],
            'payments.*.amount' => ['required', 'numeric', 'min:0.01'],
            'payments.*.reference_number' => ['nullable', 'string'],
            'fulfillment_type' => ['required', Rule::in(['pickup', 'delivery'])],
            'notes' => ['nullable', 'string'],
        ];
    }
}
