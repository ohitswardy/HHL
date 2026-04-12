# HardhatLedger — Database Schema

**Database:** `hardhatledger` (MySQL 8.0)

All tables include `created_at`, `updated_at` timestamps unless noted.
Tables marked with *(soft delete)* include a `deleted_at` column.

---

## Users & Auth

### `users` *(soft delete)*
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| name | VARCHAR | |
| email | VARCHAR UNIQUE | |
| password | VARCHAR | bcrypt hashed |
| is_active | BOOLEAN | default true |
| last_login_at | DATETIME NULL | |
| branch_id | BIGINT NULL | future multi-branch |

### `personal_access_tokens`
Managed by Laravel Sanctum. Stores opaque API tokens.

### `permissions`, `roles`, `role_has_permissions`, `model_has_roles`, `model_has_permissions`
Managed by Spatie Laravel Permission package.

---

## Client Management

### `client_tiers` *(soft delete)*
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| name | VARCHAR | e.g., "Wholesale", "Retail" |
| discount_percent | DECIMAL(5,2) | |
| markup_percent | DECIMAL(5,2) | |
| description | TEXT NULL | |
| branch_id | BIGINT NULL | |

### `clients` *(soft delete)*
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| business_name | VARCHAR | indexed |
| contact_person | VARCHAR NULL | |
| phone | VARCHAR NULL | |
| email | VARCHAR NULL | |
| address | TEXT NULL | |
| client_tier_id | BIGINT FK → client_tiers | |
| credit_limit | DECIMAL(15,2) | default 0 |
| outstanding_balance | DECIMAL(15,2) | default 0 |
| notes | TEXT NULL | |
| branch_id | BIGINT NULL | |

---

## Product Catalog

### `categories` *(soft delete)*
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| name | VARCHAR | |
| parent_id | BIGINT FK → categories NULL | hierarchical |
| branch_id | BIGINT NULL | |

### `suppliers` *(soft delete)*
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| name | VARCHAR | |
| contact_person | VARCHAR NULL | |
| phone | VARCHAR NULL | |
| email | VARCHAR NULL | |
| address | TEXT NULL | |
| payment_terms | VARCHAR NULL | |
| is_vatable | BOOLEAN | default false; if true, VAT is split on PO receipt |
| notes | TEXT NULL | |
| branch_id | BIGINT NULL | |

### `products` *(soft delete)*
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| sku | VARCHAR UNIQUE | indexed |
| name | VARCHAR | indexed |
| description | TEXT NULL | |
| category_id | BIGINT FK → categories | |
| unit | VARCHAR | e.g., "bag", "piece", "meter" |
| supplier_id | BIGINT FK → suppliers | |
| cost_price | DECIMAL(15,2) | |
| base_selling_price | DECIMAL(15,2) | default retail price |
| reorder_level | INT | alert threshold |
| is_active | BOOLEAN | |
| branch_id | BIGINT NULL | |

### `product_prices`
Tier-specific overrides for product pricing.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| product_id | BIGINT FK → products | |
| client_tier_id | BIGINT FK → client_tiers | |
| price | DECIMAL(15,2) | |

---

## Inventory

### `inventory_stock`
One record per product per branch.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| product_id | BIGINT FK → products | UNIQUE with branch_id |
| quantity_on_hand | INT | total physical stock |
| quantity_reserved | INT | reserved by pending orders |
| branch_id | BIGINT NULL | |

Computed: `available_quantity = quantity_on_hand - quantity_reserved`

### `inventory_movements`
Immutable audit trail for every stock change.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| product_id | BIGINT FK → products | indexed |
| type | ENUM | `in`, `out`, `adjustment` |
| reference_type | VARCHAR NULL | e.g., "SalesTransaction", "PurchaseOrder" |
| reference_id | BIGINT NULL | indexed |
| quantity | INT | always positive; direction from `type` |
| unit_cost | DECIMAL(15,2) NULL | cost at time of movement |
| notes | TEXT NULL | |
| user_id | BIGINT FK → users | who made the change |
| branch_id | BIGINT NULL | |

