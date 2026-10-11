create extension if not exists pgcrypto;

create table if not exists public.admin_users (
    user_id uuid primary key references auth.users (id) on delete cascade,
    created_at timestamptz not null default now()
);

create table if not exists public.products (
    id text primary key,
    name text not null check (char_length(name) between 1 and 160),
    category text not null check (char_length(category) between 1 and 80),
    selling_price numeric(12, 2) check (selling_price is null or selling_price >= 0),
    stock integer not null default 0 check (stock >= 0),
    image text not null,
    description text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.product_costs (
    product_id text primary key references public.products (id) on delete cascade,
    cost_price numeric(12, 2) not null check (cost_price >= 0),
    updated_at timestamptz not null default now()
);

create table if not exists public.discount_news (
    id text primary key,
    title text not null check (char_length(title) between 1 and 100),
    message text not null check (char_length(message) between 1 and 500),
    date date,
    created_at timestamptz not null default now()
);

create table if not exists public.service_comments (
    id uuid primary key default gen_random_uuid(),
    name text not null default 'Customer' check (char_length(name) between 1 and 80),
    message text not null check (char_length(message) between 1 and 1000),
    created_at timestamptz not null default now()
);

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    );
$$;

revoke all on function public.is_store_admin() from public;
grant execute on function public.is_store_admin() to anon, authenticated;

alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.product_costs enable row level security;
alter table public.discount_news enable row level security;
alter table public.service_comments enable row level security;

create policy "Admins can read admin assignments"
on public.admin_users for select to authenticated
using (public.is_store_admin());

create policy "Visitors can read available products"
on public.products for select to anon, authenticated
using (stock > 0 and selling_price is not null);

create policy "Admins can read all products"
on public.products for select to authenticated
using (public.is_store_admin());

create policy "Admins can add products"
on public.products for insert to authenticated
with check (public.is_store_admin());

create policy "Admins can update products"
on public.products for update to authenticated
using (public.is_store_admin())
with check (public.is_store_admin());

create policy "Admins can delete products"
on public.products for delete to authenticated
using (public.is_store_admin());

create policy "Admins can manage product costs"
on public.product_costs for all to authenticated
using (public.is_store_admin())
with check (public.is_store_admin());

create policy "Visitors can read discount news"
on public.discount_news for select to anon, authenticated
using (true);

create policy "Admins can manage discount news"
on public.discount_news for all to authenticated
using (public.is_store_admin())
with check (public.is_store_admin());

create policy "Visitors can read service comments"
on public.service_comments for select to anon, authenticated
using (true);

create policy "Visitors can submit service comments"
on public.service_comments for insert to anon, authenticated
with check (char_length(message) between 1 and 1000);

create policy "Admins can delete service comments"
on public.service_comments for delete to authenticated
using (public.is_store_admin());

grant select on public.products, public.discount_news, public.service_comments to anon, authenticated;
grant insert, update, delete on public.products, public.discount_news to authenticated;
grant select, insert, update, delete on public.product_costs to authenticated;
grant select on public.admin_users to authenticated;
grant insert on public.service_comments to anon, authenticated;
grant delete on public.service_comments to authenticated;
