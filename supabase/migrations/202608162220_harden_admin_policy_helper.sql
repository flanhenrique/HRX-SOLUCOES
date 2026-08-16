create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_hrx_admin()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid()
  );
$$;

revoke all on function private.is_hrx_admin() from public;
grant execute on function private.is_hrx_admin() to authenticated;

alter policy "admins read admin users" on public.admin_users using (private.is_hrx_admin());
alter policy "admins manage requests" on public.quote_requests using (private.is_hrx_admin()) with check (private.is_hrx_admin());
alter policy "admins manage interpretations" on public.quote_interpretations using (private.is_hrx_admin()) with check (private.is_hrx_admin());
alter policy "admins manage pricing" on public.pricing_rules using (private.is_hrx_admin()) with check (private.is_hrx_admin());
alter policy "admins manage drafts" on public.quote_drafts using (private.is_hrx_admin()) with check (private.is_hrx_admin());
alter policy "admins manage items" on public.quote_items using (private.is_hrx_admin()) with check (private.is_hrx_admin());
alter policy "admins manage outbound messages" on public.outbound_messages using (private.is_hrx_admin()) with check (private.is_hrx_admin());
alter policy "admins read audit log" on public.quote_audit_log using (private.is_hrx_admin());
alter policy "admins manage business settings" on public.business_settings using (private.is_hrx_admin()) with check (private.is_hrx_admin());
alter policy "admins manage payment provider rules" on public.payment_provider_rules using (private.is_hrx_admin()) with check (private.is_hrx_admin());

drop function if exists public.is_hrx_admin();
