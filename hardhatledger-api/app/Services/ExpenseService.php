<?php

namespace App\Services;

use App\Models\ChartOfAccount;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\JournalEntry;
use App\Models\PurchaseOrder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ExpenseService
{
    public function generateExpenseNumber(): string
    {
        $today = Carbon::today()->format('Ymd');
        $prefix = "EXP-{$today}-";

        $last = Expense::withTrashed()
            ->where('expense_number', 'like', "{$prefix}%")
            ->orderByDesc('expense_number')
            ->first();

        if ($last) {
            $lastSequence = (int) substr($last->expense_number, -4);
            $nextSequence = $lastSequence + 1;
        } else {
            $nextSequence = 1;
        }

        return $prefix . str_pad($nextSequence, 4, '0', STR_PAD_LEFT);
    }

    public function createExpense(array $data): Expense
    {
        return DB::transaction(function () use ($data) {
            $expense = Expense::create([
                'expense_number' => $this->generateExpenseNumber(),
                'date' => $data['date'],
                'reference_number' => $data['reference_number'] ?? null,
                'payee' => $data['payee'],
                'supplier_id' => $data['supplier_id'] ?? null,
                'expense_category_id' => $data['expense_category_id'],
                'subtotal' => $data['subtotal'],
                'tax_amount' => $data['tax_amount'] ?? 0,
                'total_amount' => $data['total_amount'],
                'notes' => $data['notes'] ?? null,
                'payment_method' => $data['payment_method'] ?? 'cash',
                'status' => 'recorded',
                'user_id' => Auth::id(),
                'branch_id' => $data['branch_id'] ?? 1,
            ]);

            $this->postExpenseJournal($expense);

            return $expense;
        });
    }

    /**
     * Create a draft expense from a purchase order.
     *
     * @param  float|null  $amountOverride  Use this amount instead of po->total_amount.
     *                                      Pass the received portion when creating from a
     *                                      partial cancellation so the record matches the
     *                                      journal entry that was actually posted.
     */
    public function createFromPurchaseOrder(PurchaseOrder $po, ?float $amountOverride = null): ?Expense
    {
        if (Expense::where('purchase_order_id', $po->id)->exists()) {
            return null;
        }

        $po->loadMissing('supplier');

        $amount = $amountOverride ?? (float) $po->total_amount;

        $defaultCategory = ExpenseCategory::where('name', 'COGS NonVATable')->first()
            ?? ExpenseCategory::first();

        $notes = $amountOverride !== null
            ? "Auto-imported from Purchase Order {$po->po_number} [partial cancellation — received portion only]"
            : "Auto-imported from Purchase Order {$po->po_number}";

        return Expense::create([
            'expense_number'     => $this->generateExpenseNumber(),
            'date'               => $po->received_date?->toDateString() ?? now()->toDateString(),
            'reference_number'   => $po->po_number,
            'payee'              => $po->supplier?->name ?? 'Unknown Supplier',
            'supplier_id'        => $po->supplier_id,
            'expense_category_id'=> $defaultCategory?->id,
            'subtotal'           => $amount,
            'tax_amount'         => 0,
            'total_amount'       => $amount,
            'notes'              => $notes,
            'status'             => 'draft',
            'source'             => 'purchase_order',
            'purchase_order_id'  => $po->id,
            'user_id'            => Auth::id(),
            'branch_id'          => $po->branch_id ?? 1,
        ]);
    }

    public function confirmExpense(Expense $expense, array $data = []): void
    {
        DB::transaction(function () use ($expense, $data) {
            if (!empty($data)) {
                $expense->update($data);
            }
            $expense->update(['status' => 'recorded']);
            // Only post journal for manually-created expenses
            if ($expense->source === 'manual') {
                $this->postExpenseJournal($expense);
            }
        });
    }

    public function syncFromPurchaseOrders(): array
    {
        // Step 1: Create draft expenses for received POs that have no expense record yet
        $receivedPOs = PurchaseOrder::where('status', 'received')
            ->doesntHave('expense')
            ->with('supplier')
            ->get();

        $created = 0;
        foreach ($receivedPOs as $po) {
            if ($this->createFromPurchaseOrder($po) !== null) {
                $created++;
            }
        }

        // Step 2: Auto-confirm any existing draft expenses that belong to fully-received POs.
        // The PO is already "done", so there is no reason to keep its linked expense as draft.
        $draftPoExpenses = Expense::where('source', 'purchase_order')
            ->where('status', 'draft')
            ->whereHas('purchaseOrder', fn ($q) => $q->where('status', 'received'))
            ->get();

        $confirmed = 0;
        foreach ($draftPoExpenses as $expense) {
            $this->confirmExpense($expense);
            $confirmed++;
        }

        return compact('created', 'confirmed');
    }

    public function updateExpense(Expense $expense, array $data): void
    {
        DB::transaction(function () use ($expense, $data) {
            // Only manipulate journals for manual expenses that are already recorded
            if ($expense->source === 'manual' && $expense->status === 'recorded') {
                $this->reverseExpenseJournal($expense);
            }
            $expense->update($data);
            if ($expense->source === 'manual' && $expense->status === 'recorded') {
                $this->postExpenseJournal($expense);
            }
        });
    }

    public function voidExpense(Expense $expense): void
    {
        DB::transaction(function () use ($expense) {
            if ($expense->source === 'manual' && $expense->status === 'recorded') {
                $this->reverseExpenseJournal($expense);
            }
            $expense->update(['status' => 'voided']);
        });
    }

    private function postExpenseJournal(Expense $expense): void
    {
        // PO-sourced expenses: the PO receive already posts DR Inventory / CR AP
        if ($expense->source === 'purchase_order') {
            return;
        }

        $expense->load('category');
        $accountCode = $expense->category->account_code;

        $entry = JournalEntry::create([
            'reference_type' => 'expense',
            'reference_id' => $expense->id,
            'description' => "Expense {$expense->expense_number} — {$expense->payee}",
            'date' => $expense->date,
            'user_id' => Auth::id(),
        ]);

        $expenseAccount = ChartOfAccount::where('code', $accountCode)->firstOrFail();

        // Route to Cash in Bank (1020) for business_bank, Cash on Hand (1010) otherwise
        $cashAccountCode = $expense->payment_method === 'business_bank' ? '1020' : '1010';
        $cashAccount = ChartOfAccount::where('code', $cashAccountCode)->firstOrFail();

        // DR: Expense account for the subtotal
        $entry->lines()->create([
            'account_id' => $expenseAccount->id,
            'debit' => (float) $expense->subtotal,
            'credit' => 0,
        ]);

        // DR: Input VAT if there's tax
        if ((float) $expense->tax_amount > 0) {
            $vatAccount = ChartOfAccount::where('code', '1400')->first();
            if ($vatAccount) {
                $entry->lines()->create([
                    'account_id' => $vatAccount->id,
                    'debit' => (float) $expense->tax_amount,
                    'credit' => 0,
                ]);
            } else {
                // If no Input VAT account, add tax to the expense account
                $entry->lines()->create([
                    'account_id' => $expenseAccount->id,
                    'debit' => (float) $expense->tax_amount,
                    'credit' => 0,
                ]);
            }
        }

        // CR: Cash for total amount
        $entry->lines()->create([
            'account_id' => $cashAccount->id,
            'debit' => 0,
            'credit' => (float) $expense->total_amount,
        ]);
    }

    private function reverseExpenseJournal(Expense $expense): void
    {
        if ($expense->source === 'purchase_order') {
            return;
        }

        $originalEntry = JournalEntry::where('reference_type', 'expense')
            ->where('reference_id', $expense->id)
            ->first();

        if (!$originalEntry) {
            return;
        }

        $reversalEntry = JournalEntry::create([
            'reference_type' => 'expense_reversal',
            'reference_id' => $expense->id,
            'description' => "Reversal of expense {$expense->expense_number}",
            'date' => now(),
            'user_id' => Auth::id(),
        ]);

        foreach ($originalEntry->lines as $line) {
            $reversalEntry->lines()->create([
                'account_id' => $line->account_id,
                'debit' => (float) $line->credit,
                'credit' => (float) $line->debit,
            ]);
        }
    }
}
