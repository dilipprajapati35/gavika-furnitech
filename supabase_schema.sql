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
  using (auth.uid() = user_id);

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
