-- ==============================================================================
-- GAVIKA FURNITECH - COMPLETE SUPABASE DATABASE SETUP
-- Run this entire script in your Supabase SQL Editor.
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- ==============================================================================
-- 2. TABLES
-- ==============================================================================

-- Admin Users Table
create table if not exists public.admin_users (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Custom Requests Table
create table if not exists public.custom_requests (
  id uuid default gen_random_uuid() primary key,
  request_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  catalogue_design_id text,
  catalogue_design_name text,
  catalogue_design_image_url text,
  full_name text not null,
  mobile text not null,
  email text,
  furniture_type text,
  room_usage text,
  length text,
  width text,
  height text,
  preferred_material text,
  requirement text,
  delivery_location text,
  reference_image_url text,
  status text default 'New' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Quotations Table
create table if not exists public.quotations (
  id uuid default gen_random_uuid() primary key,
  request_id uuid not null references public.custom_requests(id) on delete cascade,
  quotation_number text not null unique,
  amount numeric(12, 2) not null,
  description text,
  validity_days integer default 15,
  status text default 'Pending' not null,
  drawing_name text,
  drawing_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Orders Table
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  order_number text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null references public.custom_requests(id) on delete cascade,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  amount numeric(12, 2) not null,
  status text default 'Confirmed' not null,
  expected_delivery_date timestamp with time zone,
  delivery_address text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Furniture Types Table (Managed by Admin, shown in Custom Furniture form)
create table if not exists public.furniture_types (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Material Preferences Table (Managed by Admin, shown in Custom Furniture form)
create table if not exists public.material_preferences (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Catalogue Products Table (Managed by Admin, displayed on /furniture)
create table if not exists public.products (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text not null,
  description text,
  price text default 'Custom Quote',
  image_url text not null,
  images text[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.products add column if not exists images text[] default '{}';



-- ==============================================================================
-- 3. STORAGE BUCKET (gavika-project-files)
-- ==============================================================================

insert into storage.buckets (id, name, public)
values ('gavika-project-files', 'gavika-project-files', true)
on conflict (id) do update set public = true;

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ==============================================================================

alter table public.admin_users enable row level security;
alter table public.custom_requests enable row level security;
alter table public.quotations enable row level security;
alter table public.orders enable row level security;

-- Admin Users Policies
drop policy if exists "Users can check their own admin status" on public.admin_users;
create policy "Users can check their own admin status"
  on public.admin_users for select
  to authenticated
  using (
    auth.uid() = user_id or
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  );

drop policy if exists "Admins can insert admin users" on public.admin_users;
create policy "Admins can insert admin users"
  on public.admin_users for insert
  to authenticated
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists "Admins can delete admin users" on public.admin_users;
create policy "Admins can delete admin users"
  on public.admin_users for delete
  to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

-- Custom Requests Policies
drop policy if exists "Users can create custom requests" on public.custom_requests;
create policy "Users can create custom requests"
  on public.custom_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can view their own requests" on public.custom_requests;
create policy "Users can view their own requests"
  on public.custom_requests for select
  to authenticated
  using (
    auth.uid() = user_id or
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );

drop policy if exists "Users and Admins can update requests" on public.custom_requests;
create policy "Users and Admins can update requests"
  on public.custom_requests for update
  to authenticated
  using (
    auth.uid() = user_id or
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );

drop policy if exists "Admins can delete custom requests" on public.custom_requests;
create policy "Admins can delete custom requests"
  on public.custom_requests for delete
  to authenticated
  using (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );

-- Quotations Policies
drop policy if exists "Users and Admins can view quotations" on public.quotations;
create policy "Users and Admins can view quotations"
  on public.quotations for select
  to authenticated
  using (
    exists (
      select 1 from public.custom_requests
      where custom_requests.id = quotations.request_id
      and custom_requests.user_id = auth.uid()
    ) or exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

drop policy if exists "Admins and Users can update quotations" on public.quotations;
create policy "Admins and Users can update quotations"
  on public.quotations for update
  to authenticated
  using (
    exists (
      select 1 from public.custom_requests
      where custom_requests.id = quotations.request_id
      and custom_requests.user_id = auth.uid()
    ) or exists (
      select 1 from public.admin_users where user_id = auth.uid()
    )
  );

drop policy if exists "Admins can insert quotations" on public.quotations;
create policy "Admins can insert quotations"
  on public.quotations for insert
  to authenticated
  with check (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );

-- Orders Policies
drop policy if exists "Users and Admins can view orders" on public.orders;
create policy "Users and Admins can view orders"
  on public.orders for select
  to authenticated
  using (
    auth.uid() = user_id or
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders"
  on public.orders for update
  to authenticated
  using (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );

-- Furniture Types Policies
alter table public.furniture_types enable row level security;
drop policy if exists "Allow everyone to read furniture_types" on public.furniture_types;
create policy "Allow everyone to read furniture_types"
  on public.furniture_types for select
  to public
  using (true);

drop policy if exists "Allow admins to insert furniture_types" on public.furniture_types;
create policy "Allow admins to insert furniture_types"
  on public.furniture_types for insert
  to authenticated
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

drop policy if exists "Allow admins to delete furniture_types" on public.furniture_types;
create policy "Allow admins to delete furniture_types"
  on public.furniture_types for delete
  to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));

-- Material Preferences Policies
alter table public.material_preferences enable row level security;
drop policy if exists "Allow everyone to read material_preferences" on public.material_preferences;
create policy "Allow everyone to read material_preferences"
  on public.material_preferences for select
  to public
  using (true);

drop policy if exists "Allow admins to insert material_preferences" on public.material_preferences;
create policy "Allow admins to insert material_preferences"
  on public.material_preferences for insert
  to authenticated
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

drop policy if exists "Allow admins to delete material_preferences" on public.material_preferences;
create policy "Allow admins to delete material_preferences"
  on public.material_preferences for delete
  to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));

-- Insert initial default options
insert into public.furniture_types (name)
values
  ('Sofa'),
  ('Bed'),
  ('Dining Table'),
  ('Wardrobe'),
  ('TV Unit'),
  ('Modular Kitchen'),
  ('Study Table'),
  ('Office Furniture'),
  ('Other')
on conflict (name) do nothing;

insert into public.material_preferences (name)
values
  ('Plywood'),
  ('MDF'),
  ('Solid Wood'),
  ('Laminate'),
  ('Veneer'),
  ('Not Sure')
on conflict (name) do nothing;

-- Products Policies
alter table public.products enable row level security;
drop policy if exists "Allow public to read products" on public.products;
create policy "Allow public to read products"
  on public.products for select
  to public
  using (true);

drop policy if exists "Allow admins to insert products" on public.products;
create policy "Allow admins to insert products"
  on public.products for insert
  to authenticated
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

drop policy if exists "Allow admins to update products" on public.products;
create policy "Allow admins to update products"
  on public.products for update
  to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));

drop policy if exists "Allow admins to delete products" on public.products;
create policy "Allow admins to delete products"
  on public.products for delete
  to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));

-- Seed default products
insert into public.products (name, category, description, price, image_url)
values
  ('Modern Luxury Sofa', 'Sofas', 'Premium contemporary sofa designed for elegant living spaces.', 'Custom Quote', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=80'),
  ('Premium Wooden Bed', 'Beds', 'Elegant wooden bed with a strong and timeless design.', 'Custom Quote', 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80'),
  ('Luxury Dining Table', 'Dining', 'Beautiful dining table crafted for modern Indian homes.', 'Custom Quote', 'https://images.unsplash.com/photo-1617104678098-de229db51175?auto=format&fit=crop&w=900&q=80'),
  ('Designer Wardrobe', 'Wardrobes', 'Smart storage with a premium modern appearance.', 'Custom Quote', 'https://images.unsplash.com/photo-1558997519-83ea9252edf8?auto=format&fit=crop&w=900&q=80'),
  ('Modern Coffee Table', 'Tables', 'Minimal coffee table designed for contemporary interiors.', 'Custom Quote', 'https://images.unsplash.com/photo-1532372320572-cda25653a26d?auto=format&fit=crop&w=900&q=80'),
  ('Premium Accent Chair', 'Chairs', 'Comfortable statement chair for living rooms and bedrooms.', 'Custom Quote', 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?auto=format&fit=crop&w=900&q=80')
on conflict do nothing;

-- Storage Policies
drop policy if exists "Allow authenticated uploads" on storage.objects;
create policy "Allow authenticated uploads"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'gavika-project-files');

drop policy if exists "Allow public viewing of project files" on storage.objects;
create policy "Allow public viewing of project files"
  on storage.objects for select
  to public
  using (bucket_id = 'gavika-project-files');

drop policy if exists "Allow authenticated updates" on storage.objects;
create policy "Allow authenticated updates"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'gavika-project-files');

drop policy if exists "Allow authenticated deletions" on storage.objects;
create policy "Allow authenticated deletions"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'gavika-project-files');

-- ==============================================================================
-- 5. RPC STORED PROCEDURES (Database Functions)
-- ==============================================================================

-- Procedure: Admin creates quotation
create or replace function public.create_quotation(
  p_request_id uuid,
  p_amount numeric,
  p_description text default null,
  p_validity_days integer default 15,
  p_drawing_name text default null,
  p_drawing_url text default null
)
returns public.quotations
language plpgsql
security definer
as $$
declare
  v_quotation public.quotations;
  v_quotation_number text;
begin
  v_quotation_number := 'QUO-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.quotations (
    request_id,
    quotation_number,
    amount,
    description,
    validity_days,
    drawing_name,
    drawing_url,
    status
  ) values (
    p_request_id,
    v_quotation_number,
    p_amount,
    p_description,
    p_validity_days,
    p_drawing_name,
    p_drawing_url,
    'Pending'
  )
  returning * into v_quotation;

  update public.custom_requests
  set status = 'Quotation Sent',
      updated_at = timezone('utc'::text, now())
  where id = p_request_id;

  return v_quotation;
