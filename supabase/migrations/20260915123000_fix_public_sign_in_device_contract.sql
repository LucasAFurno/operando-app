-- The auth gateway sends a device hash so the login can flag first-seen devices.
-- Keep the original three-argument function as the source of authentication
-- rules and expose the four-argument contract used by the gateway.
create table if not exists public.control_user_known_devices (
  user_id uuid not null references public.control_users(id) on delete cascade,
  device_hash text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, device_hash)
);

create or replace function public.app_public_sign_in(
  p_instance_key text,
  p_identifier text,
  p_pin text,
  p_device_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_user_id uuid;
  v_new boolean := false;
begin
  v_result := public.app_public_sign_in(p_instance_key, p_identifier, p_pin);

  if nullif(v_result ->> 'session_token', '') is null then
    return v_result;
  end if;

  v_user_id := (v_result -> 'profile' ->> 'id')::uuid;
  if nullif(trim(coalesce(p_device_hash, '')), '') is not null then
    insert into public.control_user_known_devices(user_id, device_hash)
    values (v_user_id, p_device_hash)
    on conflict (user_id, device_hash) do update
      set last_seen_at = now()
    returning (xmax = 0) into v_new;
  end if;

  return v_result || jsonb_build_object('new_device', v_new);
end;
$$;

revoke all on public.control_user_known_devices from public, anon, authenticated;
revoke all on function public.app_public_sign_in(text, text, text, text) from public, anon, authenticated;
grant execute on function public.app_public_sign_in(text, text, text, text) to service_role;
