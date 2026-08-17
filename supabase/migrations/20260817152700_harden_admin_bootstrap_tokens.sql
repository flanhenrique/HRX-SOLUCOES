revoke all on table public.admin_bootstrap_tokens from anon, authenticated, public;

drop policy if exists "deny direct bootstrap token access" on public.admin_bootstrap_tokens;
create policy "deny direct bootstrap token access"
  on public.admin_bootstrap_tokens
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on table public.admin_bootstrap_tokens is 'Backend-only first-access tokens. Direct Data API access is explicitly denied; service_role is used by the admin-bootstrap Edge Function.';
