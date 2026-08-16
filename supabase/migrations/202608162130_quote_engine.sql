create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'reviewer')),
  created_at timestamptz not null default now()
);

create or replace function public.is_hrx_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid()
  );
$$;

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text not null,
  company text,
  reason text not null,
  interests text[] not null default '{}',
  request_text text not null,
  desired_deadline text,
  preferred_contact text not null check (preferred_contact in ('whatsapp', 'email')),
  privacy_consent boolean not null,
  marketing_consent boolean not null default false,
  consent_at timestamptz not null default now(),
  consent_version text not null default '2026-08-16',
  source text not null default 'website',
  status text not null default 'received' check (status in ('received','interpreting','awaiting_review','needs_scope','approved','contacted','proposal_sent','won','lost'))
);

create table if not exists public.quote_interpretations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.quote_requests(id) on delete cascade,
  created_at timestamptz not null default now(),
  summary text not null,
  suggested_service_keys text[] not null default '{}',
  confidence integer not null default 0 check (confidence between 0 and 100),
  missing_information text[] not null default '{}',
  interpretation_method text not null default 'rules',
  raw_result jsonb not null default '{}'::jsonb
);

create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  service_key text not null unique,
  service_name text not null,
  category text not null,
  base_amount numeric(12,2) not null check (base_amount >= 0),
  minimum_amount numeric(12,2) not null check (minimum_amount >= 0),
  fiscal_code text,
  invoice_description text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_drafts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.quote_requests(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  base_amount numeric(12,2) not null default 0,
  complexity_multiplier numeric(6,3) not null default 1,
  urgency_multiplier numeric(6,3) not null default 1,
  pre_discount_amount numeric(12,2) not null default 0,
  discount_percent integer not null default 0 check (discount_percent in (0,5,10,15,20)),
  discount_status text not null default 'green' check (discount_status in ('green','yellow','red','purple')),
  discount_amount numeric(12,2) not null default 0,
  final_amount numeric(12,2) not null default 0,
  payment_provider text not null default 'none' check (payment_provider in ('none','nubank','mercadopago')),
  installments integer not null default 1 check (installments between 1 and 24),
  boleto_fee_per_installment numeric(12,2) not null default 0,
  payment_fee_total numeric(12,2) not null default 0,
  retentions jsonb not null default '{"iss":0,"irrf":0,"pis":0,"cofins":0,"csll":0,"inss":0}'::jsonb,
  retention_total numeric(7,4) not null default 0,
  estimated_net numeric(12,2) not null default 0,
  fiscal_review_required boolean not null default false,
  notes text,
  status text not null default 'awaiting_review' check (status in ('awaiting_review','needs_scope','approved','rejected')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.quote_drafts(id) on delete cascade,
  service_key text not null,
  service_name text not null,
  quantity numeric(10,2) not null default 1,
  unit_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  source text not null default 'engine' check (source in ('engine','manual')),
  sort_order integer not null default 0
);

create table if not exists public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.quote_requests(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp')),
  template_key text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','cancelled')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.quote_audit_log (
  id bigint generated by default as identity primary key,
  request_id uuid references public.quote_requests(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.quote_requests enable row level security;
alter table public.quote_interpretations enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.quote_drafts enable row level security;
alter table public.quote_items enable row level security;
alter table public.outbound_messages enable row level security;
alter table public.quote_audit_log enable row level security;

create policy "admins read admin users" on public.admin_users for select to authenticated using (public.is_hrx_admin());
create policy "admins manage requests" on public.quote_requests for all to authenticated using (public.is_hrx_admin()) with check (public.is_hrx_admin());
create policy "admins manage interpretations" on public.quote_interpretations for all to authenticated using (public.is_hrx_admin()) with check (public.is_hrx_admin());
create policy "admins manage pricing" on public.pricing_rules for all to authenticated using (public.is_hrx_admin()) with check (public.is_hrx_admin());
create policy "admins manage drafts" on public.quote_drafts for all to authenticated using (public.is_hrx_admin()) with check (public.is_hrx_admin());
create policy "admins manage items" on public.quote_items for all to authenticated using (public.is_hrx_admin()) with check (public.is_hrx_admin());
create policy "admins manage outbound messages" on public.outbound_messages for all to authenticated using (public.is_hrx_admin()) with check (public.is_hrx_admin());
create policy "admins read audit log" on public.quote_audit_log for select to authenticated using (public.is_hrx_admin());

create index if not exists quote_requests_status_created_idx on public.quote_requests(status, created_at desc);
create index if not exists quote_audit_request_idx on public.quote_audit_log(request_id, created_at desc);
create index if not exists outbound_messages_status_idx on public.outbound_messages(status, created_at);
