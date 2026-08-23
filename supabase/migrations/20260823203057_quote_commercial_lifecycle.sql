-- Evolui o orçamento existente sem criar um cadastro comercial paralelo.
-- O módulo financeiro não é movimentado nesta migração.

create sequence if not exists public.hrx_quote_number_seq;

create or replace function public.hrx_next_quote_number()
returns text
language sql
volatile
set search_path = public
as $$
  select 'HRX-ORC-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.hrx_quote_number_seq')::text, 6, '0');
$$;

alter table public.quote_requests
  add column if not exists proposal_number text;

with numbered as (
  select id, row_number() over (order by created_at, id) as number
  from public.quote_requests
  where proposal_number is null
)
update public.quote_requests as request
set proposal_number = 'HRX-ORC-' || to_char(request.created_at, 'YYYY') || '-' || lpad(numbered.number::text, 6, '0')
from numbered
where numbered.id = request.id;

select setval(
  'public.hrx_quote_number_seq',
  greatest((select count(*) from public.quote_requests), 1),
  true
);

alter table public.quote_requests
  alter column proposal_number set default public.hrx_next_quote_number(),
  alter column proposal_number set not null;

create unique index if not exists quote_requests_proposal_number_uidx
  on public.quote_requests(proposal_number);

alter table public.quote_drafts
  add column if not exists commercial_status text not null default 'draft',
  add column if not exists proposal_title text,
  add column if not exists project_service text,
  add column if not exists proposal_description text,
  add column if not exists customer_notes text,
  add column if not exists responsible_by uuid references auth.users(id) on delete set null,
  add column if not exists validity_days integer not null default 15,
  add column if not exists valid_until date,
  add column if not exists tax_percent numeric(7,4) not null default 0,
  add column if not exists tax_amount numeric(14,2) not null default 0,
  add column if not exists custom_final_amount numeric(14,2),
  add column if not exists custom_adjustment_reason text,
  add column if not exists custom_adjustment_by uuid references auth.users(id) on delete set null,
  add column if not exists custom_adjustment_at timestamptz,
  add column if not exists payment_mode text not null default 'cash',
  add column if not exists installment_interval_days integer not null default 30,
  add column if not exists first_due_date date,
  add column if not exists current_version integer not null default 0,
  add column if not exists approved_version integer,
  add column if not exists approval_channel text,
  add column if not exists approval_note text;

alter table public.quote_drafts drop constraint if exists quote_drafts_commercial_status_check;
alter table public.quote_drafts add constraint quote_drafts_commercial_status_check
  check (commercial_status in ('draft','reviewed','sent','negotiating','approved','invoiced','received','lost','cancelled'));
alter table public.quote_drafts drop constraint if exists quote_drafts_validity_days_check;
alter table public.quote_drafts add constraint quote_drafts_validity_days_check
  check (validity_days between 1 and 365);
alter table public.quote_drafts drop constraint if exists quote_drafts_tax_percent_check;
alter table public.quote_drafts add constraint quote_drafts_tax_percent_check
  check (tax_percent >= 0 and tax_percent < 100);
alter table public.quote_drafts drop constraint if exists quote_drafts_payment_mode_check;
alter table public.quote_drafts add constraint quote_drafts_payment_mode_check
  check (payment_mode in ('cash','installments'));
alter table public.quote_drafts drop constraint if exists quote_drafts_installment_interval_check;
alter table public.quote_drafts add constraint quote_drafts_installment_interval_check
  check (installment_interval_days between 1 and 365);
alter table public.quote_drafts drop constraint if exists quote_drafts_version_check;
alter table public.quote_drafts add constraint quote_drafts_version_check
  check (current_version >= 0 and (approved_version is null or approved_version > 0));

update public.quote_drafts
set valid_until = coalesce(valid_until, (created_at at time zone 'UTC')::date + validity_days)
where valid_until is null;

alter table public.quote_items
  add column if not exists item_description text,
  add column if not exists unit_label text not null default 'un.';

create table if not exists public.quote_payment_installments (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.quote_drafts(id) on delete cascade,
  installment_number integer not null,
  amount numeric(14,2) not null check (amount >= 0),
  due_date date not null,
  status text not null default 'planned' check (status in ('planned','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(draft_id, installment_number)
);

create table if not exists public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.quote_requests(id) on delete restrict,
  draft_id uuid not null references public.quote_drafts(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  commercial_status text not null default 'reviewed'
    check (commercial_status in ('reviewed','sent','negotiating','approved','invoiced','received','lost','cancelled')),
  snapshot jsonb not null,
  pdf_object_path text,
  document_id uuid,
  checksum_sha256 text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(request_id, version_number)
);

alter table public.hrx_documents
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists quote_request_id uuid references public.quote_requests(id) on delete set null,
  add column if not exists quote_version_id uuid references public.quote_versions(id) on delete set null;

alter table public.quote_versions drop constraint if exists quote_versions_document_id_fkey;
alter table public.quote_versions add constraint quote_versions_document_id_fkey
  foreign key (document_id) references public.hrx_documents(id) on delete set null;

create index if not exists quote_installments_draft_due_idx
  on public.quote_payment_installments(draft_id, due_date);
create index if not exists quote_versions_request_created_idx
  on public.quote_versions(request_id, version_number desc);
create index if not exists hrx_documents_quote_request_idx
  on public.hrx_documents(quote_request_id, created_at desc)
  where quote_request_id is not null;

alter table public.quote_payment_installments enable row level security;
alter table public.quote_versions enable row level security;

drop policy if exists quote_payment_installments_admin on public.quote_payment_installments;
create policy quote_payment_installments_admin on public.quote_payment_installments
  for all to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
drop policy if exists quote_payment_installments_aal2 on public.quote_payment_installments;
create policy quote_payment_installments_aal2 on public.quote_payment_installments
  as restrictive for all to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');

drop policy if exists quote_versions_admin on public.quote_versions;
create policy quote_versions_admin on public.quote_versions
  for all to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
drop policy if exists quote_versions_aal2 on public.quote_versions;
create policy quote_versions_aal2 on public.quote_versions
  as restrictive for all to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');

grant select, insert, update, delete on public.quote_payment_installments to authenticated;
grant select, insert, update on public.quote_versions to authenticated;
revoke all on function public.hrx_next_quote_number() from public, anon;
grant execute on function public.hrx_next_quote_number() to authenticated, service_role;

comment on column public.quote_requests.proposal_number is 'Identificador comercial oficial, estável e referenciável por documentos e financeiro futuro.';
comment on table public.quote_payment_installments is 'Cronograma previsto; não representa contas recebidas nem baixa financeira.';
comment on table public.quote_versions is 'Snapshot imutável de cada versão oficial gerada da proposta.';
