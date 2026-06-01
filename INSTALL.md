# 1876 Production Suite — Installer Package

**Version:** 1.0.0  
**Date:** June 1, 2026  
**Prepared for:** WP Engine sandbox install

---

## What's in this package

```
1876-Scheduler-Install/
├── 1876-production-suite/          ← WordPress plugin (drag to wp-content/plugins/)
│   ├── 1876-production-suite.php   ← Plugin bootstrap
│   ├── includes/
│   │   ├── class-1876-db.php       ← Creates 7 MySQL tables on activation
│   │   ├── class-1876-api-jobs.php ← Jobs CRUD + bulk import REST endpoints
│   │   ├── class-1876-api-orders.php ← Order Entry REST endpoints
│   │   └── class-1876-api-misc.php ← /users/me + settings endpoints
│   └── sql/
│       └── install.sql             ← Manual SQL option (phpMyAdmin alternative)
├── config.js                       ← API wrapper — drop alongside Scheduler HTML
└── INSTALL.md                      ← This file
```

---

## Prerequisites

- WordPress running on WP Engine (standard plan — no Node.js required)
- MySQL 8.0 (confirmed compatible — no schema changes needed)
- PHP 7.4+ (WP Engine default is fine)
- HTTPS enforced (WP Engine does this by default)

---

## Step 1 — Install the plugin

**Option A (recommended): Plugin upload via WP Admin**
1. Log into WordPress Admin (`/wp-admin`)
2. Go to **Plugins → Add New → Upload Plugin**
3. Zip the `1876-production-suite/` folder → upload the zip
4. Click **Activate Plugin**

The plugin will automatically create all 7 database tables on activation.

**Option B: FTP/SFTP**
1. Copy the `1876-production-suite/` folder to `wp-content/plugins/`
2. In WP Admin → Plugins, find **1876 Production Suite** and click **Activate**

---

## Step 2 — Verify database tables

After activation, 7 tables will be created with the prefix `wp_1876_`:

| Table                      | Purpose                        |
|----------------------------|--------------------------------|
| `wp_1876_jobs`             | Core job records               |
| `wp_1876_job_assets`       | Asset counts per job           |
| `wp_1876_job_assignments`  | Team assignees per job         |
| `wp_1876_order_entries`    | Order Entry form submissions   |
| `wp_1876_order_entry_creatives`   | Creative rows per order  |
| `wp_1876_order_entry_deliverables`| Deliverable rows per order|
| `wp_1876_settings`         | App settings (anchor date, etc)|

Verify in phpMyAdmin or WP Engine DB panel.  
**If tables are missing:** run `sql/install.sql` manually in phpMyAdmin.

---

## Step 3 — Set CORS allowed origins

Open `1876-production-suite/1876-production-suite.php` and update the `$allowed` array to include your actual domain(s):

```php
$allowed = [
    'https://your-scheduler-domain.com',   // ← replace with actual URL
    'https://your-wp-engine-site.wpengine.com',
    // Remove localhost entries before production
];
```

The current defaults allow `localhost` and `*.wpengine.com` for testing.

---

## Step 4 — Create WordPress user accounts

For each team member:
1. WP Admin → **Users → Add New**
2. Set Role to **Editor** (or custom role)
3. After saving, open the user's profile
4. Set the **LOB Group** field (plugin adds this field): `MOB`, `FIB`, `BUS`, or `ALL`

LOB Group controls which jobs each user can see/edit.

---

## Step 5 — Connect the Scheduler HTML to the API

1. Copy `config.js` to the same folder as the Scheduler HTML file
2. Add this line **before** the app scripts in the HTML:
   ```html
   <script src="config.js"></script>
   ```
3. Open `config.js` and set:
   ```js
   mode: 'server',
   apiBase: 'https://your-site.com/wp-json/1876/v1',
   ```

---

## Step 6 — Test the API

Once the plugin is active and a user is logged in, test these endpoints:

```
GET  /wp-json/1876/v1/users/me        → should return user info + lobGroup
GET  /wp-json/1876/v1/jobs            → should return [] (empty on fresh install)
POST /wp-json/1876/v1/jobs            → create a test job
```

Use the **WP Application Passwords** feature (WP Admin → Users → Edit User → Application Passwords) to generate credentials for API testing.

---

## REST API reference

| Method | Endpoint                              | Auth required |
|--------|---------------------------------------|---------------|
| GET    | `/wp-json/1876/v1/jobs`               | Yes           |
| POST   | `/wp-json/1876/v1/jobs`               | Yes           |
| GET    | `/wp-json/1876/v1/jobs/{id}`          | Yes           |
| PUT    | `/wp-json/1876/v1/jobs/{id}`          | Yes           |
| DELETE | `/wp-json/1876/v1/jobs/{id}`          | Admin only    |
| POST   | `/wp-json/1876/v1/jobs/import`        | Yes (bulk)    |
| GET    | `/wp-json/1876/v1/order-entries`      | Yes           |
| POST   | `/wp-json/1876/v1/order-entries`      | Yes           |
| GET    | `/wp-json/1876/v1/users/me`           | Yes           |
| GET    | `/wp-json/1876/v1/settings`           | Yes           |
| PUT    | `/wp-json/1876/v1/settings/{key}`     | Yes           |

---

## Security notes

- All queries use `$wpdb->prepare()` — SQL injection protected
- All routes require authentication (`is_user_logged_in()`)
- DELETE endpoints require admin (`manage_options` capability)
- LOB-based access control is enforced per-request
- HTTPS is required — WP Engine enforces this by default
- Application Passwords are used for API auth (no plain passwords transmitted)

---

## Rollback / uninstall

The plugin does **not** drop tables on deactivation (data is preserved).  
To fully remove: deactivate plugin → run `DROP TABLE` for each `wp_1876_*` table in phpMyAdmin.
