# HardhatLedger — API Documentation

**Base URL:** `http://localhost:8000/api/v1`  
**Authentication:** Bearer token (Laravel Sanctum)  
**Content-Type:** `application/json`

---

## Authentication

All endpoints except `POST /auth/login` require:
```
Authorization: Bearer <token>
```

### POST /auth/login
Login and receive an API token.

**Request:**
```json
{ "email": "admin@hardhatledger.com", "password": "password" }
```
**Response:**
```json
{
  "token": "1|abc123...",
  "user": { "id": 1, "name": "Admin", "email": "...", "roles": ["Super Admin"] }
}
```

### POST /auth/logout
Revokes the current token.

### GET /auth/me
Returns the authenticated user with roles and permissions.

---

## Users

Requires permission: `users.view` / `users.create` / `users.edit` / `users.delete`

### GET /users
List all users (paginated).

### POST /users
Create a new user.
```json
{ "name": "string", "email": "string", "password": "string", "roles": ["Admin"] }
```

### GET /users/{id}
### PUT /users/{id}
### DELETE /users/{id}

---

## Roles

### GET /roles
List all roles with their permissions. Requires `roles.view`.

### GET /roles/permissions
List all available permissions. Requires `roles.view`.

### GET /roles/{role}
Get a single role with its permissions. Requires `roles.view`.

### POST /roles
Create a new role. Requires `roles.manage`.
```json
{ "name": "Custom Role", "permissions": ["pos.access", "products.view"] }
```

### PUT /roles/{role}
Update a role's permissions. Requires `roles.manage`.
```json
{ "permissions": ["pos.access", "products.view", "inventory.view"] }
```

### DELETE /roles/{role}
Delete a custom role. Requires `roles.manage`.

---

## Client Tiers

### GET /client-tiers
### POST /client-tiers
```json
{
  "name": "Wholesale",
  "discount_percent": 10.00,
  "markup_percent": 0.00,
  "description": "Bulk buyers"
}
```
### GET /client-tiers/{id}
### PUT /client-tiers/{id}
### DELETE /client-tiers/{id}

---

## Clients

### GET /clients
Query params: `search` (business_name/contact_person/phone), `client_tier_id`

### POST /clients
```json
{
  "business_name": "ABC Construction",
  "contact_person": "Juan Dela Cruz",
  "phone": "09171234567",
  "email": "juan@abc.com",
  "address": "Manila",
  "client_tier_id": 1,
  "credit_limit": 50000.00,
  "notes": ""
}
```
### GET /clients/{id}
### PUT /clients/{id}
### DELETE /clients/{id}

---

## Categories

### GET /categories — Returns hierarchical tree (parent → children)
### POST /categories
```json
{ "name": "Cement", "parent_id": null }
```
### GET /categories/{id}
### PUT /categories/{id}
### DELETE /categories/{id}

---

## Suppliers

### GET /suppliers — Query param: `search`
### POST /suppliers
```json
{
  "name": "PhilCement Corp",
  "contact_person": "Maria Santos",
  "phone": "09181234567",
  "email": "sales@philcement.com",
  "address": "Cebu City",
  "payment_terms": "Net 30",
  "is_vatable": true,
  "notes": ""
}
```
`is_vatable` — when `true`, purchase orders from this supplier will automatically split out 12% Input VAT on receipt.

### GET /suppliers/{id}
### PUT /suppliers/{id}
### DELETE /suppliers/{id}

---

## Products

### GET /products
Query params: `search` (name/SKU), `category_id`, `supplier_id`, `is_active`

### POST /products
```json
{
  "sku": "CEM-OPC-40KG",
  "name": "OPC Cement 40kg",
  "description": "Ordinary Portland Cement",
  "category_id": 1,
  "unit": "bag",
  "supplier_id": 1,
  "cost_price": 220.00,
  "base_selling_price": 280.00,
  "reorder_level": 50,
  "is_active": true,
  "tier_prices": [
    { "client_tier_id": 1, "price": 260.00 }
  ]
}
```

### GET /products/{id}
### PUT /products/{id}
### DELETE /products/{id}

### GET /products/{id}/price
Resolve the price for a specific client.

**Query params:** `client_id` (optional)

**Response:**
```json
{ "price": 260.00, "source": "tier" }
```

