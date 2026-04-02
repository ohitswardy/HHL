# HardhatLedger — Architecture

## Overview

HardhatLedger follows a standard **SPA + REST API** architecture:

```
┌─────────────────────────┐        HTTP/JSON        ┌─────────────────────────┐
│   React SPA             │ ──────────────────────▶ │   Laravel REST API      │
│   (localhost:5173)      │ ◀────────────────────── │   (localhost:8000)      │
└─────────────────────────┘    Bearer Token Auth     └────────────┬────────────┘
                                                                   │
                                                        ┌──────────▼──────────┐
                                                        │   MySQL 8.0         │
                                                        │   (hardhatledger)   │
                                                        └─────────────────────┘
```

---

## Backend Architecture (Laravel 12)

### Request Lifecycle

```
HTTP Request
    │
    ▼
routes/api.php
    │
    ▼
Middleware Stack
  ├── auth:sanctum        (token validation)
  └── permission:<name>   (RBAC check via Spatie)
    │
    ▼
FormRequest (validation)
    │
    ▼
Controller
    │
    ├── Service(s)         (business logic)
    │     ├── PricingService
    │     ├── InventoryService
    │     ├── JournalService
    │     └── TransactionNumberService
    │
    ├── Model(s) / Eloquent ORM
    │
    └── API Resource (response transformer)
```

### Layer Responsibilities

| Layer | Location | Responsibility |
|---|---|---|
| Routes | `routes/api.php` | URL mapping, middleware assignment |
| Form Requests | `app/Http/Requests/` | Input validation, authorization |
| Controllers | `app/Http/Controllers/Api/` | Orchestration only, thin |
| Services | `app/Services/` | All business logic |
| Models | `app/Models/` | ORM, relationships, accessors |
| Resources | `app/Http/Resources/` | Response shaping |

### Services

| Service | Purpose |
|---|---|
| `PricingService` | Resolves final product price: tier price → base price fallback |
| `InventoryService` | Transactional stock adjustments + movement recording |
| `JournalService` | Double-entry accounting entries auto-created from business events |
| `TransactionNumberService` | Generates unique PO and sale transaction numbers |

### Authentication
- Laravel Sanctum issues opaque API tokens on login
- Tokens are stored by the client in `localStorage` (`hhl_token`)
- Every protected request must include `Authorization: Bearer <token>`
- `POST /api/v1/auth/logout` revokes the token server-side

### Authorization (RBAC)
- Spatie Laravel Permission handles roles + permissions
- Roles: `Sales Clerk`, `Manager`, `Admin`, `Super Admin`
- Permission middleware: `permission:<permission-name>` on route groups
- Frontend mirrors permissions via `authStore.hasPermission()` and `hasRole()`

### Accounting Design
HardhatLedger uses **double-entry bookkeeping**:
- Every financial event (sale, PO receipt) triggers `JournalService`
- `journal_entries` record the event; `journal_lines` hold debits/credits
- `chart_of_accounts` is hierarchical (`parent_id` self-reference)
- Account balance is computed dynamically based on account type (normal debit/credit side)

---

## Frontend Architecture (React 19 + TypeScript)

### Component Hierarchy

```
main.tsx
  └── App.tsx (BrowserRouter + QueryClientProvider)
        ├── /login → LoginPage
        └── ProtectedRoute
              └── AppLayout
                    ├── Sidebar (navigation)
                    └── <Outlet> (active page)
                          ├── DashboardPage
                          ├── modules/inventory/pages/*
                          ├── modules/pos/pages/*
                          ├── modules/clients/pages/*
                          ├── modules/suppliers/pages/*
                          └── modules/accounting/pages/*
```

### State Management Strategy

| Store | Tool | Scope |
|---|---|---|
| Auth (user, token, roles) | Zustand (`authStore`) | Global, persisted to localStorage |
| POS cart | Zustand (`cartStore`) | Global, in-memory |
| Server data | React Query | Per-component, cached |
| Form state | React Hook Form | Local to form |

### API Layer (`src/lib/api.ts`)
- Single Axios instance with `baseURL = http://localhost:8000/api/v1`
- Request interceptor: attaches `Bearer` token from localStorage
- Response interceptor: clears auth and redirects to `/login` on 401

### Module Structure
Each feature follows the same pattern:
```
src/modules/<feature>/
  └── pages/
        └── <Feature>Page.tsx    # Query data + render table/form
```
Shared primitives live in `src/components/ui/` (Button, Input, Card, Modal, Badge, Select, Spinner).

### Routing
React Router 7 with nested routes. `ProtectedRoute` wraps all authenticated pages — redirects to `/login` if no token is present.

---

## Database Design Principles

- All tables carry `branch_id` for multi-branch isolation (future)
- All major entities use soft deletes (`deleted_at`) for audit trail
- Prices stored as `DECIMAL(15,2)` — never floats
- JSON columns (`old_value`, `new_value`) in `audit_logs` for change tracking
- Self-referencing `parent_id` on `categories` and `chart_of_accounts` for hierarchy
- Pivot-like `product_prices` table links products to client tiers with specific prices

---

## Key Design Decisions

### Why Laravel + React SPA (not Blade/Inertia)?
Full API separation allows the frontend to evolve independently and supports future mobile apps using the same API.

### Why Sanctum over Passport/JWT?
Sanctum's opaque tokens are simpler for SPA use cases, easier to revoke, and sufficient for the current single-app deployment.

### Why Zustand over Redux?
Lighter boilerplate. The app's global state is limited to auth and cart — Redux's complexity is not justified.

### Why double-entry accounting?
The business is transitioning from QuickBooks, so accountants expect standard double-entry ledgers. It also enables proper financial statements without external integration.

### Why branch_id everywhere?
The client has expressed intent to expand to multiple branches. Adding the column now costs nothing; retrofitting it later on a live database is painful.
