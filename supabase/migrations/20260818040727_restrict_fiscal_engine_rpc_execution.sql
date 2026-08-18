revoke execute on function public.hrx_calculate_quote_fiscal(uuid, boolean) from public;
revoke execute on function public.hrx_calculate_quote_fiscal(uuid, boolean) from anon;
revoke execute on function public.hrx_calculate_quote_fiscal(uuid, boolean) from authenticated;
grant execute on function public.hrx_calculate_quote_fiscal(uuid, boolean) to service_role;