end;
$$;

-- Procedure: Customer approves or rejects quotation
create or replace function public.respond_to_quotation(
  p_quotation_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
as $$
declare
  v_request_id uuid;
  v_project_status text;
begin
  if p_decision not in ('Approved', 'Rejected') then
    raise exception 'Invalid decision. Must be Approved or Rejected.';
  end if;

  select request_id into v_request_id
  from public.quotations
  where id = p_quotation_id;

  if v_request_id is null then
    raise exception 'Quotation not found.';
  end if;

  update public.quotations
  set status = p_decision,
      updated_at = timezone('utc'::text, now())
  where id = p_quotation_id;

  if p_decision = 'Approved' then
    v_project_status := 'Approved';
  else
    v_project_status := 'Quotation Rejected';
  end if;

  update public.custom_requests
  set status = v_project_status,
      updated_at = timezone('utc'::text, now())
  where id = v_request_id;
end;
$$;

-- Procedure: Customer converts approved quotation to an order
create or replace function public.create_order_from_quotation(
  p_quotation_id uuid
)
returns public.orders
language plpgsql
security definer
as $$
declare
  v_quotation public.quotations;
  v_request public.custom_requests;
  v_order public.orders;
  v_order_number text;
begin
  select * into v_quotation
  from public.quotations
  where id = p_quotation_id;

  if v_quotation.id is null then
    raise exception 'Quotation not found.';
  end if;

  select * into v_request
  from public.custom_requests
  where id = v_quotation.request_id;

  if v_request.id is null then
    raise exception 'Associated custom request not found.';
  end if;

  v_order_number := 'ORD-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.orders (
    order_number,
    user_id,
    request_id,
    quotation_id,
    amount,
    status,
    expected_delivery_date,
    delivery_address
  ) values (
    v_order_number,
    v_request.user_id,
    v_request.id,
    v_quotation.id,
    v_quotation.amount,
    'Confirmed',
    timezone('utc'::text, now()) + interval '14 days',
    v_request.delivery_location
  )
  returning * into v_order;

  update public.custom_requests
  set status = 'In Production',
      updated_at = timezone('utc'::text, now())
  where id = v_request.id;

  return v_order;
