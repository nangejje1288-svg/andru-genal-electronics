# Supabase backend setup

The storefront uses Supabase for shared products, private buying costs, discount news, customer comments, and administrator authentication. Cart contents remain in the customer's browser.

## 1. Create the project and tables

1. Create a Supabase project.
2. Open **SQL Editor**, paste `supabase-schema.sql`, and run it.
3. In **Project Settings → API**, copy the Project URL and the public `anon` key. Never use the `service_role` key in this website.
4. Put the URL and public anon key in `supabase-config.js`:

```js
window.SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
window.SUPABASE_ANON_KEY = 'YOUR_PUBLIC_ANON_KEY';
```

The anon key is intended for browser use; row-level security in the supplied schema is what protects administrator operations and buying costs.

## 2. Create and authorize the first administrator

1. In Supabase **Authentication → Users**, create an administrator user using an email address and a new, unique password. Do not reuse the old inventory password; it was embedded in the previous client-side login and must be treated as exposed. Disable public sign-ups in **Authentication → Settings** if customers do not need accounts.
2. Copy that user's UUID.
3. In SQL Editor, run:

```sql
insert into public.admin_users (user_id)
values ('PASTE-ADMIN-USER-UUID-HERE');
```

The `admin_users` table is only manageable by an existing admin using the project dashboard; the browser client has no policy to grant itself admin rights. The inventory page signs in with the admin email and password, and the database checks the admin assignment on every protected operation.

## 3. Upload and test

Upload all HTML files, JavaScript files, and the complete `images` directory to static hosting. Keep their relative paths unchanged. Open the site over HTTPS, sign in to Inventory, then add products and announcements. Public pages read shared database data, while buying costs are only queryable by authorized admins.

## Importing existing browser inventory

The former site stored inventory, discount news, and feedback in one browser's `localStorage`. That browser data is not automatically accessible to Supabase or to other devices. Before changing browser/device/origin or clearing browser data, configure the Supabase URL and anon key, sign in to Inventory in the same browser that contains the old data, and choose **Import saved browser data**. This upserts products and news by their existing IDs and imports comments. Product photo files remain in the website's `images` directory.
