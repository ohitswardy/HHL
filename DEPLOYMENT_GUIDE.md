# HardhatLedger — Deployment Guide (Hostinger KVM2)

> **Plain-English Summary:** You have two things to deploy — the **backend** (the Laravel API, handles all the data logic) and the **frontend** (the React app, the screens your users see). Both go onto your Hostinger KVM2 VPS. Think of the VPS as a computer in a data center that runs 24/7. You will type commands into it over SSH, the same way you use PowerShell on your Windows machine — just on a remote Linux computer.

---

## Before You Begin — What You Need

1. **Your Hostinger KVM2 VPS** — buy or activate it at hpanel.hostinger.com. Pick **Ubuntu 22.04** as the OS when setting it up.
2. **Two subdomains (or a domain + subdomain)** pointed at your VPS IP. Example:
   - `api.yourdomain.com` → the backend
   - `app.yourdomain.com` → the frontend
   Go to Hostinger → DNS Zone → add two `A` records pointing both subdomains to your VPS IP address.
3. **An SSH client on your Windows PC** — Windows 11/10 already has one built in (the regular Command Prompt or PowerShell works).
4. **Your project code** — either pushed to a private GitHub/GitLab repo, or zipped and ready to upload.

> **Tip:** Every time you see `yourdomain.com` below, replace it with your actual domain.
> Every time you see `YOUR_VPS_IP`, replace it with the IP shown in your Hostinger panel.

---

## PART A — Connect to Your VPS

Open PowerShell on your PC and type:

```bash
ssh root@YOUR_VPS_IP
```

It will ask for your root password (set during VPS setup in Hostinger). Type it and press Enter. You are now inside your server.

> **You will stay connected like this for most of the steps below. If you disconnect, just run `ssh root@YOUR_VPS_IP` again.**

---

## PART B — Install Everything the Server Needs

Copy and paste these commands one block at a time. Wait for each to finish before pasting the next.

### B1 — Update the server's software list
```bash
apt update && apt upgrade -y
apt install -y git curl zip unzip software-properties-common
```
*This is like running Windows Update — it makes sure everything is current.*

### B2 — Install PHP 8.2 (the language the backend is written in)
```bash
add-apt-repository ppa:ondrej/php -y
apt update
apt install -y php8.2 php8.2-fpm php8.2-mysql php8.2-xml \
  php8.2-mbstring php8.2-curl php8.2-zip php8.2-bcmath \
  php8.2-gd php8.2-intl php8.2-tokenizer php8.2-ctype
```

### B3 — Install Nginx (the web server, like Apache but lighter)
```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

### B4 — Install MySQL 8 (the database)
```bash
apt install -y mysql-server
systemctl enable mysql
```

Now run the MySQL security wizard — it will ask you questions:
```bash
mysql_secure_installation
```
- **Validate password component?** → `N` (No — you'll set a strong password manually)
- **Set root password?** → `Y` then type a strong password and remember it
- **Remove anonymous users?** → `Y`
- **Disallow root login remotely?** → `Y`
- **Remove test database?** → `Y`
- **Reload privilege tables?** → `Y`

### B5 — Create the database and a dedicated database user
```bash
mysql -u root -p
```
It will ask for the MySQL root password you just set. Then paste these lines **one by one**:
```sql
CREATE DATABASE hardhatledger CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'hhl_user'@'localhost' IDENTIFIED BY 'REPLACE_WITH_A_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON hardhatledger.* TO 'hhl_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```
> **Write down `hhl_user` and the password you set — you will need it in Step D.**

### B6 — Install Composer (PHP's package manager, like npm but for PHP)
```bash
curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer
chmod +x /usr/local/bin/composer
```

### B7 — Install Node.js 20 (needed to build the frontend)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

### B8 — Install Supervisor (keeps the background queue worker running)
```bash
apt install -y supervisor
```

---

## PART C — Upload Your Code to the Server

### Option 1: Using Git (recommended if you have a GitHub/GitLab repo)
```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git hardhatledger-api
```
*This downloads the backend code into `/var/www/hardhatledger-api`.*

### Option 2: Upload via Hostinger File Manager (no Git needed)
1. On your **Windows PC**, open the `hardhatledger-api` folder in File Explorer.
2. Delete the `vendor/` folder locally (it's huge and gets rebuilt on the server).
3. Zip the remaining contents.
4. In Hostinger hPanel → File Manager → navigate to `/var/www/` → upload the zip → extract it → rename the extracted folder to `hardhatledger-api`.

> **Important:** Do NOT upload the `.env` file — you will create a fresh one on the server in the next step.

---

## PART D — Configure the Backend

### D1 — Install PHP dependencies
```bash
cd /var/www/hardhatledger-api
composer install --no-dev --optimize-autoloader
```
*This downloads all the PHP libraries the backend needs. `--no-dev` skips testing tools you don't need in production.*

### D2 — Create the environment file
```bash
cp .env.example .env
nano .env
```
*`nano` is a simple text editor on Linux. Use arrow keys to move around.*

Delete everything and replace with this (fill in YOUR values where indicated):
```dotenv
APP_NAME=HardhatLedger
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://api.yourdomain.com