end;
$$;

-- Grant execution permissions
grant execute on function public.create_quotation to authenticated;
grant execute on function public.respond_to_quotation to authenticated;
grant execute on function public.create_order_from_quotation to authenticated;

-- ==============================================================================
-- 6. USER MANAGEMENT FUNCTIONS (ADMIN PORTAL)
-- ==============================================================================

-- Procedure: Get list of all registered users with activity & role
create or replace function public.get_admin_users_list()
returns table (
  id uuid,
  email text,
  full_name text,
  mobile text,
  is_admin boolean,
  created_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  total_requests bigint,
  total_orders bigint
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Unauthorized: Only administrators can view user management.';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(
      nullif(u.raw_user_meta_data->>'full_name', ''),
      (select cr.full_name from public.custom_requests cr where cr.user_id = u.id order by cr.created_at desc limit 1),
      split_part(u.email::text, '@', 1)
    )::text as full_name,
    coalesce(
      nullif(u.raw_user_meta_data->>'mobile', ''),
      u.phone::text,
      (select cr.mobile from public.custom_requests cr where cr.user_id = u.id order by cr.created_at desc limit 1),
      '-'
    )::text as mobile,
    exists (select 1 from public.admin_users au where au.user_id = u.id) as is_admin,
    u.created_at,
    u.last_sign_in_at,
    (select count(*) from public.custom_requests cr where cr.user_id = u.id)::bigint as total_requests,
    (select count(*) from public.orders o where o.user_id = u.id)::bigint as total_orders
  from auth.users u
  order by u.created_at desc;
