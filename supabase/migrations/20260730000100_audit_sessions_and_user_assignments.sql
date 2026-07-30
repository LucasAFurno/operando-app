-- La auditoría debe reflejar quién entra/sale y quién recibe acceso a un comercio.
-- No se almacenan tokens de sesión ni datos sensibles de autenticación.

create or replace function public.app_audit_user_session_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_payload jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := 'signed_in';
    v_payload := jsonb_build_object('user_id', new.user_id, 'event', 'signed_in', 'session_started_at', new.created_at);
  elsif old.revoked_at is null and new.revoked_at is not null then
    v_action := 'signed_out';
    v_payload := jsonb_build_object('user_id', new.user_id, 'event', 'signed_out', 'session_started_at', new.created_at, 'session_ended_at', new.revoked_at);
  else
    return new;
  end if;

  insert into public.audit_logs_core (commerce_id, actor_user_id, entity_type, entity_id, action, before_data, after_data)
  values (new.commerce_id, new.user_id, 'session', new.user_id, v_action, null, v_payload);
  return new;
end;
$$;

revoke all on function public.app_audit_user_session_change() from public, anon, authenticated;

drop trigger if exists audit_control_user_sessions_change on public.control_user_sessions;
create trigger audit_control_user_sessions_change
after insert or update of revoked_at on public.control_user_sessions
for each row execute function public.app_audit_user_session_change();

create or replace function public.app_audit_user_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_after jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_membership jsonb := coalesce(v_after, v_before);
  v_target_user_id uuid := public.app_try_uuid(v_membership ->> 'user_id');
  v_actor_user_id uuid := public.app_try_uuid(current_setting('app.audit_actor_id', true));
  v_target_name text;
  v_action text := case when tg_op = 'INSERT' then 'assigned' when tg_op = 'DELETE' then 'unassigned' else 'updated' end;
begin
  select full_name into v_target_name from public.control_users where id = v_target_user_id;
  v_before := case when v_before is null then null else v_before || jsonb_build_object('assigned_user_name', coalesce(v_target_name, 'Usuario')) end;
  v_after := case when v_after is null then null else v_after || jsonb_build_object('assigned_user_name', coalesce(v_target_name, 'Usuario')) end;

  insert into public.audit_logs_core (commerce_id, actor_user_id, entity_type, entity_id, action, before_data, after_data)
  values (
    public.app_try_uuid(v_membership ->> 'commerce_id'),
    coalesce(v_actor_user_id, v_target_user_id),
    'user_assignment',
    public.app_try_uuid(v_membership ->> 'id'),
    v_action,
    v_before,
    v_after
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.app_audit_user_assignment_change() from public, anon, authenticated;

drop trigger if exists audit_commerce_memberships_change on public.commerce_memberships;
create trigger audit_commerce_memberships_change
after insert or update or delete on public.commerce_memberships
for each row execute function public.app_audit_user_assignment_change();
