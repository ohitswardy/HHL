# HardhatLedger — Deployment Guide

## Local Development (XAMPP)

### Prerequisites
- XAMPP with Apache + MySQL running
- PHP 8.2+ in PATH
- Composer
- Node.js 20+ and npm

### Backend Setup
```bash
cd hardhatledger-api

# 1. Install dependencies
composer install

# 2. Configure environment
cp .env.example .env
```

Edit `.env`:
```env
APP_NAME=HardhatLedger
APP_ENV=local
APP_KEY=         # filled by artisan key:generate
APP_DEBUG=true
APP_URL=http://localhost:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=hardhatledger
DB_USERNAME=root
DB_PASSWORD=      # your XAMPP MySQL password (blank by default)

SANCTUM_STATEFUL_DOMAINS=localhost:5173
SESSION_DOMAIN=localhost
```

```bash
# 3. Generate app key
php artisan key:generate

# 4. Run migrations and seed
php artisan migrate --seed

# 5. Start dev server
php artisan serve
# Available at http://localhost:8000
```

### Frontend Setup
```bash
cd hardhatledger-web

# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev
# Available at http://localhost:5173
```

---

## Production Deployment (VPS / Shared Hosting)

### Backend (Laravel)

#### 1. Server Requirements
- PHP 8.2+ with extensions: BCMath, Ctype, Fileinfo, JSON, Mbstring, OpenSSL, PDO, Tokenizer, XML
- MySQL 8.0+
- Composer
- Apache or Nginx with mod_rewrite / try_files

#### 2. Upload & Configure
```bash
# Clone or upload to server (e.g., /var/www/hardhatledger-api)
composer install --optimize-autoloader --no-dev

# Create and configure .env
cp .env.example .env
# Set APP_ENV=production, APP_DEBUG=false, APP_URL=https://api.yourdomain.com

php artisan key:generate
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

#### 3. Web Server Config (Nginx)
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    root /var/www/hardhatledger-api/public;

    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

#### 4. Permissions
```bash
chown -R www-data:www-data /var/www/hardhatledger-api
chmod -R 755 /var/www/hardhatledger-api
chmod -R 775 /var/www/hardhatledger-api/storage
chmod -R 775 /var/www/hardhatledger-api/bootstrap/cache
```

#### 5. Database
```bash
php artisan migrate --force --seed
```

### Frontend (React SPA)

#### 1. Build
```bash
cd hardhatledger-web

# Set production API URL
# Create .env.production:
echo "VITE_API_URL=https://api.yourdomain.com/api/v1" > .env.production

npm run build
# Output in dist/
```

#### 2. Deploy dist/
Upload the `dist/` folder contents to your static hosting (Nginx, Apache, Netlify, Vercel, etc.)

#### Nginx Config for SPA
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/hardhatledger-web/dist;

    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### 3. Update CORS (Backend .env)
```env
SANCTUM_STATEFUL_DOMAINS=yourdomain.com
SESSION_DOMAIN=yourdomain.com
```
And in `config/cors.php`, add your production frontend URL to `allowed_origins`.

---

## Environment Variables Reference

### Backend (.env)
| Variable | Description | Example |
|---|---|---|
| `APP_KEY` | Laravel app encryption key | generated |
| `APP_URL` | Backend URL | `http://localhost:8000` |
| `DB_DATABASE` | MySQL database name | `hardhatledger` |
| `DB_USERNAME` | MySQL user | `root` |
| `DB_PASSWORD` | MySQL password | (blank for XAMPP default) |
| `SANCTUM_STATEFUL_DOMAINS` | Frontend domains for Sanctum | `localhost:5173` |

### Frontend (.env / .env.production)
| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Backend API base URL | `http://localhost:8000/api/v1` |

> **Note:** The current `src/lib/api.ts` has the URL hardcoded. For production, update it to read from `import.meta.env.VITE_API_URL`.

---

## Post-Deployment Checklist

- [ ] `.env` has `APP_DEBUG=false` and `APP_ENV=production`
- [ ] `APP_KEY` is set
- [ ] Database is migrated and seeded
- [ ] Storage symlink created: `php artisan storage:link`
- [ ] CORS `allowed_origins` includes the production frontend URL
- [ ] Default admin password changed from `password`
- [ ] HTTPS configured (Let's Encrypt recommended)
- [ ] File permissions set correctly (775 on storage, bootstrap/cache)
- [ ] Laravel caches warmed: `config:cache`, `route:cache`, `view:cache`
- [ ] Queue worker running if jobs are used: `php artisan queue:work`
