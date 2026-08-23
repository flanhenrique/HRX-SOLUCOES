-- Financeiro HRX - Fase 1: faturamento e contas a receber vinculados às propostas.
-- Evolui o ledger existente, sem criar um financeiro paralelo.

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  constraint financial_accounts_name_length check (char_length(trim(name)) between 2 and 120)
);

create unique index if not exists financial_accounts_name_uidx
  on public.financial_accounts(lower(trim(name)));
create index if not exists financial_accounts_active_sort_idx
  on public.financial_accounts(active, sort_order, name);

alter table public.financial_entries
  add column if not exists source text not null default 'manual',
  add column if not exists quote_version_id uuid references public.quote_versions(id) on delete set null,
  add column if not exists quote_installment_id uuid references public.quote_payment_installments(id) on delete set null,
  add column if not exists installment_number integer,
  add column if not exists invoice_number text,
  add column if not exists invoice_issued_at date,
  add column if not exists tax_reserve_amount numeric(14,2) not null default 0,
  add column if not exists payment_account_id uuid references public.financial_accounts(id) on delete set null,
  add column if not exists payment_method text,
  add column if not exists receipt_document_id uuid references public.hrx_documents(id) on delete set null,
  add column if not exists receipt_object_path text;

alter table public.financial_entries drop constraint if exists financial_entries_source_check;
alter table public.financial_entries add constraint financial_entries_source_check
  check (source in ('manual','quote'));
alter table public.financial_entries drop constraint if exists financial_entries_installment_number_check;
alter table public.financial_entries add constraint financial_entries_installment_number_check
  check (installment_number is null or installment_number > 0);
alter table public.financial_entries drop constraint if exists financial_entries_tax_reserve_check;
alter table public.financial_entries add constraint financial_entries_tax_reserve_check
  check (tax_reserve_amount >= 0 and tax_reserve_amount <= gross_amount);

create unique index if not exists financial_entries_quote_installment_uidx
  on public.financial_entries(quote_request_id, installment_number)
  where entry_type = 'receivable' and quote_request_id is not null and installment_number is not null;
create unique index if not exists financial_entries_quote_installment_source_uidx
  on public.financial_entries(quote_installment_id)
  where quote_installment_id is not null;
create index if not exists financial_entries_invoice_idx
  on public.financial_entries(invoice_number, invoice_issued_at)
  where invoice_number is not null;
create index if not exists financial_entries_account_idx
  on public.financial_entries(payment_account_id, paid_at desc)
  where payment_account_id is not null;
create index if not exists financial_entries_open_receivables_due_idx
  on public.financial_entries(due_date, status)
  where entry_type = 'receivable' and status in ('open','partial','overdue');

alter table public.financial_accounts enable row level security;

drop policy if exists financial_accounts_admin on public.financial_accounts;
create policy financial_accounts_admin on public.financial_accounts
  for all to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
drop policy if exists financial_accounts_aal2 on public.financial_accounts;
create policy financial_accounts_aal2 on public.financial_accounts
  as restrictive for all to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');

drop policy if exists financial_entries_aal2 on public.financial_entries;
create policy financial_entries_aal2 on public.financial_entries
  as restrictive for all to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');

grant select on public.financial_accounts to authenticated;
revoke insert, update, delete on public.financial_accounts from authenticated;
revoke insert, update, delete on public.financial_entries from authenticated;
grant select on public.financial_entries to authenticated;

comment on table public.financial_accounts is 'Contas configuráveis usadas para registrar a liquidação de recebíveis e pagamentos HRX.';
comment on column public.financial_entries.source is 'Origem do lançamento: manual ou gerado a partir de proposta aprovada/faturada.';
comment on column public.financial_entries.invoice_number is 'Identificador da nota/fatura informado pelo administrador; o HRX não emite documento fiscal nesta fase.';
comment on column public.financial_entries.tax_reserve_amount is 'Parcela da reserva tributária associada ao recebível, derivada da configuração fiscal da proposta.';
comment on column public.financial_entries.receipt_document_id is 'Comprovante armazenado na Central de Documentos, quando informado.';
