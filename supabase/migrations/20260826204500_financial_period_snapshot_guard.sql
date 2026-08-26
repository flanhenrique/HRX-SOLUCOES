create or replace function public.hrx_fill_financial_period_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  computed_snapshot jsonb;
begin
  if new.status = 'closed'
     and (tg_op = 'INSERT' or old.status is distinct from 'closed') then
    select jsonb_build_object(
      'receivable_expected', coalesce(sum(gross_amount) filter (where entry_type = 'receivable' and status <> 'cancelled'), 0),
      'receivable_paid', coalesce(sum(paid_amount) filter (where entry_type = 'receivable' and status <> 'cancelled'), 0),
      'payable_expected', coalesce(sum(gross_amount) filter (where entry_type = 'payable' and status <> 'cancelled'), 0),
      'payable_paid', coalesce(sum(paid_amount) filter (where entry_type = 'payable' and status <> 'cancelled'), 0),
      'entry_count', count(*) filter (where status <> 'cancelled'),
      'generated_at', now()
    )
    into computed_snapshot
    from public.financial_entries
    where competence_date >= new.competence_month
      and competence_date < new.competence_month + interval '1 month';

    new.snapshot := computed_snapshot;
  end if;

  return new;
end;
$$;

drop trigger if exists financial_period_snapshot_guard on public.financial_periods;
create trigger financial_period_snapshot_guard
before insert or update of status on public.financial_periods
for each row execute function public.hrx_fill_financial_period_snapshot();

revoke all on function public.hrx_fill_financial_period_snapshot() from public, anon, authenticated;
grant execute on function public.hrx_fill_financial_period_snapshot() to service_role;

comment on function public.hrx_fill_financial_period_snapshot() is
  'Preserva snapshot financeiro ao fechar uma competência, inclusive em fechamentos feitos pela Edge Function.';
