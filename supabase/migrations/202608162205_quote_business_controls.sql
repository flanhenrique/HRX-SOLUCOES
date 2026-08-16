create table if not exists public.business_settings (
  setting_key text primary key,
  numeric_value numeric(14,4),
  text_value text,
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_provider_rules (
  provider text primary key check (provider in ('nubank','mercadopago')),
  display_name text not null,
  boleto_fee_per_paid numeric(12,2) not null default 0,
  fee_note text,
  last_verified_at timestamptz,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.business_settings enable row level security;
alter table public.payment_provider_rules enable row level security;

create policy "admins manage business settings" on public.business_settings
  for all to authenticated using (public.is_hrx_admin()) with check (public.is_hrx_admin());

create policy "admins manage payment provider rules" on public.payment_provider_rules
  for all to authenticated using (public.is_hrx_admin()) with check (public.is_hrx_admin());

alter table public.quote_drafts
  add column if not exists retention_gross_up_suggestion numeric(12,2) not null default 0;

alter table public.quote_drafts
  add column if not exists retention_pricing_mode text not null default 'informational'
  check (retention_pricing_mode in ('informational','preserve_net'));

alter table public.quote_drafts
  add column if not exists retention_net_target numeric(12,2) not null default 0;

-- Valores de precificação, piso financeiro e regras internas são cadastrados diretamente
-- no banco protegido e não ficam versionados neste repositório público.
