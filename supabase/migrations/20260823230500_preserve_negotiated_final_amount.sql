-- Corrige divergência entre valor final aprovado, parcelas e motor fiscal.
-- O motor fiscal continua recalculando retenções, mas não pode sobrescrever
-- um valor final comercial definido explicitamente pelo administrador.

create or replace function public.hrx_quote_fiscal_after_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_commercial numeric(14,2);
  v_retention_total numeric := 0;
  v_gross numeric(14,2);
  v_final numeric(14,2);
  v_custom numeric(14,2);
  v_mode text;
  v_confirmed boolean;
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if new.retentions is distinct from old.retentions then return new; end if;

  perform public.hrx_calculate_quote_fiscal(new.request_id, true);

  select
    round((coalesce(pre_discount_amount, 0)
      - coalesce(discount_amount, 0)
      + coalesce(tax_amount, 0)
      + coalesce(payment_fee_total, 0))::numeric, 2),
    coalesce(retention_total, 0),
    custom_final_amount,
    retention_pricing_mode,
    coalesce(fiscal_review_confirmed, false)
  into v_commercial, v_retention_total, v_custom, v_mode, v_confirmed
  from public.quote_drafts
  where id = new.id;

  if v_retention_total >= 100 then
    raise exception 'invalid_retention_total';
  end if;

  v_gross := case
    when v_retention_total > 0
      then round((v_commercial / (1 - v_retention_total / 100))::numeric, 2)
    else v_commercial
  end;

  v_final := coalesce(
    v_custom,
    case
      when v_retention_total > 0 and v_mode = 'preserve_net' and v_confirmed then v_gross
      else v_commercial
    end
  );

  update public.quote_drafts
  set retention_net_target = v_commercial,
      retention_gross_up_suggestion = v_gross,
      final_amount = v_final,
      estimated_net = round((v_final * (1 - v_retention_total / 100))::numeric, 2),
      updated_at = now()
  where id = new.id;

  return new;
end;
$$;

revoke all on function public.hrx_quote_fiscal_after_update() from public, anon, authenticated;
grant execute on function public.hrx_quote_fiscal_after_update() to service_role;

comment on function public.hrx_quote_fiscal_after_update() is
  'Recalcula o fiscal sem sobrescrever custom_final_amount e mantém final_amount coerente com imposto, taxas e parcelas.';