LOG_CHANNEL=stack
LOG_STACK=single
LOG_LEVEL=warning

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=hardhatledger
DB_USERNAME=hhl_user
DB_PASSWORD=REPLACE_WITH_YOUR_DB_PASSWORD

DEFAULT_BRANCH_ID=1

SESSION_DRIVER=database
SESSION_LIFETIME=120
QUEUE_CONNECTION=database
CACHE_STORE=database

FRONTEND_URL=https://app.yourdomain.com
SANCTUM_STATEFUL_DOMAINS=app.yourdomain.com
SANCTUM_EXPIRATION=480
CORS_ALLOWED_ORIGINS=https://app.yourdomain.com
```

To save and exit nano: press `Ctrl + X`, then `Y`, then `Enter`.

### D3 — Generate the app encryption key
```bash
php artisan key:generate
```
*This fills in the `APP_KEY=` line automatically. It's like a secret password the app uses to encrypt data.*

### D4 — Run the database migrations and seed default data
```bash
php artisan migrate --force
php artisan db:seed --force
```
*This creates all the database tables and loads the default roles, chart of accounts, and admin user.*

### D5 — Warm up the caches (makes the app faster)
```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
php artisan storage:link
```

### D6 — Set correct file permissions (so Nginx can read/write files)
```bash
chown -R www-data:www-data /var/www/hardhatledger-api
chmod -R 755 /var/www/hardhatledger-api
chmod -R 775 /var/www/hardhatledger-api/storage
chmod -R 775 /var/www/hardhatledger-api/bootstrap/cache
```

---

## PART E — Build and Upload the Frontend

**Do this part on your Windows PC (not the server).**

### E1 — Create a production environment file for the frontend
Open `hardhatledger-web/` in VS Code. Create a new file called `.env.production` with this content:
```dotenv
VITE_API_URL=https://api.yourdomain.com/api/v1
```

### E2 — Build the frontend
Open PowerShell in the `hardhatledger-web/` folder:
```bash
npm install
npm run build
```
This will create a `dist/` folder. Those are your compiled frontend files — just plain HTML/CSS/JS.

### E3 — Upload `dist/` to the server
```bash
# Run this in PowerShell on your PC (not on the server):
scp -r dist root@YOUR_VPS_IP:/var/www/hardhatledger-web
```
Or use Hostinger's File Manager: upload the contents of `dist/` to `/var/www/hardhatledger-web/` on the server.

### E4 — Set permissions on the server
```bash
# Back on the server via SSH:
chown -R www-data:www-data /var/www/hardhatledger-web
chmod -R 755 /var/www/hardhatledger-web
```

---

## PART F — Configure Nginx (the Web Server)

Nginx is what listens for visitors and routes them to either the Laravel backend or the React frontend.

### F1 — Create the backend (API) config
```bash
nano /etc/nginx/sites-available/hardhatledger-api
```

Paste this in exactly:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    root /var/www/hardhatledger-api/public;
    index index.php;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.env { deny all; }
    location ~ /\.ht  { deny all; }
}
```
Save with `Ctrl + X`, `Y`, `Enter`.

### F2 — Create the frontend (app) config
```bash
nano /etc/nginx/sites-available/hardhatledger-web
```

Paste this in:
```nginx
server {
    listen 80;
    server_name app.yourdomain.com;
    root /var/www/hardhatledger-web;
    index index.html;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    # All page routes (like /pos, /accounting) fall back to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache images/CSS/JS for 1 year (Vite puts a hash in filenames so this is safe)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```
Save with `Ctrl + X`, `Y`, `Enter`.

### F3 — Enable both sites and reload Nginx
```bash
ln -s /etc/nginx/sites-available/hardhatledger-api /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/hardhatledger-web /etc/nginx/sites-enabled/
nginx -t
```
If you see `syntax is ok` and `test is successful`, run:
```bash
systemctl reload nginx
```

---

## PART G — Enable HTTPS (Free SSL via Let's Encrypt)

