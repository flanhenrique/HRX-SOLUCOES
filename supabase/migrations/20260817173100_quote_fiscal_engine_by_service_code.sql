-- Motor fiscal do orçamento: código fiscal do serviço -> retenções e pendências.
-- Aplicado em produção em 2026-08-17. Mantém o cálculo independente da emissão da NFS-e.

create table if not exists public.company_fiscal_settings (
  company_key text primary key,
  display_name text not null,
  cnpj text not null,
  municipality text not null,
  state text not null,
  tax_regime text not null check (tax_regime in ('SIMEI','SIMPLES_NACIONAL','LUCRO_PRESUMIDO','LUCRO_REAL','UNKNOWN')),
  iss_fixed_monthly boolean not null default false,
  active boolean not null default true,
  source text not null default 'manual',
  source_note text,
  effective_from date not null default current_date,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_fiscal_settings enable row level security;
drop policy if exists "admins manage company fiscal settings" on public.company_fiscal_settings;
create policy "admins manage company fiscal settings" on public.company_fiscal_settings for all to authenticated using (private.is_hrx_admin()) with check (private.is_hrx_admin());
revoke all on public.company_fiscal_settings from anon;
grant select, insert, update, delete on public.company_fiscal_settings to authenticated;

create table if not exists public.service_tax_rules (
  fiscal_code text primary key,
  national_description text not null,
  lc116_item text not null,
  iss_due_location text not null default 'PRESTADOR' check (iss_due_location in ('PRESTADOR','TOMADOR','EXECUCAO','MIXED')),
  municipal_substitute_check boolean not null default true,
  active boolean not null default true,
  source_ref text not null default 'NFS-e Nacional / LC 116',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_tax_rules enable row level security;
drop policy if exists "admins manage service tax rules" on public.service_tax_rules;
create policy "admins manage service tax rules" on public.service_tax_rules for all to authenticated using (private.is_hrx_admin()) with check (private.is_hrx_admin());
revoke all on public.service_tax_rules from anon;
grant select, insert, update, delete on public.service_tax_rules to authenticated;

alter table public.client_fiscal_profiles
  add column if not exists municipal_iss_responsibility text not null default 'NAO_VERIFICADO' check (municipal_iss_responsibility in ('NAO_VERIFICADO','NAO_RESPONSAVEL','SUBSTITUTO','RESPONSAVEL_SOLIDARIO')),
  add column if not exists municipal_registration text,
  add column if not exists municipal_checked_at timestamptz;

alter table public.quote_drafts
  add column if not exists fiscal_engine_status text,
  add column if not exists fiscal_engine_source text,
  add column if not exists fiscal_engine_codes jsonb not null default '[]'::jsonb,
  add column if not exists fiscal_engine_version text,
  add column if not exists fiscal_engine_calculated_at timestamptz;

insert into public.company_fiscal_settings (company_key,display_name,cnpj,municipality,state,tax_regime,iss_fixed_monthly,active,source,source_note,effective_from)
values ('hrx','HRX Solutions','68588217000106','MANAUS','AM','SIMEI',true,true,'owner_declared','Enquadramento informado pelo proprietário. O motor exige revisão se o regime da empresa mudar.',current_date)
on conflict (company_key) do update set display_name=excluded.display_name,cnpj=excluded.cnpj,municipality=excluded.municipality,state=excluded.state,tax_regime=excluded.tax_regime,iss_fixed_monthly=excluded.iss_fixed_monthly,active=excluded.active,source=excluded.source,source_note=excluded.source_note,updated_at=now();

insert into public.service_tax_rules (fiscal_code,national_description,lc116_item,iss_due_location,municipal_substitute_check) values
('010101','Análise e desenvolvimento de sistemas.','1.01','PRESTADOR',true),
('010201','Programação.','1.02','PRESTADOR',true),
('010701','Suporte técnico em informática, inclusive instalação, configuração e manutenção de programas de computação e bancos de dados.','1.07','PRESTADOR',true),
('010801','Planejamento, confecção, manutenção e atualização de páginas eletrônicas.','1.08','PRESTADOR',true),
('170101','Assessoria ou consultoria de qualquer natureza, não contida em outros itens desta lista.','17.01','PRESTADOR',true),
('170102','Análise, exame, pesquisa, coleta, compilação e fornecimento de dados e informações de qualquer natureza, inclusive cadastro e similares.','17.01','PRESTADOR',true),
('170202','Expediente, secretaria em geral, apoio e infra-estrutura administrativa e congêneres.','17.02','PRESTADOR',true),
('171701','Análise de Organização e Métodos.','17.17','PRESTADOR',true),
('172201','Cobrança em geral.','17.22','PRESTADOR',true)
on conflict (fiscal_code) do update set national_description=excluded.national_description,lc116_item=excluded.lc116_item,iss_due_location=excluded.iss_due_location,municipal_substitute_check=excluded.municipal_substitute_check,active=true,updated_at=now();

create or replace function public.hrx_calculate_quote_fiscal(p_request_id uuid,p_apply boolean default false) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user uuid:=auth.uid(); v_draft public.quote_drafts%rowtype; v_client_id uuid; v_client public.client_fiscal_profiles%rowtype; v_issuer public.company_fiscal_settings%rowtype;
  v_codes text[]; v_missing_codes text[]; v_rule_count integer:=0; v_status text:='READY'; v_iss numeric:=0; v_irrf numeric:=0; v_pis numeric:=0; v_cofins numeric:=0; v_csll numeric:=0; v_inss numeric:=0; v_total numeric:=0;
  v_ret jsonb; v_client_city text; v_target numeric; v_gross numeric; v_final numeric; v_estimated numeric; v_explanations jsonb:='[]'::jsonb;
begin
  if v_user is null or not exists(select 1 from public.admin_users au where au.user_id=v_user) then raise exception 'forbidden' using errcode='42501'; end if;
  select * into v_draft from public.quote_drafts where request_id=p_request_id; if not found then raise exception 'draft_not_found'; end if;
  select qr.client_id into v_client_id from public.quote_requests qr where qr.id=p_request_id;
  if v_client_id is not null then select * into v_client from public.client_fiscal_profiles where client_id=v_client_id; end if;
  select * into v_issuer from public.company_fiscal_settings where company_key='hrx' and active=true;
  if not found then return jsonb_build_object('status','NEEDS_ISSUER_PROFILE','retentions',coalesce(v_draft.retentions,'{}'::jsonb),'applied',false); end if;

  select array_agg(distinct pr.fiscal_code order by pr.fiscal_code), array_agg(distinct qi.service_key order by qi.service_key) filter(where pr.fiscal_code is null)
  into v_codes,v_missing_codes from public.quote_items qi left join public.pricing_rules pr on pr.service_key=qi.service_key where qi.draft_id=v_draft.id;
  if v_codes is null and coalesce(array_length(v_missing_codes,1),0)=0 then return jsonb_build_object('status','NO_SERVICES','retentions',coalesce(v_draft.retentions,'{}'::jsonb),'applied',false); end if;
  if coalesce(array_length(v_missing_codes,1),0)>0 then v_status:='NEEDS_CLASSIFICATION'; v_explanations:=v_explanations||jsonb_build_array('Há serviço no orçamento sem código fiscal cadastrado.'); end if;
  if v_codes is not null then select count(*) into v_rule_count from public.service_tax_rules where fiscal_code=any(v_codes) and active=true; if v_rule_count<>cardinality(v_codes) then v_status:='NEEDS_SERVICE_RULE'; v_explanations:=v_explanations||jsonb_build_array('Existe código fiscal sem regra cadastrada no motor fiscal.'); end if; end if;

  if v_issuer.tax_regime='SIMEI' then
    v_irrf:=0; v_pis:=0; v_cofins:=0; v_csll:=0; v_inss:=0;
    v_explanations:=v_explanations||jsonb_build_array('IRRF, PIS, COFINS, CSLL e INSS foram avaliados pelo enquadramento SIMEI da prestadora e pelo serviço selecionado.');
  else v_status:='NEEDS_ISSUER_RULES'; v_explanations:=v_explanations||jsonb_build_array('O regime atual da prestadora exige regras adicionais antes do cálculo automático das retenções federais.'); end if;

  v_client_city:=upper(coalesce(v_client.fiscal_address->>'city',''));
  if v_status in ('READY','NEEDS_SERVICE_RULE') and v_issuer.iss_fixed_monthly then
    if v_client_id is null or v_client.client_id is null then v_status:='NEEDS_CLIENT_FISCAL_PROFILE'; v_explanations:=v_explanations||jsonb_build_array('Falta perfil fiscal do cliente para concluir a análise do ISS.');
    elsif v_client.municipal_iss_responsibility='NAO_VERIFICADO' then v_status:='NEEDS_MUNICIPAL_STATUS'; v_iss:=coalesce((v_draft.retentions->>'iss')::numeric,0); v_explanations:=v_explanations||jsonb_build_array('O ISS depende de confirmar se o tomador é contribuinte substituto ou responsável solidário no Município de Manaus.');
    elsif v_client.municipal_iss_responsibility='NAO_RESPONSAVEL' and v_client_city=upper(v_issuer.municipality) and not exists(select 1 from public.service_tax_rules r where r.fiscal_code=any(v_codes) and r.iss_due_location<>'PRESTADOR') then v_iss:=0; v_explanations:=v_explanations||jsonb_build_array('ISS sem retenção no orçamento: prestadora SIMEI com recolhimento fixo e serviço devido no município do estabelecimento prestador.');
    else v_status:='NEEDS_ISS_REVIEW'; v_iss:=coalesce((v_draft.retentions->>'iss')::numeric,0); v_explanations:=v_explanations||jsonb_build_array('O ISS exige validação municipal específica para este tomador/local de incidência.'); end if;
  end if;

  v_ret:=jsonb_build_object('iss',v_iss,'irrf',v_irrf,'pis',v_pis,'cofins',v_cofins,'csll',v_csll,'inss',v_inss); v_total:=v_iss+v_irrf+v_pis+v_cofins+v_csll+v_inss;
  if p_apply and v_status not in ('NO_SERVICES','NEEDS_CLASSIFICATION','NEEDS_SERVICE_RULE','NEEDS_ISSUER_PROFILE','NEEDS_ISSUER_RULES','NEEDS_CLIENT_FISCAL_PROFILE') then
    v_target:=round((coalesce(v_draft.pre_discount_amount,0)-coalesce(v_draft.discount_amount,0)+coalesce(v_draft.payment_fee_total,0))::numeric,2); if v_total>=100 then raise exception 'invalid_retention_total'; end if;
    v_gross:=case when v_total>0 then round((v_target/(1-v_total/100))::numeric,2) else v_target end; v_final:=case when v_total>0 and v_draft.retention_pricing_mode='preserve_net' and v_draft.fiscal_review_confirmed then v_gross else v_target end; v_estimated:=round((v_final*(1-v_total/100))::numeric,2);
    update public.quote_drafts set retentions=v_ret,retention_total=v_total,retention_net_target=v_target,retention_gross_up_suggestion=v_gross,final_amount=v_final,estimated_net=v_estimated,fiscal_review_required=(v_total>0),fiscal_review_confirmed=false,fiscal_review_confirmed_by=null,fiscal_review_confirmed_at=null,fiscal_engine_status=v_status,fiscal_engine_source='service_code',fiscal_engine_codes=to_jsonb(coalesce(v_codes,array[]::text[])),fiscal_engine_version='2026-08-17.1',fiscal_engine_calculated_at=now(),updated_at=now() where id=v_draft.id;
    insert into public.quote_audit_log(request_id,actor_user_id,event_type,event_data) values(p_request_id,v_user,'fiscal_engine_applied',jsonb_build_object('status',v_status,'codes',v_codes,'retentions',v_ret,'version','2026-08-17.1'));
  end if;
  return jsonb_build_object('status',v_status,'applied',p_apply and v_status not in ('NO_SERVICES','NEEDS_CLASSIFICATION','NEEDS_SERVICE_RULE','NEEDS_ISSUER_PROFILE','NEEDS_ISSUER_RULES','NEEDS_CLIENT_FISCAL_PROFILE'),'serviceCodes',to_jsonb(coalesce(v_codes,array[]::text[])),'missingServiceKeys',to_jsonb(coalesce(v_missing_codes,array[]::text[])),'issuerRegime',v_issuer.tax_regime,'issuerMunicipality',v_issuer.municipality,'clientMunicipality',nullif(v_client_city,''),'municipalIssResponsibility',case when v_client.client_id is null then 'NAO_VERIFICADO' else v_client.municipal_iss_responsibility end,'retentions',v_ret,'retentionTotal',v_total,'explanations',v_explanations,'version','2026-08-17.1');
end; $$;

revoke all on function public.hrx_calculate_quote_fiscal(uuid,boolean) from public,anon;
grant execute on function public.hrx_calculate_quote_fiscal(uuid,boolean) to authenticated;
comment on function public.hrx_calculate_quote_fiscal(uuid,boolean) is 'Calcula retenções do orçamento a partir dos códigos fiscais dos serviços, regime da HRX e perfil fiscal do cliente; não depende de nota fiscal emitida.';
