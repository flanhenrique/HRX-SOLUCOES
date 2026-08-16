create table if not exists private.admin_email_allowlist (
  email text primary key,
  role text not null default 'admin' check (role in ('admin', 'reviewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint private_admin_email_allowlist_lowercase check (email = lower(email)),
  constraint private_admin_email_allowlist_email_shape check (position('@' in email) > 1)
);

insert into private.admin_email_allowlist (email, role, active, created_at, updated_at)
select email, role, active, created_at, updated_at
from public.admin_email_allowlist
on conflict (email) do update
set role = excluded.role, active = excluded.active, updated_at = excluded.updated_at;

create or replace function private.enroll_hrx_admin_from_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public, auth, private
as $enroll$
declare
  allowed_role text;
begin
  if new.email is null then
    return new;
  end if;

  select role into allowed_role
  from private.admin_email_allowlist
  where email = lower(new.email)
    and active = true;

  if allowed_role is not null then
    insert into public.admin_users (user_id, role)
    values (new.id, allowed_role)
    on conflict (user_id) do update set role = excluded.role;
  end if;

  return new;
end;
$enroll$;

insert into public.admin_users (user_id, role)
select u.id, a.role
from auth.users u
join private.admin_email_allowlist a on a.email = lower(u.email)
where a.active = true
on conflict (user_id) do update set role = excluded.role;

drop table public.admin_email_allowlist;

revoke all on schema private from public, anon, authenticated;
