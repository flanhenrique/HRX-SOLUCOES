create or replace function public.hrx_delete_draft_quote(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_draft public.quote_drafts%rowtype;
  v_protocol text;
begin
  if v_user_id is null then
    raise exception 'unauthorized';
  end if;

  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'mfa_required';
  end if;

  if not exists (
    select 1 from public.admin_users au where au.user_id = v_user_id
  ) then
    raise exception 'forbidden';
  end if;

  select * into v_draft
  from public.quote_drafts
  where request_id = p_request_id
  for update;

  if not found then
    raise exception 'draft_not_found';
  end if;

  select protocol into v_protocol
  from public.quote_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'quote_not_found';
  end if;

  if v_draft.commercial_status <> 'draft' or coalesce(v_draft.current_version, 0) > 0 then
    raise exception 'cannot_delete_used_quote';
  end if;

  if exists (select 1 from public.quote_versions where request_id = p_request_id)
     or exists (select 1 from public.hrx_documents where quote_request_id = p_request_id) then
    raise exception 'cannot_delete_official_quote';
  end if;

  if exists (select 1 from public.financial_entries where quote_request_id = p_request_id) then
    raise exception 'cannot_delete_financial_quote';
  end if;

  delete from public.quote_requests where id = p_request_id;

  if not found then
    raise exception 'delete_failed';
  end if;

  return v_protocol;
end;
$$;

revoke all on function public.hrx_delete_draft_quote(uuid) from public;
revoke all on function public.hrx_delete_draft_quote(uuid) from anon;
grant execute on function public.hrx_delete_draft_quote(uuid) to authenticated;
