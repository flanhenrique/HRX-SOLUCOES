-- Índices de cobertura para os novos vínculos comerciais.
create index if not exists hrx_documents_client_id_idx on public.hrx_documents(client_id) where client_id is not null;
create index if not exists hrx_documents_quote_version_id_idx on public.hrx_documents(quote_version_id) where quote_version_id is not null;
create index if not exists quote_drafts_responsible_by_idx on public.quote_drafts(responsible_by) where responsible_by is not null;
create index if not exists quote_drafts_custom_adjustment_by_idx on public.quote_drafts(custom_adjustment_by) where custom_adjustment_by is not null;
create index if not exists quote_versions_draft_id_idx on public.quote_versions(draft_id);
create index if not exists quote_versions_document_id_idx on public.quote_versions(document_id) where document_id is not null;
create index if not exists quote_versions_created_by_idx on public.quote_versions(created_by) where created_by is not null;

-- Mantém a regra MFA como restritiva e avalia o JWT uma vez por consulta.
drop policy if exists quote_payment_installments_aal2 on public.quote_payment_installments;
create policy quote_payment_installments_aal2 on public.quote_payment_installments
  as restrictive for all to authenticated
  using (coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2')
  with check (coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2');

drop policy if exists quote_versions_aal2 on public.quote_versions;
create policy quote_versions_aal2 on public.quote_versions
  as restrictive for all to authenticated
  using (coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2')
  with check (coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2');
