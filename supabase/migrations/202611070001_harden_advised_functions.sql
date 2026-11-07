-- Prevent browser roles from invoking the privileged RLS helper directly.
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;

-- Pin trigger name resolution instead of inheriting the caller's search path.
alter function public.calculate_srs_metrics()
  set search_path = public, pg_temp;
