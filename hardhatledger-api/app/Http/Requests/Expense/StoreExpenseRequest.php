<?php

namespace App\Http\Requests\Expense;

use Illuminate\Foundation\Http\FormRequest;

class StoreExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'date' => ['required', 'date'],
            'reference_number' => ['nullable', 'string', 'max:255'],
            'payee' => ['required', 'string', 'max:255'],
            'supplier_id' => ['nullable', 'exists:suppliers,id'],
            'expense_category_id' => ['required', 'exists:expense_categories,id'],
            'subtotal' => ['required', 'numeric', 'min:0.01'],
            'tax_amount' => ['nullable', 'numeric', 'min:0'],
            'total_amount' => ['required', 'numeric', 'min:0.01'],
            'notes' => ['nullable', 'string'],
            'payment_method' => ['nullable', 'string', 'in:cash,card,bank_transfer,check,business_bank'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $subtotal = (float) ($this->subtotal ?? 0);
            $tax      = (float) ($this->tax_amount ?? 0);
            $total    = (float) ($this->total_amount ?? 0);

            if (abs($total - ($subtotal + $tax)) > 0.01) {
                $validator->errors()->add(
                    'total_amount',
                    'Total amount must equal subtotal + tax amount.'
                );
            }
        });
    }
}