-- ==============================================================================
-- GAVIKA FURNITECH - RAZORPAY PAYMENT INTEGRATION MIGRATION
-- Run this script in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ==============================================================================

-- 1. ORDERS TABLE UPDATES
-- Adds payment tracking columns to public.orders without modifying existing rows
alter table public.orders add column if not exists razorpay_order_id text;
alter table public.orders add column if not exists razorpay_payment_id text;
alter table public.orders add column if not exists payment_status text default 'pending';
alter table public.orders add column if not exists payment_method text;

-- Performance indexes for webhook lookups
create index if not exists idx_orders_razorpay_order_id on public.orders(razorpay_order_id);
create index if not exists idx_orders_razorpay_payment_id on public.orders(razorpay_payment_id);
create index if not exists idx_orders_payment_status on public.orders(payment_status);


-- 2. PAYMENTS TABLE
-- Full transaction audit table for capturing every Razorpay charge, failure, & refund
create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete set null,
  razorpay_payment_id text not null unique,
  razorpay_order_id text,
  razorpay_signature text,
  amount numeric(12, 2) not null,
  currency text default 'INR',
  status text not null, -- 'captured', 'failed', 'refunded'
  method text,          -- 'card', 'upi', 'netbanking', 'wallet'
  customer_email text,
  customer_phone text,
  error_code text,
  error_description text,
  raw_response jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_payments_razorpay_payment_id on public.payments(razorpay_payment_id);
create index if not exists idx_payments_razorpay_order_id on public.payments(razorpay_order_id);
create index if not exists idx_payments_order_id on public.payments(order_id);


-- 3. WEBHOOK EVENTS TABLE (Idempotency & Replay Protection)
-- Prevents duplicate payment processing by logging Razorpay event IDs
create table if not exists public.razorpay_webhook_events (
  id uuid default gen_random_uuid() primary key,
  event_id text not null unique,
  event_type text not null,
  account_id text,
  payload jsonb not null,
  processed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_razorpay_webhook_events_event_id on public.razorpay_webhook_events(event_id);


-- 4. ROW LEVEL SECURITY (RLS) POLICIES
alter table public.payments enable row level security;
alter table public.razorpay_webhook_events enable row level security;

-- PAYMENTS POLICIES:
-- Customers can view only their own payment records (or Admins can view all)
drop policy if exists "Users and Admins can view relevant payments" on public.payments;
create policy "Users and Admins can view relevant payments"
  on public.payments for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
      and o.user_id = auth.uid()
    ) or exists (
      select 1 from public.admin_users au
      where au.user_id = auth.uid()
    )
  );

-- Backend / Service role or authorized backend inserts
drop policy if exists "Allow backend insert on payments" on public.payments;
create policy "Allow backend insert on payments"
  on public.payments for insert
  to public
  with check (true);

drop policy if exists "Allow backend update on payments" on public.payments;
create policy "Allow backend update on payments"
  on public.payments for update
  to public
  using (true);

-- WEBHOOK EVENTS POLICIES:
-- Webhook events should never be read by standard users; only Admins can view for audit
drop policy if exists "Admins can view webhook events" on public.razorpay_webhook_events;
create policy "Admins can view webhook events"
  on public.razorpay_webhook_events for select
  to authenticated
  using (
    exists (select 1 from public.admin_users where user_id = auth.uid())
  );

-- Allow backend to record and update webhook events
drop policy if exists "Allow backend insert on webhook events" on public.razorpay_webhook_events;
create policy "Allow backend insert on webhook events"
  on public.razorpay_webhook_events for insert
  to public
  with check (true);

drop policy if exists "Allow backend update on webhook events" on public.razorpay_webhook_events;
create policy "Allow backend update on webhook events"
  on public.razorpay_webhook_events for update
  to public
  using (true);
