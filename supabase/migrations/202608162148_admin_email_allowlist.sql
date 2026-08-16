create table if not exists public.admin_email_allowlist (
  email text primary key,
  role text not null default 'admin' check (role in ('admin', 'reviewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_email_allowlist_lowercase check (email = lower(email)),
  constraint admin_email_allowlist_email_shape check (position('@' in email) > 1)
);

alter table public.admin_email_allowlist enable row level security;

revoke all on public.admin_email_allowlist from anon, authenticated;

comment on table public.admin_email_allowlist is 'Private allowlist used by the HRX quote admin edge function to enroll authorized corporate accounts on first authenticated access.';
