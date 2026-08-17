create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  company text,
  email text,
  phone text,
  document text,
  notes text,
  source text not null default 'admin',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  last_quote_at timestamptz,
  constraint clients_contact_check check (
    nullif(btrim(coalesce(email, '')), '') is not null
    or nullif(btrim(coalesce(phone, '')), '') is not null
  )
);

create unique index if not exists clients_email_lower_uidx
  on public.clients (lower(email))
  where email is not null and btrim(email) <> '';
create index if not exists clients_name_idx on public.clients (name);
create index if not exists clients_last_quote_idx on public.clients (last_quote_at desc nulls last);

alter table public.clients enable row level security;
drop policy if exists "admins manage clients" on public.clients;
create policy "admins manage clients" on public.clients
  for all to authenticated
  using (private.is_hrx_admin())
  with check (private.is_hrx_admin());

grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;

alter table public.quote_requests
  add column if not exists client_id uuid references public.clients(id) on delete set null;
create index if not exists quote_requests_client_id_idx on public.quote_requests(client_id);

alter table public.quote_drafts
  add column if not exists suspension_reason text,
  add column if not exists suspension_note text,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references auth.users(id) on delete set null,
  add column if not exists status_before_suspension text;

create table if not exists public.quote_suspensions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.quote_requests(id) on delete cascade,
  draft_id uuid references public.quote_drafts(id) on delete cascade,
  reason text not null,
  note text,
  status_before text not null,
  suspended_at timestamptz not null default now(),
  suspended_by uuid references auth.users(id) on delete set null,
  resumed_at timestamptz,
  resumed_by uuid references auth.users(id) on delete set null
);
create index if not exists quote_suspensions_request_idx on public.quote_suspensions(request_id, suspended_at desc);
create unique index if not exists quote_suspensions_active_uidx on public.quote_suspensions(request_id) where resumed_at is null;

alter table public.quote_suspensions enable row level security;
drop policy if exists "admins manage quote suspensions" on public.quote_suspensions;
create policy "admins manage quote suspensions" on public.quote_suspensions
  for all to authenticated
  using (private.is_hrx_admin())
  with check (private.is_hrx_admin());

grant select, insert, update, delete on public.quote_suspensions to authenticated;
grant all on public.quote_suspensions to service_role;

insert into public.clients (name, company, email, phone, source, last_quote_at)
select q.name, q.company, lower(q.email), q.phone, 'website_backfill', q.created_at
from (
  select distinct on (lower(email)) name, company, email, phone, created_at
  from public.quote_requests
  where nullif(btrim(email), '') is not null
  order by lower(email), created_at desc
) q
on conflict do nothing;

update public.quote_requests qr
set client_id = c.id
from public.clients c
where qr.client_id is null
  and nullif(btrim(qr.email), '') is not null
  and lower(c.email) = lower(qr.email);

update public.clients c
set last_quote_at = q.last_quote_at,
    updated_at = now()
from (
  select client_id, max(created_at) as last_quote_at
  from public.quote_requests
  where client_id is not null
  group by client_id
) q
where c.id = q.client_id;
