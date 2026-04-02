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

Requires permission: `manage users` (Super Admin only)

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
  "notes": ""
}
```
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

---

## Inventory

### GET /inventory
List active products with current stock levels.

### GET /inventory/movements
Query params: `product_id`, `type` (in/out/adjustment), `date_from`, `date_to`

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
### PUT /purchase-orders/{id}
### DELETE /purchase-orders/{id}

### POST /purchase-orders/{id}/receive
Marks goods as received, updates inventory stock.
```json
{
  "items": [
    { "product_id": 1, "quantity_received": 100 }
  ]
}
```

---

## POS / Sales

### GET /pos/sales
Query params: `status`, `client_id`, `date_from`, `date_to`

### POST /pos/sales
Creates a complete sale transaction with items and payments.
```json
{
  "client_id": 1,
  "fulfillment_type": "pickup",
  "notes": "",
  "items": [
    { "product_id": 1, "quantity": 10, "discount": 0 }
  ],
  "payments": [
    { "payment_method": "cash", "amount": 2800.00, "reference_number": null }
  ]
}
```
Prices are resolved server-side via `PricingService`. The client's tier price is applied automatically.

### GET /pos/sales/{id}
### POST /pos/sales/{id}/void
Voids a completed sale and reverses inventory.

### GET /pos/sales/{id}/receipt
Returns a PDF receipt (Content-Type: application/pdf).

### GET /pos/daily-summary
Returns today's sales totals broken down by payment method.

---

## Accounting

### GET /accounting/chart-of-accounts
Returns the full hierarchical chart of accounts with balances.

### GET /accounting/journal-entries
Query params: `date_from`, `date_to`, `reference_type`

### GET /accounting/income-statement
Query params: `date_from` (required), `date_to` (required)

**Response:** Revenue accounts vs. expense accounts with totals and net income.

### GET /accounting/balance-sheet
Query params: `as_of_date` (required)

**Response:** Assets, liabilities, equity sections with totals.

### GET /accounting/cash-flow
Query params: `date_from` (required), `date_to` (required)

### GET /accounting/client-statement
Query params: `client_id` (required), `date_from`, `date_to`

Returns AR aging with opening balance, charges, payments, closing balance.

---

## Dashboard

### GET /dashboard/summary
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
