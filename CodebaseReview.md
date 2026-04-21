# HardhatLedger — Codebase Review

**Reviewed:** 2026-04-21
**Scope:** Full repository audit of `hardhatledger-api` (Laravel 12 / PHP 8.2) and `hardhatledger-web` (React 19 / TypeScript 5.9). Read-only review — no code changes.
**Branch reviewed:** `main` @ `e11de0d`

---

## 1. Executive Summary

HardhatLedger is a well-structured single-tenant business platform replacing Loyverse POS + QuickBooks. The architecture follows Laravel best practices with a clear service layer, RBAC via Spatie Permission, and double-entry accounting enforced through `JournalService`. The frontend is a modern React/Vite SPA with sensible state management (Zustand + TanStack Query).

**Overall verdict:** The system is internally consistent and feature-complete for its stated scope, but it is not yet production-hardened. The biggest risks are concentrated in three areas: **(1) auth/security defaults**, **(2) several performance hotspots that will degrade under data growth**, and **(3) a near-total absence of automated test coverage**. None of these block continued development, but they should be addressed before the system handles real money in a multi-user setting.

---

## 2. Architecture Overview

### 2.1 Backend (`hardhatledger-api`)

| Layer | Count / Notes |
|---|---|
| API controllers | 18 (all under `App\Http\Controllers\Api`) |
| Services | 8 — `JournalService`, `InventoryService`, `PricingService`, `ExpenseService`, `BankTransactionService`, `AuditService`, `DataPurgeService`, `TransactionNumberService` |
| Models | 23 (most use `SoftDeletes`; all major tables carry `branch_id`) |
| Migrations | 31 (FY 2026-03 through 2026-04) |
| Form Requests | Used for sale/PO validation |
| Resource transformers | Used for product/client/sale responses |
| Tests | Only Laravel scaffold tests — **0 meaningful coverage** |

**Strengths**
- Business logic correctly lives in services, not controllers (`JournalService` and `InventoryService` are particularly clean).
- Double-entry accounting is centralized in `JournalService::postSaleEntry/postPurchaseEntry/postPaymentEntry` with VAT-aware splits between revenue accounts (4010 non-VAT, 4020 VATable) and COGS accounts (5010 vatable, 5011 non-vatable).
- Soft deletes throughout, plus a dedicated `DataPurgeService` for hard-delete on >1 month-old data.
- API is versioned at `/api/v1`.
- RBAC is enforced at the route level with Spatie middleware (`permission:...`, `role:Super Admin`).
- `AuditService::log` writes change records on key mutations (users, roles, purges).

**Concerns**
- Several controllers exceed 600 lines (see §6).
- `branch_id` is hardcoded to `1` in `AuditService`, `ExpenseService`, and parts of POS — the multi-branch story will need refactoring before it can ship.
- `Product::getPriceForClient()` duplicates `PricingService::resolvePrice()` — controllers that resolve via the model bypass the service layer.

### 2.2 Frontend (`hardhatledger-web`)

| Layer | Notes |
|---|---|
| Routing | React Router 7 with `<ProtectedRoute permission="..." />` guards on every authenticated route |
| State | Zustand for auth + cart; TanStack Query for server state |
| API client | Single Axios instance at `src/lib/api.ts`; injects `Authorization: Bearer <token>` from `localStorage[hhl_token]` |
| Forms | React Hook Form + Zod |
| Tables / Charts | TanStack Table 8.21, Recharts 3.8 |
| Modules | 11 feature folders under `src/modules/` |

**Strengths**
- Clean separation: `lib/`, `stores/`, `components/ui/`, `modules/<feature>/pages/`.
- `ProtectedRoute` correctly checks both `permission` and `roles` and redirects.
- Single point of HTTP entry makes auth + 401 handling consistent.

**Concerns**
- API base URL `'http://localhost:8000/api/v1'` is hardcoded in `src/lib/api.ts` — should come from `import.meta.env.VITE_API_URL`.
- `401` handler does `window.location.href = '/login'`, which forces a full reload and discards in-memory state. A React Router navigate would be smoother.
- Several page components are very large (see §6).

---

## 3. Database Schema Observations

- All major tables include `branch_id` (good forward-compat) but the application never sets it from a real branch — always `1`.
- `journal_entries` / `journal_lines` use `decimal(14,2)` for debit/credit — appropriate.
- **No DB-level constraint that journal_lines.SUM(debit) == SUM(credit) per entry**. Balance is enforced only by application code in `JournalService`. A trigger or a periodic `tinker` reconciliation check would be a cheap safety net.
- Original `payments.payment_method` enum (migration `2026_03_31_100010`) was missing `business_bank` — added later via subsequent migration. The pattern is fine, but enums are brittle; consider a lookup table or string + check constraint long-term.
- `chart_of_accounts.code` is the FK target for `expense_categories.account_code` (string FK rather than id) — works but unusual.
- Audit log indexes look right (`auditable_type + auditable_id`, `branch_id`, `user_id`).

