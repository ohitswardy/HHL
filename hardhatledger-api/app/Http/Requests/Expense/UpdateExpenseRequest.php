<?php

namespace App\Http\Requests\Expense;

use Illuminate\Foundation\Http\FormRequest;

class UpdateExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'date' => ['sometimes', 'required', 'date'],
            'reference_number' => ['nullable', 'string', 'max:255'],
            'payee' => ['sometimes', 'required', 'string', 'max:255'],
            'supplier_id' => ['nullable', 'exists:suppliers,id'],
            'expense_category_id' => ['sometimes', 'required', 'exists:expense_categories,id'],
            'subtotal' => ['sometimes', 'required', 'numeric', 'min:0.01'],
            'tax_amount' => ['nullable', 'numeric', 'min:0'],
            'total_amount' => ['sometimes', 'required', 'numeric', 'min:0.01'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
