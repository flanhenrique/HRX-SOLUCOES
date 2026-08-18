do $$
declare
  v_def text;
  v_guard text := E'begin\n  if v_role <> ''service_role'' and coalesce((coalesce(nullif(current_setting(''request.jwt.claims'', true), ''''), ''{}'')::jsonb ->> ''aal''), ''aal1'') <> ''aal2'' then\n    raise exception ''mfa_required'' using errcode = ''42501'';\n  end if;\n\n  if v_role';
begin
  v_def := pg_get_functiondef('public.hrx_calculate_quote_fiscal(uuid,boolean)'::regprocedure);
  if position('mfa_required' in v_def) = 0 then
    v_def := replace(v_def, E'begin\n  if v_role', v_guard);
    execute v_def;
  end if;
end $$;