---

## Purchasing

### `purchase_orders` *(soft delete)*
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| po_number | VARCHAR UNIQUE | auto-generated (format: PO-YYYYMMDD-0001) |
| supplier_id | BIGINT FK → suppliers | |
| user_id | BIGINT FK → users | created by |
| status | ENUM | `draft`, `sent`, `partial`, `received`, `cancelled` |
| total_amount | DECIMAL(15,2) | |
| expected_date | DATE NULL | |
| received_date | DATE NULL | |
| payment_method | VARCHAR NULL | e.g., `cash`, `business_bank` |
| notes | TEXT NULL | |
| branch_id | BIGINT NULL | |

### `purchase_order_items`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| purchase_order_id | BIGINT FK → purchase_orders | CASCADE DELETE |
| product_id | BIGINT FK → products | |
| quantity_ordered | INT | |
| quantity_received | INT | default 0 |
| unit_cost | DECIMAL(15,2) | |

---

## Sales & POS

### `sales_transactions` *(soft delete)*
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| transaction_number | VARCHAR UNIQUE | indexed, auto-generated (format: INV-YYYYMMDD-0001) |
| client_id | BIGINT FK → clients NULL | null = walk-in |
| user_id | BIGINT FK → users | cashier |
| fulfillment_type | ENUM | `delivery`, `pickup`; default `pickup` |
| status | ENUM | `pending`, `completed`, `voided`, `refunded`; default `pending` |
| subtotal | DECIMAL(15,2) | |
| discount_amount | DECIMAL(15,2) | |
| delivery_fee | DECIMAL(15,2) | default 0; charged for delivery fulfillment |
| tax_amount | DECIMAL(15,2) | |
| total_amount | DECIMAL(15,2) | |
| notes | TEXT NULL | |
| branch_id | BIGINT NULL | |

Computed accessors: `total_paid` (sum of confirmed payments), `balance_due` (total_amount − total_paid)

### `sale_items`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| sales_transaction_id | BIGINT FK → sales_transactions | CASCADE DELETE |
| product_id | BIGINT FK → products | |
| quantity | INT | |
| unit_price | DECIMAL(15,2) | price at time of sale |
| discount | DECIMAL(15,2) | per-item discount |
| line_total | DECIMAL(15,2) | |

### `payments` *(soft delete)*
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| sales_transaction_id | BIGINT FK → sales_transactions | CASCADE DELETE |
| payment_method | ENUM | `cash`, `card`, `bank_transfer`, `check`, `credit`, `business_bank` |
| amount | DECIMAL(15,2) | |
| reference_number | VARCHAR NULL | for non-cash payments |
| status | ENUM | `pending`, `confirmed`, `failed` |
| paid_at | DATETIME NULL | |
| due_date | DATE NULL | for `credit` payments; sets the repayment due date |
| branch_id | BIGINT NULL | |

> `business_bank` payments are posted to account `1020` (Cash in Bank) and appear in the Bank Transaction ledger.

---

## Accounting

### `chart_of_accounts` *(soft delete)*
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| code | VARCHAR UNIQUE | e.g., "1010", "4020" |
| name | VARCHAR | |
| type | ENUM | `asset`, `liability`, `equity`, `revenue`, `expense` |
| detail_type | VARCHAR NULL | sub-classification (e.g., "cash", "receivable", "payable") |
| parent_id | BIGINT FK → chart_of_accounts NULL | hierarchical |
| is_active | BOOLEAN | |
| branch_id | BIGINT NULL | |

Computed accessor: `balance` (dynamically calculated by debit/credit rules per type)

### `journal_entries` *(soft delete)*
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| reference_type | VARCHAR NULL | e.g., "SalesTransaction" |
| reference_id | BIGINT NULL | indexed |
| description | TEXT | |
| date | DATE | |
| user_id | BIGINT FK → users NULL | |
| branch_id | BIGINT NULL | |

