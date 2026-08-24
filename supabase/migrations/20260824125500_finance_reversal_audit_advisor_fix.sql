-- Financeiro HRX - Tópico 2A: fechamento dos avisos de performance pós-auditoria.

create index if not exists financial_audit_actor_user_idx
  on public.financial_audit_log(actor_user_id)
  where actor_user_id is not null;

create index if not exists financial_settlements_reversed_by_idx
  on public.financial_settlements(reversed_by)
  where reversed_by is not null;

-- Mantém AAL2 como policy restritiva, avaliando auth.jwt() uma única vez por statement.
drop policy if exists financial_audit_log_aal2 on public.financial_audit_log;
create policy financial_audit_log_aal2 on public.financial_audit_log
  as restrictive for select to authenticated
  using (((select auth.jwt()) ->> 'aal') = 'aal2');