end;
$$;

-- Procedure: Grant or revoke admin role for a user
create or replace function public.set_user_admin_role(p_user_id uuid, p_make_admin boolean)
returns boolean
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  if p_make_admin then
    insert into public.admin_users (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;
  else
    if p_user_id = auth.uid() and (select count(*) from public.admin_users) <= 1 then
      raise exception 'Cannot remove the last remaining administrator.';
    end if;
    delete from public.admin_users where user_id = p_user_id;
  end if;

  return true;
end;
$$;

-- Procedure: Add admin user by email address
create or replace function public.add_admin_by_email(p_email text)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_target_user_id uuid;
  v_user_email text;
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  select id, email into v_target_user_id, v_user_email
  from auth.users
  where lower(email) = lower(trim(p_email));

  if v_target_user_id is null then
    return json_build_object('success', false, 'message', 'No registered user found with that email address.');
  end if;

  insert into public.admin_users (user_id)
  values (v_target_user_id)
  on conflict (user_id) do nothing;

  return json_build_object('success', true, 'message', 'Admin privileges granted successfully.', 'user_id', v_target_user_id);
end;
$$;

-- Procedure: Delete a user by admin
create or replace function public.delete_user_by_admin(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Unauthorized';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot delete your own administrative account.';
  end if;

  delete from auth.users where id = p_user_id;
  return true;
end;
$$;

-- Procedure: Delete a custom request by admin
create or replace function public.delete_custom_request_by_admin(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Unauthorized: Only administrators can delete customer requests.';
  end if;

  -- Delete associated orders and quotations first
  delete from public.orders where request_id = p_request_id;
  delete from public.quotations where request_id = p_request_id;
  delete from public.custom_requests where id = p_request_id;

  return true;
end;
$$;

-- Grant permissions for user management functions
grant execute on function public.get_admin_users_list to authenticated;
grant execute on function public.set_user_admin_role to authenticated;
grant execute on function public.add_admin_by_email to authenticated;
grant execute on function public.delete_user_by_admin to authenticated;
grant execute on function public.delete_custom_request_by_admin to authenticated;
