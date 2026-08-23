-- Hardening/performance da Fase 1 do Financeiro.

create index if not exists financial_accounts_created_by_idx
  on public.financial_accounts(created_by)
  where created_by is not null;
create index if not exists financial_entries_created_by_idx
  on public.financial_entries(created_by)
  where created_by is not null;
create index if not exists financial_entries_quote_version_id_idx
  on public.financial_entries(quote_version_id)
  where quote_version_id is not null;
create index if not exists financial_settlements_created_by_idx
  on public.financial_settlements(created_by)
  where created_by is not null;
create index if not exists financial_settlements_receipt_document_id_idx
  on public.financial_settlements(receipt_document_id)
  where receipt_document_id is not null;

drop policy if exists financial_accounts_aal2 on public.financial_accounts;
create policy financial_accounts_aal2 on public.financial_accounts
  as restrictive for all to authenticated
  using (((select auth.jwt())->>'aal') = 'aal2')
  with check (((select auth.jwt())->>'aal') = 'aal2');

drop policy if exists financial_entries_aal2 on public.financial_entries;
create policy financial_entries_aal2 on public.financial_entries
  as restrictive for all to authenticated
  using (((select auth.jwt())->>'aal') = 'aal2')
  with check (((select auth.jwt())->>'aal') = 'aal2');

drop policy if exists financial_settlements_aal2 on public.financial_settlements;
create policy financial_settlements_aal2 on public.financial_settlements
  as restrictive for all to authenticated
  using (((select auth.jwt())->>'aal') = 'aal2')
  with check (((select auth.jwt())->>'aal') = 'aal2');
