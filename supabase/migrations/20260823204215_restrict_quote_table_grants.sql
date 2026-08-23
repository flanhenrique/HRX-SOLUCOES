-- Versões oficiais são geridas exclusivamente pela Edge Function administrativa.
-- O status e o vínculo documental podem evoluir; o snapshot comercial não.

revoke all privileges on public.quote_payment_installments from authenticated;
revoke all privileges on public.quote_versions from authenticated;
grant select on public.quote_payment_installments to authenticated;
grant select on public.quote_versions to authenticated;

create or replace function public.hrx_protect_quote_version_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.request_id is distinct from old.request_id
    or new.draft_id is distinct from old.draft_id
    or new.version_number is distinct from old.version_number
    or new.snapshot is distinct from old.snapshot
    or new.pdf_object_path is distinct from old.pdf_object_path
    or new.checksum_sha256 is distinct from old.checksum_sha256
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'quote_version_snapshot_is_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists quote_versions_protect_snapshot on public.quote_versions;
create trigger quote_versions_protect_snapshot
before update on public.quote_versions
for each row execute function public.hrx_protect_quote_version_snapshot();

revoke all on function public.hrx_protect_quote_version_snapshot() from public, anon, authenticated;
grant execute on function public.hrx_protect_quote_version_snapshot() to service_role;

comment on function public.hrx_protect_quote_version_snapshot() is
  'Impede alteração silenciosa do conteúdo, identidade e PDF de uma versão oficial.';
