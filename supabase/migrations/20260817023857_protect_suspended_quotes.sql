create or replace function private.protect_suspended_quote()
returns trigger
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
begin
  if old.status = 'suspended' and new.status <> 'suspended' and not private.is_hrx_admin() then
    raise exception 'quote_suspended';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_suspended_quote_trigger on public.quote_drafts;
create trigger protect_suspended_quote_trigger
before update on public.quote_drafts
for each row execute function private.protect_suspended_quote();

revoke all on function private.protect_suspended_quote() from public, anon, authenticated;
