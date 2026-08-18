create or replace function public.hrx_confirm_client_tax_regime(p_client_id uuid, p_tax_regime text)
returns text
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_regime text := upper(replace(btrim(coalesce(p_tax_regime, '')), ' ', '_'));
begin
  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if auth.uid() is null or not exists (select 1 from public.admin_users au where au.user_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_regime not in ('LUCRO_PRESUMIDO', 'LUCRO_REAL', 'IMUNE_ISENTA', 'OUTRO') then
    raise exception 'invalid_tax_regime';
  end if;
  update public.client_fiscal_profiles
  set tax_regime = v_regime,
      tax_regime_requires_confirmation = false,
      tax_regime_source = 'manual_admin',
      manual_confirmed_by = auth.uid(),
      manual_confirmed_at = now(),
      updated_at = now()
  where client_id = p_client_id;
  if not found then raise exception 'fiscal_profile_not_found'; end if;
  return v_regime;
end;
$function$;

create or replace function public.hrx_update_client_state_registration(
  p_client_id uuid,
  p_state_registration text,
  p_state_registration_status text default null,
  p_icms_taxpayer boolean default null,
  p_state_validation_status text default 'NAO_VERIFICADO'
)
returns void
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_ie text := nullif(btrim(coalesce(p_state_registration, '')), '');
  v_ie_status text := upper(nullif(btrim(coalesce(p_state_registration_status, '')), ''));
  v_validation text := upper(coalesce(nullif(btrim(coalesce(p_state_validation_status, '')), ''), 'NAO_VERIFICADO'));
begin
  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if auth.uid() is null or not exists (select 1 from public.admin_users au where au.user_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
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
  if not found then raise exception 'fiscal_profile_not_found'; end if;
end;
$function$;
