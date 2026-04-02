# HardhatLedger

A unified business management platform for a construction materials supplier — combining Inventory, Point of Sale, and Accounting into a single integrated system.

## Modules

| Module | Description |
|---|---|
| **Inventory** | Products, categories, suppliers, stock levels, movements, purchase orders |
| **POS** | Fast sales transactions, tier-based pricing, multi-payment support, PDF receipts |
| **Accounting** | Double-entry journals, chart of accounts, income statement, balance sheet, cash flow, client AR aging |

## Stack

- **Backend:** Laravel 12 (PHP 8.2) · MySQL 8.0 · Sanctum · Spatie Permissions
- **Frontend:** React 19 · TypeScript 5.9 · Vite 8 · Tailwind CSS 4 · Zustand · React Query

## Prerequisites

- XAMPP (Apache + MySQL)
- PHP 8.2+
- Composer
- Node.js 20+
- npm

## Quick Start

### 1. Database
Create a MySQL database named `hardhatledger` in phpMyAdmin or via CLI.

### 2. Backend
```bash
cd hardhatledger-api
cp .env.example .env
# Edit .env: set DB_DATABASE=hardhatledger, DB_USERNAME, DB_PASSWORD
composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve
# Runs at http://localhost:8000
```

### 3. Frontend
```bash
cd hardhatledger-web
npm install
npm run dev
# Runs at http://localhost:5173
```

### 4. Login
- URL: `http://localhost:5173/login`
- Email: `admin@hardhatledger.com`
- Password: `password`

## Project Structure

```
HHL/
├── hardhatledger-api/          # Laravel backend
│   ├── app/
│   │   ├── Http/Controllers/Api/   # 12 API controllers
│   │   ├── Http/Requests/          # 13 form request validators
│   │   ├── Http/Resources/         # 11 API resource transformers
│   │   ├── Models/                 # 19 Eloquent models
│   │   └── Services/               # 4 business logic services
│   ├── database/migrations/        # 17 migration files
│   └── routes/api.php              # All routes (v1)
│
└── hardhatledger-web/          # React frontend
    └── src/
        ├── modules/                # Feature pages (16 pages)
        ├── components/             # Shared UI + layout
        ├── stores/                 # Zustand state stores
        ├── lib/api.ts              # Axios API client
        └── types/index.ts          # TypeScript interfaces
```

## Key Features

- **Tier-based pricing** — assign client tiers with custom prices per product
- **Multi-payment** — cash, card, bank transfer, check, credit in one transaction
- **PDF receipts** — generated server-side via DomPDF
- **Double-entry accounting** — all sales/POs automatically generate journal entries
- **Inventory tracking** — every stock movement recorded with reference
- **Credit management** — per-client credit limits and outstanding balance tracking
- **Branch-ready** — all tables carry `branch_id` for future multi-branch expansion
- **Soft deletes** — all major entities support restore and audit trail
- **Audit log** — all create/update/delete actions recorded with old/new values

## RBAC Roles

| Role | Access |
|---|---|
| Sales Clerk | POS sales only |
| Manager | Reporting, PO approvals |
| Admin | Full access except user management |
| Super Admin | Everything including user management |
