create or replace function private.sync_quote_request_client()
returns trigger
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_client_id uuid;
  v_email text := nullif(lower(btrim(coalesce(new.email, ''))), '');
  v_phone text := nullif(btrim(coalesce(new.phone, '')), '');
  v_name text := nullif(btrim(coalesce(new.name, '')), '');
  v_company text := nullif(btrim(coalesce(new.company, '')), '');
begin
  if new.client_id is null and v_email is not null then
    select id into v_client_id
    from public.clients
    where lower(email) = v_email
    limit 1;

    if v_client_id is null then
      insert into public.clients (name, company, email, phone, source, last_quote_at)
      values (
        coalesce(v_name, 'Cliente'),
        v_company,
        v_email,
        v_phone,
        case when new.source = 'admin_manual' then 'admin' else 'website' end,
        coalesce(new.created_at, now())
      )
      on conflict do nothing
      returning id into v_client_id;

      if v_client_id is null then
        select id into v_client_id
        from public.clients
        where lower(email) = v_email
        limit 1;
      end if;
    end if;

    new.client_id := v_client_id;
  end if;

  if new.client_id is not null then
    update public.clients c
    set name = case
          when coalesce(new.created_at, now()) >= coalesce(c.last_quote_at, '-infinity'::timestamptz)
            then coalesce(v_name, c.name)
          else c.name
        end,
        company = case
          when coalesce(new.created_at, now()) >= coalesce(c.last_quote_at, '-infinity'::timestamptz)
            then coalesce(v_company, c.company)
          else c.company
        end,
        email = case
          when coalesce(new.created_at, now()) >= coalesce(c.last_quote_at, '-infinity'::timestamptz)
               and v_email is not null
               and not exists (
                 select 1 from public.clients other
                 where other.id <> new.client_id and lower(other.email) = v_email
               )
            then v_email
          else c.email
        end,
        phone = case
          when coalesce(new.created_at, now()) >= coalesce(c.last_quote_at, '-infinity'::timestamptz)
            then coalesce(v_phone, c.phone)
          else c.phone
        end,
        last_quote_at = greatest(coalesce(c.last_quote_at, '-infinity'::timestamptz), coalesce(new.created_at, now())),
        updated_at = now()
    where c.id = new.client_id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_quote_request_client_trigger on public.quote_requests;
create trigger sync_quote_request_client_trigger
before insert or update on public.quote_requests
for each row execute function private.sync_quote_request_client();

revoke all on function private.sync_quote_request_client() from public, anon, authenticated;

create or replace function public.hrx_update_client_state_registration(
  p_client_id uuid,
  p_state_registration text,
  p_state_registration_status text default null,
  p_icms_taxpayer boolean default null,
  p_state_validation_status text default 'NAO_VERIFICADO'
)
returns void
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_ie text := nullif(btrim(coalesce(p_state_registration, '')), '');
  v_ie_status text := upper(nullif(btrim(coalesce(p_state_registration_status, '')), ''));
  v_validation text := upper(coalesce(nullif(btrim(coalesce(p_state_validation_status, '')), ''), 'NAO_VERIFICADO'));
begin
  if not private.is_hrx_admin() then
    raise exception 'forbidden';
  end if;

  if v_validation not in ('NAO_VERIFICADO', 'HABILITADO', 'NAO_HABILITADO', 'PENDENTE_SEFAZ_AM') then
    raise exception 'invalid_state_validation_status';
  end if;

  if v_ie_status is not null and v_ie_status not in ('ATIVA', 'INATIVA', 'SUSPENSA', 'BAIXADA', 'PENDENTE', 'NAO_VERIFICADA') then
    raise exception 'invalid_state_registration_status';
  end if;

  update public.client_fiscal_profiles
  set state_registration = v_ie,
      state_registration_status = v_ie_status,
      icms_taxpayer = p_icms_taxpayer,
      state_validation_status = v_validation,
      manual_confirmed_by = auth.uid(),
      manual_confirmed_at = now(),
      updated_at = now()
  where client_id = p_client_id;

  if not found then
    raise exception 'fiscal_profile_not_found';
  end if;
end;
$$;

revoke all on function public.hrx_update_client_state_registration(uuid,text,text,boolean,text) from public, anon;
grant execute on function public.hrx_update_client_state_registration(uuid,text,text,boolean,text) to authenticated, service_role;
