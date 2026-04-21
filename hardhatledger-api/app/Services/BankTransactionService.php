<?php

namespace App\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class BankTransactionService
{
    /**
     * Gather all business bank transactions (deposits + payments) for financial tracking.
     *
     * Deposits  = Sales payments made via 'business_bank'
     * Payments  = Expenses + Purchase Orders paid via 'business_bank'
     *
     * Uses a single UNION ALL query with a SQL window function to compute the
     * running balance in the database rather than loading everything into PHP.
     */
    public function getTransactions(?string $from = null, ?string $to = null, ?string $search = null): Collection
    {
        $bindings = [];

        $payWhere = $this->whereClause($bindings, 'DATE(p.paid_at)', $from, $to, $search,
            ['st.transaction_number', 'c.business_name']);
        $expWhere = $this->whereClause($bindings, 'DATE(e.date)', $from, $to, $search,
            ['e.expense_number', 'e.payee']);
        $poWhere  = $this->whereClause($bindings, 'DATE(COALESCE(po.received_date, po.created_at))', $from, $to, $search,
            ['po.po_number', 's.name']);

        $sql = <<<SQL
            SELECT
                t.id,
                t.date,
                t.ref_no,
                t.type,
                t.payee_account,
                t.memo,
                CAST(t.payment_amount AS DECIMAL(14,2)) AS payment_amount,
                CAST(t.deposit_amount AS DECIMAL(14,2)) AS deposit_amount,
                CAST(t.tax            AS DECIMAL(14,2)) AS tax,
                t.source_type,
                t.source_id,
                ROUND(
                    SUM(t.deposit_amount - t.payment_amount) OVER (
                        ORDER BY t.date ASC, t.type_order ASC, t.sort_id ASC
                        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                    ), 2
                ) AS balance
            FROM (
                SELECT
                    CONCAT('PAY-', p.id)                                            AS id,
                    DATE(p.paid_at)                                                 AS date,
                    p.id                                                            AS sort_id,
                    1                                                               AS type_order,
                    COALESCE(st.transaction_number, '-')                            AS ref_no,
                    'Deposit'                                                       AS type,
                    COALESCE(c.business_name, 'Walk-in')                            AS payee_account,
                    IF(st.id IS NOT NULL, CONCAT('Sale ', st.transaction_number), 'Sales deposit') AS memo,
                    0.00                                                            AS payment_amount,
                    p.amount                                                        AS deposit_amount,
                    COALESCE(st.tax_amount, 0)                                      AS tax,
                    'sale'                                                          AS source_type,
                    st.id                                                           AS source_id
                FROM payments p
                LEFT JOIN sales_transactions st ON st.id = p.sales_transaction_id AND st.deleted_at IS NULL
                LEFT JOIN clients c             ON c.id  = st.client_id           AND c.deleted_at IS NULL
                WHERE p.payment_method = 'business_bank'
                  AND p.status = 'confirmed'
                  AND p.deleted_at IS NULL
                  {$payWhere}

                UNION ALL

                SELECT
                    CONCAT('EXP-', e.id)                                            AS id,
                    DATE(e.date)                                                    AS date,
                    e.id                                                            AS sort_id,
                    2                                                               AS type_order,
                    e.expense_number                                                AS ref_no,
                    'Expense'                                                       AS type,
                    e.payee                                                         AS payee_account,
                    COALESCE(e.notes, ec.name, 'Expense')                           AS memo,
                    e.total_amount                                                  AS payment_amount,
                    0.00                                                            AS deposit_amount,
                    e.tax_amount                                                    AS tax,
                    'expense'                                                       AS source_type,
                    e.id                                                            AS source_id
                FROM expenses e
                LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id
                WHERE e.payment_method = 'business_bank'
                  AND e.status IN ('recorded', 'draft')
                  AND e.deleted_at IS NULL
                  {$expWhere}

                UNION ALL

                SELECT
                    CONCAT('PO-', po.id)                                            AS id,
                    DATE(COALESCE(po.received_date, po.created_at))                 AS date,
                    po.id                                                           AS sort_id,
                    3                                                               AS type_order,
                    po.po_number                                                    AS ref_no,
                    'Purchase Order'                                                AS type,
                    COALESCE(s.name, 'Unknown Supplier')                            AS payee_account,
                    COALESCE(po.notes, CONCAT('PO ', po.po_number))                 AS memo,
                    po.total_amount                                                 AS payment_amount,
                    0.00                                                            AS deposit_amount,
                    0.00                                                            AS tax,
                    'purchase_order'                                                AS source_type,
                    po.id                                                           AS source_id
                FROM purchase_orders po
                LEFT JOIN suppliers s ON s.id = po.supplier_id AND s.deleted_at IS NULL
                WHERE po.payment_method = 'business_bank'
                  AND po.status = 'received'
                  AND po.deleted_at IS NULL
                  {$poWhere}
            ) AS t
            ORDER BY t.date ASC, t.type_order ASC, t.sort_id ASC
        SQL;

        return collect(DB::select($sql, $bindings))->map(fn ($row) => [
            'id'             => $row->id,
            'date'           => $row->date,
            'ref_no'         => $row->ref_no,
            'type'           => $row->type,
            'payee_account'  => $row->payee_account,
            'memo'           => $row->memo,
            'payment_amount' => (float) $row->payment_amount,
            'deposit_amount' => (float) $row->deposit_amount,
            'tax'            => (float) $row->tax,
            'source_type'    => $row->source_type,
            'source_id'      => $row->source_id,
            'balance'        => (float) $row->balance,
        ]);
    }

    /**
     * Build a safe WHERE fragment (AND clauses) for one sub-query, appending
     * bound values to the shared $bindings array.
     *
     * @param  array<int,mixed>  $bindings  Passed by reference — values are appended here.
     * @param  string[]          $searchColumns  Fully-qualified column names to LIKE-search.
     */
    private function whereClause(
        array &$bindings,
        string $dateExpr,
        ?string $from,
        ?string $to,
        ?string $search,
        array $searchColumns,
    ): string {
        $parts = [];

        if ($from) {
            $parts[]    = "{$dateExpr} >= ?";
            $bindings[] = $from;
        }
        if ($to) {
            $parts[]    = "{$dateExpr} <= ?";
            $bindings[] = $to;
        }
        if ($search) {
            $likes      = implode(' OR ', array_map(fn ($col) => "{$col} LIKE ?", $searchColumns));
            $parts[]    = "({$likes})";
            foreach ($searchColumns as $_) {
                $bindings[] = "%{$search}%";
            }
        }

        return $parts ? 'AND ' . implode(' AND ', $parts) : '';
    }
}