### PUT /products/{id}/tier-prices
Bulk-update tier prices for a product.
```json
{
  "tier_prices": [
    { "client_tier_id": 1, "price": 260.00 },
    { "client_tier_id": 2, "price": 250.00 }
  ]
}
```

### GET /products/export/pdf
Export the full product catalog as a PDF.

### GET /products/export/csv
Export the full product catalog as a CSV file.

### GET /products/export/xlsx
Export the full product catalog as an Excel (XLSX) file.

### POST /products/import
Bulk import products from a CSV file.

**Content-Type:** `multipart/form-data`

| Field | Type | Notes |
|---|---|---|
| `file` | file | CSV file with product data |

---

## Inventory

### GET /inventory
List active products with current stock levels.

### GET /inventory/movements
Query params: `product_id`, `type` (in/out/adjustment), `date_from`, `date_to`

### GET /inventory/movements/print
Returns a paginated, printable view of inventory movements. Same query params as above.

### GET /inventory/low-stock
Returns products where `quantity_on_hand <= reorder_level`.

### POST /inventory/adjust
```json
{
  "product_id": 1,
  "type": "adjustment",
  "quantity": 10,
  "unit_cost": 220.00,
  "notes": "Physical count correction"
}
```

---

## Purchase Orders

### GET /purchase-orders
Query params: `status`, `supplier_id`

### POST /purchase-orders
```json
{
  "supplier_id": 1,
  "expected_date": "2026-04-15",
  "notes": "Urgent delivery",
  "items": [
    { "product_id": 1, "quantity_ordered": 100, "unit_cost": 220.00 }
  ]
}
```

### GET /purchase-orders/{id}

### POST /purchase-orders/{id}/receive
Marks goods as received. Updates inventory stock and posts the COGS journal entry.
```json
{
  "items": [
    { "product_id": 1, "quantity_received": 100 }
  ]
}
```
Receiving a PO also automatically creates a draft **Expense** record linked to the PO (visible in Accounting → Expenses).

---

## POS / Sales

### GET /pos/sales
Query params: `status`, `client_id`, `date_from`, `date_to`

### POST /pos/sales
Creates a sale transaction in **pending** status. Items are saved and inventory is reserved.
```json
{
  "client_id": 1,
  "fulfillment_type": "pickup",
  "delivery_fee": 0.00,
  "notes": "",
  "items": [
    { "product_id": 1, "quantity": 10, "discount": 0 }
  ]
}
```
Prices are resolved server-side via `PricingService`. The client's tier price is applied automatically.

`delivery_fee` is optional (default `0`). When `fulfillment_type` is `delivery`, set this to the delivery charge amount.

**Sale status lifecycle:** `pending` → `completed` → `voided`

### GET /pos/sales/{id}

### PATCH /pos/sales/{id}
Update a pending sale (items, fulfillment type, notes).

### POST /pos/sales/{id}/record-payment
Record a payment against a pending sale. Multiple calls can be made for split payments.
```json
{
  "payment_method": "cash",
  "amount": 1500.00,
  "reference_number": null,
  "due_date": null
}
```
`payment_method` options: `cash`, `card`, `bank_transfer`, `check`, `credit`, `business_bank`.

`due_date` — optional, used for `credit` payment method to set the payment due date.

### PATCH /pos/sales/{id}/complete
Marks a pending sale as completed. Deducts inventory, posts journal entries.

### POST /pos/sales/{id}/void
Voids a completed sale, reverses inventory, and posts a reversal journal entry.

### GET /pos/sales/{id}/receipt
Returns a PDF receipt (Content-Type: application/pdf).

### GET /pos/daily-summary
Returns today's sales totals broken down by payment method. Requires `pos.view-daily-summary`.

### GET /pos/reports/export
Export a filtered sales report. Query params: `date_from`, `date_to`, `status`, `client_id`. Requires `pos.access`.

---

## Accounting

All accounting endpoints require `permission:accounting.view` unless noted.

### Chart of Accounts

#### GET /accounting/chart-of-accounts
Returns the full hierarchical chart of accounts with current balances.

#### GET /accounting/chart-of-accounts/flat
Returns a flat (non-nested) list of all accounts.

#### GET /accounting/chart-of-accounts/pdf
Exports the chart of accounts as a PDF.

