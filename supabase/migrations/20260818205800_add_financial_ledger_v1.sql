create table public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  entry_type text not null check (entry_type in ('receivable','payable')),
  status text not null default 'open' check (status in ('open','partial','paid','cancelled','overdue')),
  description text not null,
  client_id uuid references public.clients(id) on delete set null,
  quote_request_id uuid references public.quote_requests(id) on delete set null,
  gross_amount numeric(14,2) not null check (gross_amount >= 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  due_date date not null,
  competence_date date,
  paid_at timestamptz,
  category text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  constraint financial_entries_paid_not_above_gross check (paid_amount <= gross_amount)
);

create index financial_entries_due_date_idx on public.financial_entries(due_date);
create index financial_entries_status_idx on public.financial_entries(status);
create index financial_entries_client_id_idx on public.financial_entries(client_id);
create index financial_entries_quote_request_id_idx on public.financial_entries(quote_request_id);

alter table public.financial_entries enable row level security;

create policy "admins manage financial entries"
on public.financial_entries
for all
to authenticated
using (private.is_hrx_admin())
with check (private.is_hrx_admin());

grant select, insert, update, delete on public.financial_entries to authenticated;

comment on table public.financial_entries is 'HRX financial ledger: actual receivables and payables. Quote approvals are not revenue until represented here.';
comment on column public.financial_entries.gross_amount is 'Contracted ledger amount, not quote pipeline.';
comment on column public.financial_entries.paid_amount is 'Cash actually settled against this entry.';
