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
begin
  if new.client_id is null and v_email is not null then
    select id into v_client_id
    from public.clients
    where lower(email) = v_email
    limit 1;

    if v_client_id is null then
      insert into public.clients (name, company, email, phone, source, last_quote_at)
      values (
        coalesce(nullif(btrim(new.name), ''), 'Cliente'),
        nullif(btrim(coalesce(new.company, '')), ''),
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
    update public.clients
    set company = coalesce(company, nullif(btrim(coalesce(new.company, '')), '')),
        phone = coalesce(phone, v_phone),
        last_quote_at = greatest(coalesce(last_quote_at, '-infinity'::timestamptz), coalesce(new.created_at, now())),
        updated_at = now()
    where id = new.client_id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_quote_request_client_trigger on public.quote_requests;
create trigger sync_quote_request_client_trigger
before insert on public.quote_requests
for each row execute function private.sync_quote_request_client();

revoke all on function private.sync_quote_request_client() from public, anon, authenticated;
