create table if not exists public.personal_financial_entries (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open' check (status in ('open','paid','cancelled')),
  counterparty_name text not null check (char_length(trim(counterparty_name)) between 2 and 160),
  description text not null check (char_length(trim(description)) between 2 and 240),
  category text not null check (char_length(trim(category)) between 2 and 120),
  gross_amount numeric(14,2) not null check (gross_amount > 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0 and paid_amount <= gross_amount),
  due_date date not null,
  competence_date date,
  reference_number text,
  notes text,
  paid_at timestamptz,
  payment_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_financial_entries_paid_state_check check (
    (status = 'paid' and paid_amount = gross_amount and paid_at is not null)
    or (status in ('open','cancelled') and paid_amount = 0)
  )
);

create index if not exists personal_financial_entries_owner_status_due_idx
  on public.personal_financial_entries(owner_user_id, status, due_date);

alter table public.personal_financial_entries enable row level security;

revoke all on table public.personal_financial_entries from anon;
revoke all on table public.personal_financial_entries from authenticated;
grant select, insert, update on table public.personal_financial_entries to authenticated;

create policy "personal_finance_owner_aal2_select"
  on public.personal_financial_entries
  for select
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
  );

create policy "personal_finance_owner_aal2_insert"
  on public.personal_financial_entries
  for insert
  to authenticated
  with check (
    owner_user_id = (select auth.uid())
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
  );

create policy "personal_finance_owner_aal2_update"
  on public.personal_financial_entries
  for update
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
  )
  with check (
    owner_user_id = (select auth.uid())
    and ((select auth.jwt()) ->> 'aal') = 'aal2'
  );
