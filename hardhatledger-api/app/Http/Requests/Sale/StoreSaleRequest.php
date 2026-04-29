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
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.price_override_reason' => ['nullable', 'string', 'max:100'],
            'payments' => ['required', 'array', 'min:1'],
            'payments.*.payment_method'   => ['required', Rule::in(['cash', 'card', 'bank_transfer', 'check', 'credit', 'business_bank'])],
            'payments.*.amount'            => ['required', 'numeric', 'min:0.01'],
            'payments.*.reference_number'  => ['nullable', 'string'],
            'payments.*.due_date'          => ['nullable', 'date'],
            'fulfillment_type' => ['required', Rule::in(['pickup', 'delivery'])],
            'delivery_fee'     => ['nullable', 'numeric', 'min:0'],
            'tax_amount'       => ['nullable', 'numeric', 'min:0'],
            'notes'            => ['nullable', 'string'],
            'force_override'   => ['nullable', 'boolean'],
        ];
    }
}
