create table if not exists public.financial_periods (
  competence_month date primary key,
  status text not null default 'open' check (status in ('open','closed')),
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  reopened_at timestamptz,
  reopened_by uuid references auth.users(id) on delete set null,
  reopen_reason text,
  updated_at timestamptz not null default now(),
  constraint financial_period_month_start check (competence_month = date_trunc('month', competence_month)::date),
  constraint financial_period_reopen_reason check (reopen_reason is null or char_length(trim(reopen_reason)) >= 5)
);

alter table public.financial_periods
  add column if not exists reopen_reason text;

alter table public.financial_periods
  drop constraint if exists financial_period_reopen_reason;
alter table public.financial_periods
  add constraint financial_period_reopen_reason
  check (reopen_reason is null or char_length(trim(reopen_reason)) >= 5);

alter table public.financial_entries
  add column if not exists entry_kind text not null default 'one_time',
  add column if not exists installment_total integer,
  add column if not exists recurrence_key uuid;

alter table public.financial_entries drop constraint if exists financial_entries_kind_check;
alter table public.financial_entries add constraint financial_entries_kind_check
  check (entry_kind in ('one_time','installment','recurrence_occurrence'));
alter table public.financial_entries drop constraint if exists financial_entries_installment_total_check;
alter table public.financial_entries add constraint financial_entries_installment_total_check
  check (installment_total is null or installment_total >= 2);

create index if not exists financial_entries_competence_idx
  on public.financial_entries(competence_date, entry_type, status);
create index if not exists financial_entries_recurrence_idx
  on public.financial_entries(recurrence_key, competence_date)
  where recurrence_key is not null;

update public.financial_entries e
set competence_date = date_trunc('month', e.due_date)::date,
    entry_kind = case when totals.installment_total > 1 then 'installment' else 'one_time' end,
    installment_total = case when totals.installment_total > 1 then totals.installment_total else null end
from (
  select quote_request_id, count(*)::integer as installment_total
  from public.financial_entries
  where source = 'quote' and quote_request_id is not null and installment_number is not null
  group by quote_request_id
) totals
where e.source = 'quote'
  and e.quote_request_id = totals.quote_request_id
  and e.installment_number is not null;

alter table public.financial_periods enable row level security;
revoke all on public.financial_periods from public, anon, authenticated;
grant select, insert, update on public.financial_periods to service_role;

create or replace function public.hrx_block_closed_financial_period()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  old_month date;
  new_month date;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.competence_date is not null then
    old_month := date_trunc('month', old.competence_date)::date;
    if exists (
      select 1 from public.financial_periods
      where competence_month = old_month and status = 'closed'
    ) then
      raise exception 'financial_period_closed';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.competence_date is not null then
    new_month := date_trunc('month', new.competence_date)::date;
    if exists (
      select 1 from public.financial_periods
      where competence_month = new_month and status = 'closed'
    ) then
      raise exception 'financial_period_closed';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists financial_entries_closed_period_guard on public.financial_entries;
create trigger financial_entries_closed_period_guard
before update or delete on public.financial_entries
for each row execute function public.hrx_block_closed_financial_period();

revoke all on function public.hrx_block_closed_financial_period() from public, anon, authenticated;
grant execute on function public.hrx_block_closed_financial_period() to service_role;

comment on table public.financial_periods is 'Estado de fechamento mensal do ledger financeiro corporativo HRX.';
comment on column public.financial_entries.entry_kind is 'Natureza operacional: único, parcela ou ocorrência recorrente.';
