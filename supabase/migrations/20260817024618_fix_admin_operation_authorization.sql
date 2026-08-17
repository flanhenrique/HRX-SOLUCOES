drop policy if exists "admins insert audit log" on public.quote_audit_log;
create policy "admins insert audit log" on public.quote_audit_log
  for insert to authenticated
  with check (private.is_hrx_admin());

grant insert on public.quote_audit_log to authenticated;

create or replace function public.hrx_create_client(
  p_name text,
  p_company text default null,
  p_email text default null,
  p_phone text default null,
  p_document text default null,
  p_notes text default null
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
begin
  if nullif(btrim(coalesce(p_name, '')), '') is null or (v_email is null and v_phone is null) then
    raise exception 'invalid_client';
  end if;

  insert into public.clients (name, company, email, phone, document, notes, source, created_by)
  values (
    btrim(p_name), nullif(btrim(coalesce(p_company, '')), ''), v_email, v_phone,
    nullif(btrim(coalesce(p_document, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''),
    'admin', auth.uid()
  )
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'duplicate_client';
end;
$$;

create or replace function public.hrx_create_manual_quote(
  p_client_id uuid,
  p_request_text text default null,
  p_desired_deadline text default null,
  p_preferred_contact text default null
) returns table(request_id uuid, protocol text)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_client public.clients%rowtype;
  v_request_id uuid := gen_random_uuid();
  v_protocol text;
  v_now timestamptz := now();
  v_contact text;
begin
  select * into v_client from public.clients where id = p_client_id and active = true;
  if not found then raise exception 'client_not_found'; end if;

  v_protocol := 'HRX-M-' || to_char(v_now at time zone 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_contact := coalesce(nullif(btrim(coalesce(p_preferred_contact, '')), ''), case when v_client.email is not null then 'email' else 'whatsapp' end);

  insert into public.quote_requests (
    id, client_id, protocol, name, email, phone, company, reason, interests, request_text,
    desired_deadline, preferred_contact, privacy_consent, marketing_consent, consent_at,
    source, status, created_at, updated_at
  ) values (
    v_request_id, v_client.id, v_protocol, v_client.name, coalesce(v_client.email, ''), coalesce(v_client.phone, ''),
    v_client.company, 'manual_quote', '{}', coalesce(nullif(btrim(coalesce(p_request_text, '')), ''), 'Orçamento manual criado no HRX Admin.'),
    nullif(btrim(coalesce(p_desired_deadline, '')), ''), v_contact, false, false, v_now,
    'admin_manual', 'needs_scope', v_now, v_now
  );

  insert into public.quote_drafts (
    request_id, base_amount, pre_discount_amount, final_amount, estimated_net, status, created_at, updated_at
  ) values (v_request_id, 0, 0, 0, 0, 'needs_scope', v_now, v_now);

  update public.clients set last_quote_at = v_now, updated_at = v_now where id = v_client.id;
  insert into public.quote_audit_log (request_id, actor_user_id, event_type, event_data)
  values (v_request_id, auth.uid(), 'manual_quote_created', jsonb_build_object('clientId', v_client.id, 'protocol', v_protocol));

  return query select v_request_id, v_protocol;
end;
$$;

create or replace function public.hrx_suspend_quote(
  p_request_id uuid,
  p_reason text,
  p_note text default null
) returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_draft public.quote_drafts%rowtype;
  v_now timestamptz := now();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is null then raise exception 'suspension_reason_required'; end if;

  select * into v_draft from public.quote_drafts where request_id = p_request_id for update;
  if not found then raise exception 'draft_not_found'; end if;
  if v_draft.status = 'suspended' then raise exception 'already_suspended'; end if;

  update public.quote_drafts
  set status = 'suspended', suspension_reason = v_reason, suspension_note = nullif(btrim(coalesce(p_note, '')), ''),
      suspended_at = v_now, suspended_by = auth.uid(), status_before_suspension = v_draft.status, updated_at = v_now
  where id = v_draft.id;
  update public.quote_requests set status = 'suspended', updated_at = v_now where id = p_request_id;

  insert into public.quote_suspensions (request_id, draft_id, reason, note, status_before, suspended_at, suspended_by)
  values (p_request_id, v_draft.id, v_reason, nullif(btrim(coalesce(p_note, '')), ''), v_draft.status, v_now, auth.uid());
  insert into public.quote_audit_log (request_id, actor_user_id, event_type, event_data)
  values (p_request_id, auth.uid(), 'quote_suspended', jsonb_build_object('reason', v_reason, 'note', nullif(btrim(coalesce(p_note, '')), ''), 'previousStatus', v_draft.status));
  return 'suspended';
end;
$$;

create or replace function public.hrx_resume_quote(p_request_id uuid) returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_draft public.quote_drafts%rowtype;
  v_now timestamptz := now();
  v_restore text;
begin
  select * into v_draft from public.quote_drafts where request_id = p_request_id for update;
  if not found then raise exception 'draft_not_found'; end if;
  if v_draft.status <> 'suspended' then raise exception 'not_suspended'; end if;

  v_restore := coalesce(v_draft.status_before_suspension, case when v_draft.final_amount > 0 then 'awaiting_review' else 'needs_scope' end);
  update public.quote_drafts
  set status = v_restore, suspension_reason = null, suspension_note = null, suspended_at = null,
      suspended_by = null, status_before_suspension = null, updated_at = v_now
  where id = v_draft.id;
  update public.quote_requests set status = v_restore, updated_at = v_now where id = p_request_id;
  update public.quote_suspensions set resumed_at = v_now, resumed_by = auth.uid()
  where request_id = p_request_id and resumed_at is null;
  insert into public.quote_audit_log (request_id, actor_user_id, event_type, event_data)
  values (p_request_id, auth.uid(), 'quote_resumed', jsonb_build_object('restoredStatus', v_restore));
  return v_restore;
end;
$$;

create or replace function private.protect_suspended_quote()
returns trigger
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
begin
  if old.status = 'suspended' and new.status <> 'suspended' and auth.uid() is null then
    raise exception 'quote_suspended';
  end if;
  return new;
end;
$$;

revoke all on function public.hrx_create_client(text,text,text,text,text,text) from public, anon;
revoke all on function public.hrx_create_manual_quote(uuid,text,text,text) from public, anon;
revoke all on function public.hrx_suspend_quote(uuid,text,text) from public, anon;
revoke all on function public.hrx_resume_quote(uuid) from public, anon;
grant execute on function public.hrx_create_client(text,text,text,text,text,text) to authenticated;
grant execute on function public.hrx_create_manual_quote(uuid,text,text,text) to authenticated;
grant execute on function public.hrx_suspend_quote(uuid,text,text) to authenticated;
grant execute on function public.hrx_resume_quote(uuid) to authenticated;
revoke all on function private.protect_suspended_quote() from public, anon, authenticated;
