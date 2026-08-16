create schema if not exists private;

create or replace function private.enroll_hrx_admin_from_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public, auth, private
as $$
declare
  allowed_role text;
begin
  if new.email is null then
    return new;
  end if;

  select role into allowed_role
  from public.admin_email_allowlist
  where email = lower(new.email)
    and active = true;

  if allowed_role is not null then
    insert into public.admin_users (user_id, role)
    values (new.id, allowed_role)
    on conflict (user_id) do update set role = excluded.role;
  end if;

  return new;
end;
$$;

drop trigger if exists hrx_admin_auto_enroll on auth.users;
create trigger hrx_admin_auto_enroll
after insert or update of email on auth.users
for each row execute function private.enroll_hrx_admin_from_allowlist();

insert into public.admin_users (user_id, role)
select u.id, a.role
from auth.users u
join public.admin_email_allowlist a on a.email = lower(u.email)
where a.active = true
on conflict (user_id) do update set role = excluded.role;