---

## 4. Security Findings

| # | Severity | Finding | Location |
|---|---|---|---|
| S1 | **High** | No throttle middleware on `/auth/login` — vulnerable to credential stuffing | `routes/api.php` (login route), `AuthController::login` |
| S2 | **High** | Sanctum tokens never expire (`'expiration' => null`) | `config/sanctum.php` |
| S3 | **High** | `.env` shows `APP_DEBUG=true`, empty `DB_PASSWORD`, committed `APP_KEY`. `.env` is correctly gitignored, but the working file shouldn't be the production template | `hardhatledger-api/.env` |
| S4 | **Medium** | DomPDF `enable_php = true` in 7 controllers (Accounting, BankTransaction, Expense, Pos, PurchaseOrder, Inventory, Product). PHP-in-template execution is a code-injection vector if any template content is ever user-controlled | All `*Controller::*Pdf*` methods |
| S5 | **Medium** | Auth token stored in `localStorage` (XSS-readable). Acceptable for an internal LAN tool; risky for any internet-exposed deploy | `src/stores/authStore.ts`, `src/lib/api.ts` |
| S6 | **Medium** | `incomeStatementPdfFromData` / `balanceSheetPdfFromData` accept user-edited JSON and render it to PDF. If a user can edit numbers and post them as "official" reports, that's a financial-controls gap, not a code bug — clarify whether this is intentional | `AccountingController` |
| S7 | **Low** | `StoreSaleRequest::authorize()` returns `true` blindly. Authorization is actually enforced by route middleware (`permission:pos.create-sale`), so this is fine in practice but misleading in the request class | `app/Http/Requests/Sale/StoreSaleRequest.php` |
| S8 | **Low** | CORS allows only `localhost:5173` and `127.0.0.1:5173` — correct for dev; will need updating for production | `config/cors.php` |
| S9 | **Low** | No CSRF protection needed for token API (Sanctum stateful), but worth double-checking that no SPA cookie-auth route is unintentionally exposed | `bootstrap/app.php` |

---

## 5. Performance & Scalability

| # | Concern | Impact | Location |
|---|---|---|---|
| P1 | **Race condition in transaction-number generation.** `TransactionNumberService` does `LIKE 'INV-YYYYMMDD-%' ORDER BY ... DESC LIMIT 1` then `+1`. Two concurrent sales on the same day can collide | Possible duplicate invoice numbers under load | `app/Services/TransactionNumberService.php` |
| P2 | **`BankTransactionService` loads everything then sorts in PHP.** Aggregates business_bank deposits + expense + PO outflows into an array, sorts, computes running balance. Will not scale beyond a few thousand rows | Page-load time grows linearly with history | `app/Services/BankTransactionService.php` |
| P3 | **`AccountingController::accountLedger` computes opening balance and running balance in PHP** rather than a SQL window function | Slow for accounts with many lines | `AccountingController.php` |
| P4 | **`InventoryController::lowStock` correlated subqueries** (`whereRaw('quantity_on_hand <= (SELECT reorder_level FROM products WHERE id = ...)')`). Multiple `whereRaw` subqueries, no compound indexes | Full scan on each request | `InventoryController.php` ~lines 290-300 |
| P5 | **`DashboardController` low-stock subqueries** repeat the same correlated pattern | Visible on every dashboard load | `DashboardController.php` |
| P6 | **`DataPurgeService::execute` does no chunking.** A force-delete of a busy month could lock tables | Long-held locks during purge | `DataPurgeService.php` |
| P7 | **No caching on Chart of Accounts.** Tree is rebuilt every request — it changes rarely | Wasted CPU | `AccountingController::chartOfAccounts` |
| P8 | **Payment journal per-payment.** Each payment creates a separate journal entry. Correct, but at scale consider batching for end-of-day reconciliation | Journal table bloat | `JournalService::postPaymentEntry` |

---

## 6. Code Quality & Maintainability

### Oversized files (refactor candidates)

**Backend**
- `AccountingController.php` — 910 lines (split: reports / pdf / ledger / accounts CRUD)
- `PosController.php` — 858 lines (extract report export, especially the hand-rolled XLSX builder at lines 719-840)
- `ProductController.php` — 686 lines
- `JournalService.php` — 370 lines (still cohesive, but watch the growth)

**Frontend**
- `TransactionsPage.tsx` — 1529 lines
- `PurchaseOrdersPage.tsx` — 1261 lines
- `ChartOfAccountsPage.tsx` — 1222 lines
- `ExpensesPage.tsx` — 1009 lines
- `POSPage.tsx` — 786 lines
- `IncomeStatementPage.tsx` — 748 lines
- `BalanceSheetPage.tsx` — 605 lines

These pages mix data fetching, dialogs, table state, and form logic. Extracting per-modal components and per-tab subcomponents would dramatically improve diff readability and onboarding.

### Specific issues