HTTPS encrypts the connection between your users and the app. Without it, passwords travel in plain text. This is free.

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.yourdomain.com -d app.yourdomain.com
```

Follow the prompts:
- Enter your email address (for renewal reminders)
- Agree to the terms → `Y`
- Share email with EFF (optional) → your choice
- It will automatically update your Nginx configs to use HTTPS

**Set up automatic renewal** (SSL certificates expire every 90 days — this renews them automatically):
```bash
crontab -e
```
If it asks which editor, pick `1` (nano). Then add this line at the bottom of the file:
```
0 3 * * * certbot renew --quiet
```
Save with `Ctrl + X`, `Y`, `Enter`.

---

## PART H — Start the Background Queue Worker

The queue worker handles background jobs (like sending emails or processing large imports) without making the user wait.

```bash
nano /etc/supervisor/conf.d/hhl-worker.conf
```

Paste this in:
```ini
[program:hhl-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/hardhatledger-api/artisan queue:work --sleep=3 --tries=3 --timeout=90
autostart=true
autorestart=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/hardhatledger-api/storage/logs/worker.log
```
Save with `Ctrl + X`, `Y`, `Enter`.

Then activate it:
```bash
supervisorctl reread
supervisorctl update
supervisorctl start hhl-worker:*
```

---

## PART I — Verify Everything is Working

Run these checks one by one:

```bash
# 1. Is PHP-FPM running?
systemctl status php8.2-fpm

# 2. Does the API respond? (should return {"status":"up"} or similar)
curl https://api.yourdomain.com/up

# 3. Does the login endpoint respond?
curl -X POST https://api.yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hardhatledger.com","password":"password"}'

# 4. Are queue workers running?
supervisorctl status

# 5. Any errors in the Laravel log?
tail -f /var/www/hardhatledger-api/storage/logs/laravel.log
```

Now open your browser and go to `https://app.yourdomain.com`. You should see the HardhatLedger login page.

> **First thing after logging in:** Go to Users → change the admin password away from `password`.

---

## PART J — How to Deploy Updates in the Future

Every time you make changes to the code:

**Backend update:**
```bash
ssh root@YOUR_VPS_IP
cd /var/www/hardhatledger-api
git pull                              # download latest code
composer install --no-dev --optimize-autoloader
php artisan migrate --force           # run any new database changes
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
supervisorctl restart hhl-worker:*   # restart the queue worker
```

**Frontend update** (do on your PC first):
```bash
cd hardhatledger-web
npm run build
scp -r dist root@YOUR_VPS_IP:/var/www/hardhatledger-web
```

---

## Quick Reference — Settings That Change Per Environment

| Setting | On Your PC (local) | On Hostinger (production) |
|---|---|---|
| `APP_ENV` | `local` | `production` |
| `APP_DEBUG` | `true` | `false` |
| `LOG_LEVEL` | `debug` | `warning` |
| `DB_USERNAME` | `root` | `hhl_user` |
| `DB_PASSWORD` | *(blank)* | your strong password |
| `APP_URL` | `http://localhost:8000` | `https://api.yourdomain.com` |
| `FRONTEND_URL` | `http://localhost:5173` | `https://app.yourdomain.com` |
| `SANCTUM_STATEFUL_DOMAINS` | `localhost:5173` | `app.yourdomain.com` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | `https://app.yourdomain.com` |
| `VITE_API_URL` (frontend) | `http://localhost:8000/api/v1` | `https://api.yourdomain.com/api/v1` |

---

## Final Go-Live Checklist

Before you tell anyone the app is live, confirm every item:

- [ ] `https://app.yourdomain.com` loads the login screen in your browser
- [ ] You can log in with `admin@hardhatledger.com` / `password`
- [ ] **Change the admin password immediately**
- [ ] `APP_DEBUG=false` in `/var/www/hardhatledger-api/.env`
- [ ] Both subdomains show the padlock (HTTPS) in the browser
- [ ] `supervisorctl status` shows `hhl-worker` as RUNNING
- [ ] `php artisan config:cache` has been run
- [ ] Database is migrated: `php artisan migrate:status` shows all migrations as Ran
- [ ] No errors in `storage/logs/laravel.log`
- [ ] File permissions: `storage/` and `bootstrap/cache/` are writable by `www-data`

---

## Local Development (XAMPP) — For Reference

### Backend Setup
```bash
cd hardhatledger-api

# 1. Install dependencies
composer install

# 2. Copy and configure the environment file
cp .env.example .env
```

Edit `.env` for local use:
```dotenv
APP_NAME=HardhatLedger
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=hardhatledger
DB_USERNAME=root
DB_PASSWORD=

SANCTUM_STATEFUL_DOMAINS=localhost:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
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
