# HardhatLedger — Security Guidelines

## Authentication & Session Security

### API Tokens (Sanctum)
- Tokens are opaque (not JWTs) — they are hashed and stored in the database
- Tokens are revoked on logout (`POST /auth/logout`) — always call this endpoint, do not just clear localStorage
- Tokens do not expire by default; consider setting `SANCTUM_TOKEN_EXPIRATION` in production
- Never log or expose tokens in error messages or debug output

### Password Policy
- Passwords are hashed with bcrypt (Laravel default, cost factor 12)
- Minimum password length: enforce at least 8 characters in `StoreUserRequest`
- Change the default seeded password (`password`) immediately in production
- Never store plain-text passwords anywhere

### Frontend Token Storage
- Token is stored in `localStorage` under `hhl_token`
- **Risk:** localStorage is accessible to JavaScript (XSS risk)
- **Mitigation:** Keep all user-generated content escaped; never use `dangerouslySetInnerHTML` without sanitization
- On 401 response, the Axios interceptor clears localStorage and redirects to login

---

## Authorization (RBAC)

### Roles and Least Privilege
| Role | What they can do |
|---|---|
| Sales Clerk | POS sales only — no access to accounting, settings, user management |
| Manager | View reports and approve POs — cannot manage users or system settings |
| Admin | Full business operations — cannot manage users |
| Super Admin | Everything |

### Server-side Enforcement
- Never rely solely on frontend role checks
- Every sensitive route uses `permission:<name>` middleware via Spatie
- Frontend role checks (`hasRole()`, `hasPermission()`) are UI-only — they control visibility, not access
- If a new endpoint is added, always attach the appropriate permission middleware

### Adding New Permissions
1. Add to the seeder in `database/seeders/`
2. Assign to the correct roles
3. Protect the route: `->middleware('permission:your-permission')`

---

## Input Validation

- All API input is validated through Laravel Form Request classes before reaching controllers
- Never trust client-supplied data (prices, stock quantities, user IDs)
- Prices resolved server-side via `PricingService` — client cannot submit an arbitrary price that will be accepted
- `client_id` in sales is validated against the database; walk-in sales use `null`

### SQL Injection
- All database queries use Eloquent ORM or the Query Builder with parameterized bindings
- Never concatenate raw user input into SQL strings
- If raw queries are needed, always use `DB::select('SELECT * FROM x WHERE id = ?', [$id])`

### Mass Assignment
- All models have explicit `$fillable` arrays — never use `$guarded = []`
- Fields like `is_active`, `branch_id`, `outstanding_balance` must NOT be in `$fillable` unless intentionally updatable by users

---

## Sensitive Data Handling

### Financial Data
- All monetary values are stored as `DECIMAL(15,2)` — never floats
- Never expose `cost_price` to Sales Clerk roles (it reveals margins)
- Client `outstanding_balance` and `credit_limit` should only be visible to Manager/Admin roles

### Audit Trail
- `audit_logs` stores old and new values for every create/update/delete
- Logs include `user_id` and `ip_address` — do not purge logs without authorization
- `inventory_movements` is immutable — never allow DELETE on this table

### PII (Personally Identifiable Information)
- Client data (name, phone, email, address) is sensitive
- Apply soft deletes — do not permanently delete client records without a data retention policy review
- Do not log client PII in application logs or error messages

---

## API Security

### CORS
- `config/cors.php` restricts allowed origins to the known frontend URLs
- Do not add wildcard (`*`) origins in production
- `supports_credentials` is `true` — required for Sanctum cookie-based auth if ever needed

### Rate Limiting
- Laravel's default rate limiter is applied to the API
- Consider tightening `POST /auth/login` rate limiting to prevent brute-force attacks:
  ```php
  // In RouteServiceProvider or routes/api.php
  RateLimiter::for('login', function (Request $request) {
      return Limit::perMinute(5)->by($request->ip());
  });
  ```

### HTTP Headers (Production)
Add these via Nginx or middleware:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

---

## PDF Receipts

- PDFs are generated server-side via DomPDF — no user-controlled HTML is rendered
- Never include unescaped user data directly in Blade templates used for PDF generation
- Receipts should only be accessible to the user who created the sale or roles with reporting access

---

## Environment & Infrastructure

### .env File
- Never commit `.env` to version control — it is in `.gitignore`
- Set `APP_DEBUG=false` in production — debug mode exposes stack traces with sensitive data
- Use strong, random values for `APP_KEY`
- Use a dedicated MySQL user for the app with only the permissions it needs (not `root`)

### Database
- Disable MySQL remote root access
- Use strong passwords for the database user in production
- Enable MySQL binary logging for point-in-time recovery

### Dependencies
- Run `composer audit` and `npm audit` periodically to check for known vulnerabilities
- Keep Laravel, PHP, and npm packages up to date

---

## Incident Response

If a security incident occurs:
1. Revoke all active Sanctum tokens: `php artisan sanctum:prune-expired` or delete from `personal_access_tokens`
2. Force password reset for affected users
3. Review `audit_logs` for unauthorized actions
4. Review `inventory_movements` for unauthorized stock changes
5. Change `APP_KEY` (this will invalidate all encrypted data — use with caution)