- **C1 — Hand-rolled XLSX builder in `PosController.php`** (lines 719-840) using `ZipArchive` to assemble OOXML by hand. Replace with `phpoffice/phpspreadsheet` or `openspout/openspout`.
- **C2 — `Product::getPriceForClient` duplicates `PricingService::resolvePrice`.** Pick one and delete the other to avoid drift.
- **C3 — `lowStock` `orWhere` grouping bug** in `InventoryController.php` (lines ~290-300): the trailing `orWhere(...)->doesntHave('stock')` is not wrapped in a closure, so it widens the WHERE clause beyond the intended `is_active=true AND (low stock OR no stock)`. Wrap in a `where(function($q) { ... })`.
- **C4 — `branch_id => 1` hardcoding** in `AuditService`, `ExpenseService`, and POS payment paths. Even single-branch deploys benefit from a single `config('app.default_branch_id')`.
- **C5 — Almost no automated tests.** `tests/Feature/ExampleTest.php` and `tests/Unit/ExampleTest.php` are scaffolds. The double-entry guarantees in `JournalService` and the VAT split logic are exactly the kind of code that needs a test suite.
- **C6 — Inconsistent case-insensitive uniqueness checks** (`whereRaw('LOWER(...)')`) in `ClientController`, `SupplierController`, `ProductController`. Functional indexes on `LOWER(name)` would help — or normalize on write.

---

## 7. Bugs Found

| # | Bug | Status |
|---|---|---|
| B1 | `InventoryController::lowStock` — ungrouped `orWhere` widens the active-product filter (see C3 above) | Open |
| B2 | Original `payments` enum lacked `business_bank` | Fixed in a follow-up migration |
| B3 | `TransactionNumberService` race condition (see P1) | Open |

No other functional bugs were found during the review.

---

## 8. What's Working Well

- **Service layer discipline.** Controllers stay readable; business rules are easy to find.
- **Double-entry accounting is enforced in code.** `JournalService` is the right kind of central-and-strict.
- **VAT handling is consistent.** Single source of truth via `JournalService::vatDivisor()` reading from `Setting`.
- **RBAC is real.** Permissions are granular, role assignment is single-role-per-user (clear), and protected routes guard both backend and frontend.
- **Audit logging exists** for sensitive operations (user CRUD, role changes, purges).
- **Soft deletes everywhere** — recoverable for the standard 1-month window before purge.
- **POS payment flow** correctly distinguishes pending (deferred methods) from completed, and `settles_payment_id` cleanly links collection payments back to credit installments.
- **Form Requests + Resource transformers** are used where they matter.
- **Frontend protected-route pattern** is consistent and easy to reason about.

---

## 9. Prioritized Recommendations

### Must do before production / multi-user load
1. Add throttle middleware on `/auth/login` (`throttle:5,1` or stricter).
2. Set Sanctum `'expiration'` to a finite value (e.g. 480 minutes) and document refresh strategy.
3. Fix the `TransactionNumberService` race — wrap sequence read+insert in a `DB::transaction` with `lockForUpdate`, or use a dedicated `transaction_sequences` table with row locks.
4. Add the JournalService balance test suite + a few POS happy-path tests. The cost of a regression in either is high.
5. Set `APP_DEBUG=false` and rotate `APP_KEY` for the production environment; provide a `.env.example` template.

### Should do soon
6. Fix `InventoryController::lowStock` `orWhere` grouping bug.
7. Replace the hand-rolled XLSX builder in `PosController` with PhpSpreadsheet/Openspout.
8. Move API base URL to `import.meta.env.VITE_API_URL`.
9. Replace `window.location.href` 401 handler with React Router `navigate`.
10. Decide on a single pricing entry-point (`PricingService` only) and remove `Product::getPriceForClient`.

### Nice to have
11. Cache the chart-of-accounts tree (invalidate on account CRUD).
12. Move `BankTransactionService` aggregation + sort into SQL (`UNION ALL` + window function).
13. Compute account ledger opening + running balance via a SQL window function.
14. Chunk `DataPurgeService::execute` deletes (e.g. 1000 rows at a time).
15. Extract dialogs and per-tab subcomponents from the four 1000+ line frontend pages.
16. Replace `branch_id => 1` constants with `config('app.default_branch_id')`.

### Long-term / when multi-branch becomes real
17. Plumb a real branch context (middleware that resolves user → branch → request scope).
18. Add a balanced-journal database trigger or a nightly reconciliation job.
19. Reconsider `localStorage` token storage if the app is ever exposed to the public internet — httpOnly cookie + Sanctum SPA mode is the standard upgrade path.

---

## 10. Final Notes

The codebase is in better shape than most internal LOB systems at this stage. The patterns you've established (services, RBAC, audit, soft delete, double-entry) are the right ones, and they're applied consistently. The work ahead is mostly **hardening** and **scaling**, not rewriting.

The single highest-leverage investment right now is a small but pointed test suite around `JournalService` and the POS sale-creation path. Everything else on the list above can be addressed incrementally as the system grows.
