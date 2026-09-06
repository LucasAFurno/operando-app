-- Lockdown: setup + platform RPCs solo via auth-gateway (service_role).
-- NO aplicar a prod hasta deploy gateway+front y smoke de crear cuenta.
-- Post-merge order: deploy gateway+front → probar alta → recién aplicar este REVOKE.

revoke all on function public.app_get_setup_status(text) from public;
revoke all on function public.app_get_setup_status(text) from anon;
revoke all on function public.app_get_setup_status(text) from authenticated;
grant execute on function public.app_get_setup_status(text) to service_role;

revoke all on function public.app_setup_instance(text, text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.app_setup_instance(text, text, text, text, text, text, text, text, text, text) from anon;
revoke all on function public.app_setup_instance(text, text, text, text, text, text, text, text, text, text) from authenticated;
grant execute on function public.app_setup_instance(text, text, text, text, text, text, text, text, text, text) to service_role;

revoke all on function public.app_public_platform_overview(text) from public;
revoke all on function public.app_public_platform_overview(text) from anon;
revoke all on function public.app_public_platform_overview(text) from authenticated;
grant execute on function public.app_public_platform_overview(text) to service_role;

revoke all on function public.app_public_platform_update_commerce(text, uuid, text, text, text, boolean, text, text, text, text, text) from public;
revoke all on function public.app_public_platform_update_commerce(text, uuid, text, text, text, boolean, text, text, text, text, text) from anon;
revoke all on function public.app_public_platform_update_commerce(text, uuid, text, text, text, boolean, text, text, text, text, text) from authenticated;
grant execute on function public.app_public_platform_update_commerce(text, uuid, text, text, text, boolean, text, text, text, text, text) to service_role;
