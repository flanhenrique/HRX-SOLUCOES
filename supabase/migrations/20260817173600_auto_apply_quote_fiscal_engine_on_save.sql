create or replace function public.hrx_calculate_quote_fiscal(
  p_request_id uuid,
  p_apply boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_role text := coalesce(auth.role(),'');
  v_draft public.quote_drafts%rowtype;
  v_client_id uuid;
  v_client public.client_fiscal_profiles%rowtype;
  v_issuer public.company_fiscal_settings%rowtype;
  v_codes text[];
  v_missing_codes text[];
  v_rule_count integer := 0;
  v_status text := 'READY';
  v_iss numeric := 0;
  v_irrf numeric := 0;
  v_pis numeric := 0;
  v_cofins numeric := 0;
  v_csll numeric := 0;
  v_inss numeric := 0;
  v_total numeric := 0;
  v_ret jsonb;
  v_client_city text;
  v_target numeric;
  v_gross numeric;
  v_final numeric;
  v_estimated numeric;
  v_explanations jsonb := '[]'::jsonb;
begin
  if v_role <> 'service_role' and (v_user is null or not exists (select 1 from public.admin_users au where au.user_id = v_user)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_draft from public.quote_drafts where request_id = p_request_id;
  if not found then raise exception 'draft_not_found'; end if;

  select qr.client_id into v_client_id from public.quote_requests qr where qr.id = p_request_id;
  if v_client_id is not null then
    select * into v_client from public.client_fiscal_profiles where client_id = v_client_id;
  end if;

  select * into v_issuer from public.company_fiscal_settings where company_key = 'hrx' and active = true;
  if not found then
    return jsonb_build_object('status','NEEDS_ISSUER_PROFILE','retentions',coalesce(v_draft.retentions,'{}'::jsonb),'applied',false);
  end if;

  select array_agg(distinct pr.fiscal_code order by pr.fiscal_code),
         array_agg(distinct qi.service_key order by qi.service_key) filter (where pr.fiscal_code is null)
    into v_codes, v_missing_codes
  from public.quote_items qi
  left join public.pricing_rules pr on pr.service_key = qi.service_key
  where qi.draft_id = v_draft.id;

  if v_codes is null and coalesce(array_length(v_missing_codes,1),0) = 0 then
    return jsonb_build_object('status','NO_SERVICES','retentions',coalesce(v_draft.retentions,'{}'::jsonb),'applied',false);
  end if;

  if coalesce(array_length(v_missing_codes,1),0) > 0 then
    v_status := 'NEEDS_CLASSIFICATION';
    v_explanations := v_explanations || jsonb_build_array('Há serviço no orçamento sem código fiscal cadastrado.');
  end if;

  if v_codes is not null then
    select count(*) into v_rule_count from public.service_tax_rules where fiscal_code = any(v_codes) and active = true;
    if v_rule_count <> cardinality(v_codes) then
      v_status := 'NEEDS_SERVICE_RULE';
      v_explanations := v_explanations || jsonb_build_array('Existe código fiscal sem regra cadastrada no motor fiscal.');
    end if;
  end if;

  if v_issuer.tax_regime = 'SIMEI' then
    v_irrf := 0; v_pis := 0; v_cofins := 0; v_csll := 0; v_inss := 0;
    v_explanations := v_explanations || jsonb_build_array('IRRF, PIS, COFINS, CSLL e INSS foram avaliados pelo enquadramento SIMEI da prestadora e pelo serviço selecionado.');
  else
    v_status := 'NEEDS_ISSUER_RULES';
    v_explanations := v_explanations || jsonb_build_array('O regime atual da prestadora exige regras adicionais antes do cálculo automático das retenções federais.');
  end if;

  v_client_city := upper(coalesce(v_client.fiscal_address->>'city',''));

  if v_status in ('READY','NEEDS_SERVICE_RULE') and v_issuer.iss_fixed_monthly then
    if v_client_id is null or v_client.client_id is null then
      v_status := 'NEEDS_CLIENT_FISCAL_PROFILE';
      v_explanations := v_explanations || jsonb_build_array('Falta perfil fiscal do cliente para concluir a análise do ISS.');
    elsif v_client.municipal_iss_responsibility = 'NAO_VERIFICADO' then
      v_status := 'NEEDS_MUNICIPAL_STATUS';
      v_iss := coalesce((v_draft.retentions->>'iss')::numeric,0);
      v_explanations := v_explanations || jsonb_build_array('O ISS depende de confirmar se o tomador é contribuinte substituto ou responsável solidário no Município de Manaus.');
    elsif v_client.municipal_iss_responsibility = 'NAO_RESPONSAVEL'
      and v_client_city = upper(v_issuer.municipality)
      and not exists (select 1 from public.service_tax_rules r where r.fiscal_code = any(v_codes) and r.iss_due_location <> 'PRESTADOR') then
      v_iss := 0;
      v_explanations := v_explanations || jsonb_build_array('ISS sem retenção no orçamento: prestadora SIMEI com recolhimento fixo e serviço devido no município do estabelecimento prestador.');
    else
      v_status := 'NEEDS_ISS_REVIEW';
      v_iss := coalesce((v_draft.retentions->>'iss')::numeric,0);
      v_explanations := v_explanations || jsonb_build_array('O ISS exige validação municipal específica para este tomador/local de incidência.');
    end if;
  end if;

  v_ret := jsonb_build_object('iss',v_iss,'irrf',v_irrf,'pis',v_pis,'cofins',v_cofins,'csll',v_csll,'inss',v_inss);
  v_total := v_iss + v_irrf + v_pis + v_cofins + v_csll + v_inss;

  if p_apply and v_status not in ('NO_SERVICES','NEEDS_CLASSIFICATION','NEEDS_SERVICE_RULE','NEEDS_ISSUER_PROFILE','NEEDS_ISSUER_RULES','NEEDS_CLIENT_FISCAL_PROFILE') then
    v_target := round((coalesce(v_draft.pre_discount_amount,0) - coalesce(v_draft.discount_amount,0) + coalesce(v_draft.payment_fee_total,0))::numeric,2);
    if v_total >= 100 then raise exception 'invalid_retention_total'; end if;
    v_gross := case when v_total > 0 then round((v_target / (1 - v_total/100))::numeric,2) else v_target end;
    v_final := case when v_total > 0 and v_draft.retention_pricing_mode = 'preserve_net' and v_draft.fiscal_review_confirmed then v_gross else v_target end;
    v_estimated := round((v_final * (1 - v_total/100))::numeric,2);

    update public.quote_drafts set
      retentions = v_ret,
      retention_total = v_total,
      retention_net_target = v_target,
      retention_gross_up_suggestion = v_gross,
      final_amount = v_final,
      estimated_net = v_estimated,
      fiscal_review_required = (v_total > 0),
      fiscal_review_confirmed = false,
      fiscal_review_confirmed_by = null,
      fiscal_review_confirmed_at = null,
      fiscal_engine_status = v_status,
      fiscal_engine_source = 'service_code',
      fiscal_engine_codes = to_jsonb(coalesce(v_codes,array[]::text[])),
      fiscal_engine_version = '2026-08-17.2',
      fiscal_engine_calculated_at = now(),
      updated_at = now()
    where id = v_draft.id;

    insert into public.quote_audit_log(request_id, actor_user_id, event_type, event_data)
    values (p_request_id, v_user, 'fiscal_engine_applied', jsonb_build_object('status',v_status,'codes',v_codes,'retentions',v_ret,'version','2026-08-17.2'));
  end if;

  return jsonb_build_object(
    'status',v_status,
    'applied',p_apply and v_status not in ('NO_SERVICES','NEEDS_CLASSIFICATION','NEEDS_SERVICE_RULE','NEEDS_ISSUER_PROFILE','NEEDS_ISSUER_RULES','NEEDS_CLIENT_FISCAL_PROFILE'),
    'serviceCodes',to_jsonb(coalesce(v_codes,array[]::text[])),
    'missingServiceKeys',to_jsonb(coalesce(v_missing_codes,array[]::text[])),
    'issuerRegime',v_issuer.tax_regime,
    'issuerMunicipality',v_issuer.municipality,
    'clientMunicipality',nullif(v_client_city,''),
    'municipalIssResponsibility',case when v_client.client_id is null then 'NAO_VERIFICADO' else v_client.municipal_iss_responsibility end,
    'retentions',v_ret,
    'retentionTotal',v_total,
    'explanations',v_explanations,
    'version','2026-08-17.2'
  );
end;
$$;

create or replace function public.hrx_quote_fiscal_after_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if new.retentions is distinct from old.retentions then return new; end if;
  perform public.hrx_calculate_quote_fiscal(new.request_id, true);
  return new;
end;
$$;

revoke all on function public.hrx_quote_fiscal_after_update() from public, anon, authenticated;

drop trigger if exists quote_drafts_auto_fiscal_engine on public.quote_drafts;
create trigger quote_drafts_auto_fiscal_engine
after update of base_amount, complexity_multiplier, urgency_multiplier, discount_percent, discount_amount, payment_provider, installments, payment_fee_total, retentions
on public.quote_drafts
for each row execute function public.hrx_quote_fiscal_after_update();
