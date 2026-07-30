create or replace function public.app_auth_rate_limit(p_key text, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_oldest timestamptz;
  v_retry_after_seconds int;
begin
  delete from public.auth_rate_limit_events where created_at < now() - interval '1 hour';
  select count(*), min(created_at)
  into v_count, v_oldest
  from public.auth_rate_limit_events
  where rate_key = p_key and action = p_action and created_at > now() - interval '15 minutes';
  if v_count >= 30 then
    v_retry_after_seconds := greatest(1, ceil(extract(epoch from (v_oldest + interval '15 minutes' - now())))::int);
    return jsonb_build_object('allowed', false, 'retry_after_seconds', v_retry_after_seconds);
  end if;
  insert into public.auth_rate_limit_events(rate_key, action) values (p_key, p_action);
  return jsonb_build_object('allowed', true);
end;
$$;