#### POST /accounting/chart-of-accounts
Create a new account.
```json
{
  "code": "6100",
  "name": "Marketing Expenses",
  "type": "expense",
  "parent_id": null
}
```
`type` options: `asset`, `liability`, `equity`, `revenue`, `expense`

#### PUT /accounting/chart-of-accounts/{id}
Update an existing account.

#### DELETE /accounting/chart-of-accounts/{id}
Soft-delete an account (only if it has no journal lines).

---

### Journal Entries

#### GET /accounting/journal-entries
Query params: `date_from`, `date_to`, `reference_type`

All entries are system-generated. Manual journal creation is not exposed.

---

### Financial Reports

#### GET /accounting/reports/income-statement
Query params: `date_from` (required), `date_to` (required)

**Response:** Revenue accounts vs. expense accounts with totals and net income.

#### POST /accounting/reports/income-statement/pdf
Generate and return a PDF income statement. Same body params as GET query params.

#### GET /accounting/reports/balance-sheet
Query params: `as_of_date` (required)

**Response:** Assets, liabilities, equity sections with totals.

#### POST /accounting/reports/balance-sheet/pdf
Generate and return a PDF balance sheet.

#### GET /accounting/reports/cash-flow
Query params: `date_from` (required), `date_to` (required)

#### GET /accounting/reports/client-statement
Query params: `client_id` (required), `date_from`, `date_to`

Returns AR aging with opening balance, charges, payments, closing balance.

#### GET /accounting/reports/client-statement/pdf
PDF version of the client statement. Same query params as above.

---

### Bank Transactions

#### GET /accounting/bank-transactions
Returns a ledger of all `business_bank` transactions (sales deposits, expense payments, PO payments) sorted by date with a running balance.

Query params: `date_from`, `date_to`

#### POST /accounting/bank-transactions/export/pdf
Exports the bank transaction ledger as a PDF.

---

## Expenses

All expense endpoints require `permission:accounting.view`.

### GET /expenses
Query params: `status` (draft/recorded/voided), `date_from`, `date_to`, `expense_category_id`

### GET /expenses/categories
List all expense categories with their mapped GL account codes.

### GET /expenses/summary
Returns expense totals grouped by category for the given date range.
Query params: `date_from`, `date_to`

### GET /expenses/export/pdf
Export filtered expenses as a PDF.

### GET /expenses/export/csv
Export filtered expenses as a CSV file.

### GET /expenses/{id}

### POST /expenses
Create a manual expense in **draft** status.
```json
{
  "date": "2026-04-12",
  "payee": "MERALCO",
  "expense_category_id": 3,
  "subtotal": 8500.00,
  "tax_amount": 0.00,
  "total_amount": 8500.00,
  "payment_method": "cash",
  "reference_number": "OR-20260412",
  "notes": "April electricity bill"
}
```
`payment_method` options: `cash`, `business_bank`

### PUT /expenses/{id}
Update a draft expense.

### POST /expenses/{id}/confirm
Confirm a draft expense — posts the journal entry and sets status to **recorded**.

### POST /expenses/{id}/void
Void a recorded expense — reverses the journal entry and sets status to **voided**. Only applicable to `source = manual` expenses.

### POST /expenses/sync-from-pos
Syncs POS-related expenses from completed sales (internal use).

---

## Dashboard

### GET /dashboard
Query params: `sales_trend_days` (optional — `7`, `14`, or `30`; default `30`)

Returns:
```json
{
  "todays_sales": 45000.00,
  "pending_pos": 3,
  "low_stock_count": 7,
  "total_clients": 120,
  "total_products": 342,
  "recent_transactions": [...],
  "sales_trend": [
    { "date": "2026-03-01", "total": 38000.00 },
    ...
  ]
}
```

---

## Response Format

### Success (single resource)
```json
{ "data": { ... } }
```

### Success (paginated list)
```json
{
  "data": [...],
  "meta": {
    "current_page": 1,
    "last_page": 5,
    "per_page": 15,
    "total": 72
  }
}
```

### Validation Error (422)
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": ["The email field is required."]
  }
}
```

### Auth Error (401)
```json
{ "message": "Unauthenticated." }
```

### Forbidden (403)
```json
{ "message": "This action is unauthorized." }
```