### `journal_lines`
Must always balance (Σ debit = Σ credit per entry).

| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| journal_entry_id | BIGINT FK → journal_entries | CASCADE DELETE |
| account_id | BIGINT FK → chart_of_accounts | |
| debit | DECIMAL(15,2) | default 0 |
| credit | DECIMAL(15,2) | default 0 |

### `client_statements`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| client_id | BIGINT FK → clients | CASCADE DELETE |
| period_start | DATE | |
| period_end | DATE | |
| opening_balance | DECIMAL(15,2) | |
| total_charges | DECIMAL(15,2) | |
| total_payments | DECIMAL(15,2) | |
| closing_balance | DECIMAL(15,2) | |
| branch_id | BIGINT NULL | |

---

## Expenses

### `expense_categories`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| name | VARCHAR | e.g., "Operating Expenses", "Utilities" |
| account_code | VARCHAR FK → chart_of_accounts.code | maps expense to GL account |
| description | TEXT NULL | |
| is_active | BOOLEAN | default true |
| branch_id | BIGINT NULL | |

Default seeded categories and their GL mappings:
| Category | Account Code |
|---|---|
| COGS VATable | 5010 |
| COGS NonVATable | 5011 |
| Cost of Sales | 5060 |
| Operating Expenses | 5020 |
| Utilities | 5030 |
| Salaries | 5040 |
| Discounts Given | 5050 |

### `expenses` *(soft delete)*
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| expense_number | VARCHAR UNIQUE | auto-generated (format: EXP-YYYYMMDD-0001) |
| date | DATE | |
| reference_number | VARCHAR NULL | receipt / OR number |
| payee | VARCHAR NULL | vendor or payee name |
| supplier_id | BIGINT FK → suppliers NULL | linked supplier (optional) |
| expense_category_id | BIGINT FK → expense_categories | determines GL account |
| subtotal | DECIMAL(15,2) | |
| tax_amount | DECIMAL(15,2) | default 0 |
| total_amount | DECIMAL(15,2) | |
| payment_method | VARCHAR NULL | `cash` or `business_bank` |
| status | ENUM | `draft`, `recorded`, `voided`; default `draft` |
| source | VARCHAR | `manual` (default) or `purchase_order` |
| purchase_order_id | BIGINT FK → purchase_orders NULL | set when source = purchase_order |
| user_id | BIGINT FK → users | |
| notes | TEXT NULL | |
| branch_id | BIGINT NULL | |

**Status lifecycle:**  
`draft` → `recorded` (journal posted) → `voided` (journal reversed)

> PO-sourced expenses are created automatically on PO receipt. Their accounting is handled by the PO journal entry — confirming them does NOT post a separate journal.
| branch_id | BIGINT NULL | |

---

## Audit & System

### `audit_logs`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | |
| user_id | BIGINT FK → users | who performed the action |
| action | VARCHAR | e.g., "created", "updated", "deleted" |
| table_name | VARCHAR | affected table |
| record_id | BIGINT | affected row ID |
| old_value | JSON NULL | before state |
| new_value | JSON NULL | after state |
| ip_address | VARCHAR NULL | |
| branch_id | BIGINT NULL | |

### `cache`, `jobs`
Laravel system tables. Managed automatically.

---

## Entity Relationship Summary

```
client_tiers ──< clients ──< sales_transactions ──< sale_items >── products
                                                └──< payments

categories >── products ──< product_prices >── client_tiers
suppliers  >── products ──  inventory_stock
                         └──< inventory_movements

purchase_orders >── purchase_order_items >── products
suppliers >── purchase_orders
purchase_orders ──< expenses

expense_categories >── expenses
chart_of_accounts ──< expense_categories (via account_code)

journal_entries ──< journal_lines >── chart_of_accounts
```

chart_of_accounts (self-ref) ──< journal_lines >── journal_entries

clients ──< client_statements

users ──< sales_transactions
users ──< purchase_orders
users ──< inventory_movements
users ──< journal_entries
users ──< audit_logs
```
