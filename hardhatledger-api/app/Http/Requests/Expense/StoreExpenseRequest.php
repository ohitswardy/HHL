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
        ];
    }
}
