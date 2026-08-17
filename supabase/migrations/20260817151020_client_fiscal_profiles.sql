create table if not exists public.client_fiscal_profiles (
  client_id uuid primary key references public.clients(id) on delete cascade,
  cnpj text not null,
  legal_name text,
  trade_name text,
  registration_status text,
  registration_status_date date,
  registration_status_reason text,
  main_cnae_code text,
  main_cnae_description text,
  secondary_cnaes jsonb not null default '[]'::jsonb,
  legal_nature text,
  company_size text,
  simple_option boolean,
  simple_start_date date,
  simple_end_date date,
  mei_option boolean,
  mei_start_date date,
  mei_end_date date,
  tax_regime text,
  tax_regime_requires_confirmation boolean not null default true,
  tax_regime_reference text,
  tax_regime_reference_year integer,
  tax_regime_source text,
  state_registration text,
  state_registration_status text,
  icms_taxpayer boolean,
  federal_validation_status text,
  state_validation_status text,
  fiscal_address jsonb not null default '{}'::jsonb,
  data_source text not null default 'BrasilAPI / Minha Receita',
  data_source_official boolean not null default false,
  source_note text,
  sefaz_verification_url text,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  manual_confirmed_by uuid references auth.users(id) on delete set null,
  manual_confirmed_at timestamptz,
  constraint client_fiscal_profiles_cnpj_check check (cnpj ~ '^[0-9]{14}$'),
  constraint client_fiscal_profiles_secondary_cnaes_check check (jsonb_typeof(secondary_cnaes) = 'array'),
  constraint client_fiscal_profiles_address_check check (jsonb_typeof(fiscal_address) = 'object')
);

create unique index if not exists client_fiscal_profiles_cnpj_uidx
  on public.client_fiscal_profiles(cnpj);
create index if not exists client_fiscal_profiles_status_idx
  on public.client_fiscal_profiles(registration_status);
create index if not exists client_fiscal_profiles_checked_at_idx
  on public.client_fiscal_profiles(checked_at desc nulls last);

alter table public.client_fiscal_profiles enable row level security;
drop policy if exists "admins manage client fiscal profiles" on public.client_fiscal_profiles;
create policy "admins manage client fiscal profiles" on public.client_fiscal_profiles
  for all to authenticated
  using (private.is_hrx_admin())
  with check (private.is_hrx_admin());

grant select, insert, update, delete on public.client_fiscal_profiles to authenticated;
grant all on public.client_fiscal_profiles to service_role;

create or replace function public.hrx_confirm_client_tax_regime(
  p_client_id uuid,
  p_tax_regime text
) returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_regime text := upper(replace(btrim(coalesce(p_tax_regime, '')), ' ', '_'));
begin
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

  if not found then
    raise exception 'fiscal_profile_not_found';
  end if;

  return v_regime;
end;
$$;

revoke all on function public.hrx_confirm_client_tax_regime(uuid,text) from public, anon;
grant execute on function public.hrx_confirm_client_tax_regime(uuid,text) to authenticated;
