alter table public.control_users
  drop constraint if exists control_users_id_fkey;

alter table public.control_users
  add column if not exists login_name text,
  add column if not exists pin_hash text,
  add column if not exists last_login_at timestamptz;

create unique index if not exists idx_control_users_login_name
  on public.control_users (lower(login_name))
  where login_name is not null and btrim(login_name) <> '';

alter table public.commerce_accounts
  add column if not exists instance_key text;

create unique index if not exists idx_commerce_accounts_instance_key
  on public.commerce_accounts (lower(instance_key))
  where instance_key is not null and btrim(instance_key) <> '';

create table if not exists public.control_user_sessions (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.control_users(id) on delete cascade,
  commerce_id uuid not null references public.commerce_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_control_user_sessions_user_id on public.control_user_sessions(user_id);
create index if not exists idx_control_user_sessions_commerce_id on public.control_user_sessions(commerce_id);

-- Los intentos se guardan en el servidor para que el limite no pueda evitarse
-- borrando los datos locales o usando otro navegador.
create table if not exists public.control_user_login_attempts (
  user_id uuid primary key references public.control_users(id) on delete cascade,
  failed_attempts smallint not null default 0 check (failed_attempts between 0 and 3),
  last_failed_at timestamptz not null default now(),
  locked_until timestamptz
);

create index if not exists idx_control_user_login_attempts_locked_until
  on public.control_user_login_attempts(locked_until)
  where locked_until is not null;

create table if not exists public.control_user_password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.control_users(id) on delete cascade,
  email text not null,
  requested_at timestamptz not null default now(),
  status text not null default 'pending',
  channel text not null default 'email',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_control_user_password_reset_requests_user_id
  on public.control_user_password_reset_requests(user_id, requested_at desc);

create or replace function public.app_slugify(p_value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9]+', '-', 'g'))
$$;

create or replace function public.app_role_id(p_role_key text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_role_key, 'cashier'))
    when 'admin' then 'role-admin'
    when 'warehouse' then 'role-warehouse'
    else 'role-cashier'
  end
$$;

create or replace function public.app_role_key_from_role_id(p_role_id text, p_fallback text default 'cashier')
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_role_id, ''))
    when 'role-admin' then 'admin'
    when 'role-warehouse' then 'warehouse'
    when 'role-cashier' then 'cashier'
    else lower(coalesce(nullif(p_fallback, ''), 'cashier'))
  end
$$;

create or replace function public.app_pick_login(p_email text, p_login_name text, p_full_name text, p_user_id uuid)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(lower(trim(p_login_name)), ''),
    nullif(split_part(lower(trim(coalesce(p_email, ''))), '@', 1), ''),
    nullif(public.app_slugify(p_full_name), ''),
    'user-' || left(replace(coalesce(p_user_id::text, gen_random_uuid()::text), '-', ''), 10)
  )
$$;

create or replace function public.app_sign_amount(p_kind text, p_amount numeric)
returns numeric
language sql
immutable
as $$
  select case
    when lower(coalesce(p_kind, '')) in ('expense', 'withdrawal', 'refund') then -abs(coalesce(p_amount, 0))
    else abs(coalesce(p_amount, 0))
  end
$$;

create or replace function public.app_build_public_session_payload(
  p_token uuid,
  p_user_id uuid,
  p_commerce_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.control_users;
  v_membership public.commerce_memberships;
  v_commerce public.commerce_accounts;
begin
  select *
  into v_user
  from public.control_users
  where id = p_user_id;

  select *
  into v_membership
  from public.commerce_memberships
  where commerce_id = p_commerce_id
    and user_id = p_user_id
  order by is_owner desc, updated_at desc
  limit 1;

  select *
  into v_commerce
  from public.commerce_accounts
  where id = p_commerce_id;

  if v_user.id is null or v_membership.id is null or v_commerce.id is null then
    raise exception 'session_not_found';
  end if;

  return jsonb_build_object(
    'session_token', p_token,
    'profile', jsonb_build_object(
      'id', v_user.id,
      'email', v_user.email,
      'login_name', coalesce(v_user.login_name, ''),
      'full_name', v_user.full_name,
      'role_key', coalesce(v_membership.role_key, v_user.role_key, 'cashier'),
      'status', v_membership.status,
      'is_owner', coalesce(v_membership.is_owner, v_user.is_owner, false),
      'active_branch_id', v_user.active_branch_id,
      'assigned_register_id', v_user.assigned_register_id
    ),
    'commerce_context', jsonb_build_object(
      'commerce_id', v_commerce.id,
      'instance_key', v_commerce.instance_key,
      'commerce_name', v_commerce.name,
      'legal_name', v_commerce.legal_name,
      'owner_email', v_commerce.owner_email,
      'active_plan', v_commerce.active_plan,
      'status', v_commerce.status,
      'onboarding_country', v_commerce.onboarding_country,
      'onboarding_industry', v_commerce.onboarding_industry,
      'onboarding_phone', v_commerce.onboarding_phone,
      'onboarding_needs_arca', v_commerce.onboarding_needs_arca,
      'onboarding_goals', v_commerce.onboarding_goals,
      'onboarding_status', v_commerce.onboarding_status
    )
  );
end;
$$;

create or replace function public.app_get_setup_status(
  p_instance_key text default 'pclaf-dev'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commerce public.commerce_accounts;
  v_user_count integer := 0;
begin
  select *
  into v_commerce
  from public.commerce_accounts
  where lower(instance_key) = lower(coalesce(nullif(p_instance_key, ''), 'pclaf-dev'))
  limit 1;

  if v_commerce.id is not null then
    select count(*)
    into v_user_count
    from public.commerce_memberships membership
    join public.control_users user_row
      on user_row.id = membership.user_id
    where membership.commerce_id = v_commerce.id
      and membership.status in ('pending', 'active', 'disabled')
      and user_row.status in ('pending', 'active', 'disabled');
  end if;

  return jsonb_build_object(
    'initialized', v_commerce.id is not null and v_user_count > 0,
    'commerce_id', v_commerce.id,
    'commerce_name', coalesce(v_commerce.name, ''),
    'instance_key', coalesce(v_commerce.instance_key, lower(coalesce(nullif(p_instance_key, ''), 'pclaf-dev'))),
    'user_count', v_user_count
  );
end;
$$;

create or replace function public.app_setup_instance(
  p_instance_key text,
  p_commerce_name text,
  p_owner_name text,
  p_owner_login text,
  p_owner_email text,
  p_owner_pin text,
  p_branch_name text,
  p_branch_code text default 'CASA',
  p_register_name text default 'Caja 1',
  p_register_code text default 'CAJA-01'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance_key text := lower(coalesce(nullif(trim(p_instance_key), ''), 'pclaf-dev'));
  v_commerce public.commerce_accounts;
  v_existing_count integer := 0;
  v_user_id uuid := gen_random_uuid();
  v_branch_id uuid := gen_random_uuid();
  v_register_id uuid := gen_random_uuid();
  v_login_name text;
  v_token uuid;
begin
  if nullif(trim(coalesce(p_commerce_name, '')), '') is null then
    raise exception 'commerce_name_required';
  end if;
  if nullif(trim(coalesce(p_owner_name, '')), '') is null then
    raise exception 'owner_name_required';
  end if;
  if nullif(trim(coalesce(p_owner_email, '')), '') is null then
    raise exception 'owner_email_required';
  end if;
  if nullif(trim(coalesce(p_owner_pin, '')), '') is null or length(trim(p_owner_pin)) < 6 then
    raise exception 'owner_pin_too_short';
  end if;

  select *
  into v_commerce
  from public.commerce_accounts
  where lower(instance_key) = v_instance_key
  limit 1;

  if v_commerce.id is not null then
    select count(*)
    into v_existing_count
    from public.commerce_memberships
    where commerce_id = v_commerce.id;

    if v_existing_count > 0 then
      raise exception 'instance_already_initialized';
    end if;
  end if;

  v_login_name := public.app_pick_login(p_owner_email, p_owner_login, p_owner_name, v_user_id);

  if exists (
    select 1 from public.control_users
    where lower(coalesce(login_name, '')) = lower(v_login_name)
  ) then
    raise exception 'login_name_already_exists';
  end if;

  if exists (
    select 1 from public.control_users
    where lower(coalesce(email, '')) = lower(trim(coalesce(p_owner_email, '')))
  ) then
    raise exception 'owner_email_already_exists';
  end if;

  if v_commerce.id is null then
    insert into public.commerce_accounts (
      id,
      instance_key,
      name,
      slug,
      legal_name,
      owner_email,
      active_plan,
      status,
      settings_json
    )
    values (
      gen_random_uuid(),
      v_instance_key,
      trim(p_commerce_name),
      coalesce(nullif(public.app_slugify(p_commerce_name), ''), 'control') || '-' || v_instance_key,
      trim(coalesce(p_commerce_name, '')),
      lower(trim(coalesce(p_owner_email, ''))),
      'full',
      'active',
      jsonb_build_object(
        'enabledModules', jsonb_build_array('dashboard','customers','sales','cash','branches','registers','products','purchases','invoices','tickets','reports','settings'),
        'documentCounters', jsonb_build_object(
          'invoiceA', 1,
          'invoiceB', 1,
          'invoiceC', 1,
          'quote', 1,
          'remito', 1,
          'creditNoteA', 1,
          'creditNoteB', 1,
          'creditNoteC', 1,
          'receipt', 1,
          'ticket', 1
        )
      )
    )
    returning * into v_commerce;
  else
    update public.commerce_accounts
    set
      name = trim(p_commerce_name),
      legal_name = trim(coalesce(p_commerce_name, '')),
      owner_email = lower(trim(coalesce(p_owner_email, ''))),
      active_plan = 'full',
      status = 'active'
    where id = v_commerce.id
    returning * into v_commerce;
  end if;

  insert into public.control_users (
    id,
    email,
    login_name,
    full_name,
    role_key,
    status,
    is_owner,
    pin_hash,
    active_commerce_id,
    active_branch_id,
    assigned_register_id
  )
  values (
    v_user_id,
    lower(trim(coalesce(p_owner_email, ''))),
    v_login_name,
    trim(p_owner_name),
    'admin',
    'active',
    true,
      extensions.crypt(p_owner_pin, extensions.gen_salt('bf')),
    v_commerce.id,
    v_branch_id,
    v_register_id
  );

  insert into public.commerce_memberships (
    commerce_id,
    user_id,
    role_key,
    status,
    is_owner
  )
  values (
    v_commerce.id,
    v_user_id,
    'admin',
    'active',
    true
  );

  insert into public.branches (
    id,
    commerce_id,
    code,
    name,
    address,
    is_active
  )
  values (
    v_branch_id,
    v_commerce.id,
    upper(coalesce(nullif(trim(p_branch_code), ''), 'CASA')),
    trim(coalesce(p_branch_name, 'Casa central')),
    '',
    true
  );

  insert into public.registers (
    id,
    commerce_id,
    branch_id,
    code,
    name,
    cashier_user_id,
    is_active
  )
  values (
    v_register_id,
    v_commerce.id,
    v_branch_id,
    upper(coalesce(nullif(trim(p_register_code), ''), 'CAJA-01')),
    trim(coalesce(p_register_name, 'Caja 1')),
    v_user_id,
    true
  );

  insert into public.control_user_sessions (
    token,
    user_id,
    commerce_id
  )
  values (
    gen_random_uuid(),
    v_user_id,
    v_commerce.id
  )
  returning token into v_token;

  return public.app_build_public_session_payload(v_token, v_user_id, v_commerce.id);
end;
$$;

create or replace function public.app_public_sign_in(
  p_instance_key text,
  p_identifier text,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance_key text := lower(nullif(trim(coalesce(p_instance_key, '')), ''));
  v_identifier text := lower(trim(coalesce(p_identifier, '')));
  v_commerce public.commerce_accounts;
  v_user public.control_users;
  v_membership public.commerce_memberships;
  v_match_commerce_id uuid;
  v_match_user_id uuid;
  v_match_membership_id uuid;
  v_token uuid;
  v_login_attempt public.control_user_login_attempts;
begin
  if v_identifier = '' then
    raise exception 'identifier_required';
  end if;

  if v_instance_key is not null then
    select *
    into v_commerce
    from public.commerce_accounts
    where lower(instance_key) = v_instance_key
      and status = 'active'
    limit 1;

    if v_commerce.id is null then
      raise exception 'instance_not_initialized';
    end if;

    select user_row.*
    into v_user
    from public.control_users user_row
    join public.commerce_memberships membership
      on membership.user_id = user_row.id
     and membership.commerce_id = v_commerce.id
    where (
        lower(coalesce(user_row.login_name, '')) = v_identifier
        or lower(coalesce(user_row.email, '')) = v_identifier
        or lower(split_part(coalesce(user_row.email, ''), '@', 1)) = v_identifier
        or lower(coalesce(user_row.full_name, '')) = v_identifier
      )
    order by membership.is_owner desc, user_row.created_at asc
    limit 1;
  else
    select commerce_row.id, user_row.id, membership.id
    into v_match_commerce_id, v_match_user_id, v_match_membership_id
    from public.control_users user_row
    join public.commerce_memberships membership
      on membership.user_id = user_row.id
     and membership.status = 'active'
    join public.commerce_accounts commerce_row
      on commerce_row.id = membership.commerce_id
     and commerce_row.status = 'active'
     and lower(coalesce(commerce_row.instance_key, '')) <> 'pclaf-dev'
    where (
        lower(coalesce(user_row.email, '')) = v_identifier
      )
    order by
      case when user_row.active_commerce_id = commerce_row.id then 0 else 1 end,
      membership.is_owner desc,
      membership.updated_at desc,
      user_row.created_at asc
    limit 1;

    if v_match_commerce_id is not null then
      select * into v_commerce from public.commerce_accounts where id = v_match_commerce_id;
      select * into v_user from public.control_users where id = v_match_user_id;
      select * into v_membership from public.commerce_memberships where id = v_match_membership_id;
    end if;
  end if;

  if v_user.id is null then
    raise exception 'user_not_found';
  end if;

  if v_membership.id is null then
    select *
    into v_membership
    from public.commerce_memberships
    where commerce_id = v_commerce.id
      and user_id = v_user.id
    limit 1;
  end if;

  if v_user.status <> 'active' or v_membership.status <> 'active' then
    raise exception 'user_inactive';
  end if;

  select *
  into v_login_attempt
  from public.control_user_login_attempts
  where user_id = v_user.id
  for update;

  if v_login_attempt.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'login_locked');
  end if;

  -- Al terminar el bloqueo, el usuario vuelve a contar desde cero.
  if v_login_attempt.locked_until is not null then
    update public.control_user_login_attempts
    set failed_attempts = 0, locked_until = null
    where user_id = v_user.id;
  end if;

  if v_user.pin_hash is null or extensions.crypt(coalesce(p_pin, ''), v_user.pin_hash) <> v_user.pin_hash then
    insert into public.control_user_login_attempts as attempt (
      user_id,
      failed_attempts,
      last_failed_at,
      locked_until
    )
    values (v_user.id, 1, now(), null)
    on conflict (user_id) do update
    set
      failed_attempts = attempt.failed_attempts + 1,
      last_failed_at = now(),
      locked_until = case
        when attempt.failed_attempts + 1 >= 3 then now() + interval '15 minutes'
        else null
      end
    returning * into v_login_attempt;

    if v_login_attempt.locked_until is not null then
      return jsonb_build_object('ok', false, 'error', 'login_locked');
    end if;

    return jsonb_build_object(
      'ok', false,
      'error', format('invalid_pin_attempts_remaining_%s', 3 - v_login_attempt.failed_attempts)
    );
  end if;

  delete from public.control_user_login_attempts where user_id = v_user.id;

  insert into public.control_user_sessions (
    token,
    user_id,
    commerce_id
  )
  values (
    gen_random_uuid(),
    v_user.id,
    v_commerce.id
  )
  returning token into v_token;

  update public.control_users
  set
    last_login_at = now(),
    active_commerce_id = v_commerce.id
  where id = v_user.id;

  return public.app_build_public_session_payload(v_token, v_user.id, v_commerce.id);
end;
$$;

create or replace function public.app_public_restore_session(
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.control_user_sessions;
begin
  select *
  into v_session
  from public.control_user_sessions
  where token = public.app_try_uuid(p_session_token)
    and revoked_at is null
    and expires_at > now()
  limit 1;

  if v_session.token is null then
    raise exception 'session_not_found';
  end if;

  update public.control_user_sessions
  set last_seen_at = now()
  where token = v_session.token;

  return public.app_build_public_session_payload(v_session.token, v_session.user_id, v_session.commerce_id);
end;
$$;

create or replace function public.app_public_sign_out(
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid := public.app_try_uuid(p_session_token);
begin
  if v_token is not null then
    update public.control_user_sessions
    set revoked_at = now()
    where token = v_token
      and revoked_at is null;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.app_public_request_password_reset(
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user public.control_users;
begin
  if nullif(v_email, '') is null then
    raise exception 'email_required';
  end if;

  select *
  into v_user
  from public.control_users
  where lower(coalesce(email, '')) = v_email
  limit 1;

  if v_user.id is not null then
    insert into public.control_user_password_reset_requests (
      user_id,
      email,
      metadata
    )
    values (
      v_user.id,
      v_email,
      jsonb_build_object(
        'source', 'public_login',
        'delivery_status', 'pending_email_setup'
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'message', 'Si existe una cuenta con ese correo, te ayudaremos a recuperar el acceso.'
  );
end;
$$;

create or replace function public.app_public_export_snapshot(
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.control_user_sessions;
  v_user public.control_users;
  v_commerce public.commerce_accounts;
  v_roles jsonb := jsonb_build_array(
    jsonb_build_object('id', 'role-admin', 'key', 'admin', 'name', 'Administrador', 'permissions', jsonb_build_array('dashboard:view','customers:view','sales:view','cash:view','branches:view','registers:view','products:view','purchases:view','invoices:view','tickets:view','reports:view','settings:view')),
    jsonb_build_object('id', 'role-cashier', 'key', 'cashier', 'name', 'Caja', 'permissions', jsonb_build_array('dashboard:view','customers:view','sales:view','cash:view','invoices:view','reports:view')),
    jsonb_build_object('id', 'role-warehouse', 'key', 'warehouse', 'name', 'Deposito', 'permissions', jsonb_build_array('dashboard:view','products:view','purchases:view','tickets:view','reports:view'))
  );
begin
  select *
  into v_session
  from public.control_user_sessions
  where token = public.app_try_uuid(p_session_token)
    and revoked_at is null
    and expires_at > now()
  limit 1;

  if v_session.token is null then
    raise exception 'session_not_found';
  end if;

  select * into v_user from public.control_users where id = v_session.user_id;
  select * into v_commerce from public.commerce_accounts where id = v_session.commerce_id;

  return jsonb_build_object(
    'meta', jsonb_build_object(
      'schemaVersion', 4,
      'edition', 'cloud-core',
      'adapter', 'supabase-core',
      'syncStatus', 'online',
      'lastSyncedAt', now(),
      'instanceKey', v_commerce.instance_key
    ),
    'business', jsonb_build_object(
      'name', v_commerce.name,
      'organization', 'PCLAF',
      'currentBranchId', coalesce(v_user.active_branch_id, (select id from public.branches where commerce_id = v_commerce.id order by created_at asc limit 1)),
      'currentRegisterId', coalesce(v_user.assigned_register_id, (select id from public.registers where commerce_id = v_commerce.id order by created_at asc limit 1)),
      'enabledModules', coalesce(v_commerce.settings_json -> 'enabledModules', jsonb_build_array('dashboard','customers','sales','cash','branches','registers','products','purchases','invoices','tickets','reports','settings')),
      'activePlan', v_commerce.active_plan,
      'progressiveProfile', jsonb_build_object(
        'country', v_commerce.onboarding_country,
        'industry', v_commerce.onboarding_industry,
        'phone', v_commerce.onboarding_phone,
        'needsArca', v_commerce.onboarding_needs_arca,
        'operationalGoals', v_commerce.onboarding_goals,
        'status', v_commerce.onboarding_status
      ),
      'documentCounters', coalesce(v_commerce.settings_json -> 'documentCounters', '{}'::jsonb)
    ),
    'branches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'code', code,
        'address', address,
        'isActive', is_active
      ) order by created_at asc)
      from public.branches
      where commerce_id = v_commerce.id
    ), '[]'::jsonb),
    'registers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'branchId', branch_id,
        'name', name,
        'code', code,
        'cashierUserId', cashier_user_id,
        'isActive', is_active
      ) order by created_at asc)
      from public.registers
      where commerce_id = v_commerce.id
    ), '[]'::jsonb),
    'roles', v_roles,
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cu.id,
        'fullName', cu.full_name,
        'roleId', public.app_role_id(coalesce(cm.role_key, cu.role_key)),
        'roleKey', coalesce(cm.role_key, cu.role_key),
        'email', cu.email,
        'loginName', coalesce(cu.login_name, ''),
        'pin', '',
        'isActive', (cu.status = 'active' and coalesce(cm.status, 'active') = 'active')
      ) order by cm.is_owner desc, cu.created_at asc)
      from public.control_users cu
      join public.commerce_memberships cm
        on cm.user_id = cu.id
       and cm.commerce_id = v_commerce.id
    ), '[]'::jsonb),
    'session', jsonb_build_object(
      'userId', v_user.id,
      'authenticated', true
    ),
    'customers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'fullName', full_name,
        'phone', phone,
        'email', email,
        'balance', balance,
        'tag', tag
      ) order by created_at asc)
      from public.customers
      where commerce_id = v_commerce.id
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'sku', p.sku,
        'barcode', p.barcode,
        'stock', coalesce((select sum(quantity) from public.product_branch_stock where product_id = p.id), 0),
        'salePrice', p.sale_price,
        'costPrice', p.cost_price,
        'minStock', p.min_stock,
        'category', p.category,
        'trackStock', p.track_stock,
        'stockByBranch', coalesce((
          select jsonb_object_agg(branch_id::text, quantity)
          from public.product_branch_stock
          where product_id = p.id
        ), '{}'::jsonb)
      ) order by p.created_at asc)
      from public.products p
      where p.commerce_id = v_commerce.id
    ), '[]'::jsonb),
    'suppliers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'contact', contact,
        'phone', phone,
        'email', email,
        'category', category,
        'balance', balance,
        'lastDelivery', last_delivery,
        'notes', notes
      ) order by created_at asc)
      from public.suppliers
      where commerce_id = v_commerce.id
    ), '[]'::jsonb),
    'cashSessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'openedBy', opened_by,
        'openingAmount', opening_amount,
        'status', status,
        'openedAt', opened_at,
        'closedAt', closed_at,
        'countedAmount', counted_amount,
        'differenceAmount', difference_amount,
        'branchId', branch_id,
        'registerId', register_id
      ) order by opened_at desc)
      from public.cash_sessions
      where commerce_id = v_commerce.id
    ), '[]'::jsonb),
    'purchaseReceipts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'branchId', branch_id,
        'supplierId', supplier_id,
        'productId', product_id,
        'receivedBy', received_by,
        'documentNumber', document_number,
        'quantity', quantity,
        'unitCost', unit_cost,
        'note', note,
        'receivedAt', received_at,
        'updatedAt', updated_at
      ) order by received_at desc)
      from public.purchase_receipts
      where commerce_id = v_commerce.id
    ), '[]'::jsonb),
    'sales', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'branchId', s.branch_id,
        'registerId', s.register_id,
        'sellerUserId', s.seller_user_id,
        'customerId', s.customer_id,
        'cashSessionId', s.cash_session_id,
        'channel', initcap(s.channel),
        'paymentMethod', s.payment_method,
        'status', s.status,
        'subtotalAmount', s.subtotal_amount,
        'discountAmount', s.discount_amount,
        'totalAmount', s.total_amount,
        'amountPaid', s.amount_paid,
        'note', s.note,
        'soldAt', s.sold_at,
        'updatedAt', s.updated_at,
        'paymentBreakdown', coalesce((
          select jsonb_object_agg(method_key, amount)
          from public.sale_payments
          where sale_id = s.id
        ), '{}'::jsonb),
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'productId', product_id,
            'quantity', quantity,
            'unitPrice', unit_price,
            'lineTotal', line_total
          ) order by id asc)
          from public.sale_items
          where sale_id = s.id
        ), '[]'::jsonb)
      ) order by s.sold_at desc)
      from public.sales s
      where s.commerce_id = v_commerce.id
    ), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'branchId', branch_id,
        'saleId', sale_id,
        'customerId', customer_id,
        'number', document_number,
        'kind', kind,
        'type', fiscal_type,
        'status', status,
        'fiscalStatus', fiscal_status,
        'totalAmount', total_amount,
        'dueDate', issued_at::date,
        'issuedAt', issued_at,
        'updatedAt', updated_at
      ) order by issued_at desc)
      from public.documents
      where commerce_id = v_commerce.id
        and kind in ('factura', 'presupuesto', 'remito', 'nota_credito')
    ), '[]'::jsonb),
    'tickets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'branchId', branch_id,
        'saleId', sale_id,
        'customerId', customer_id,
        'number', document_number,
        'device', coalesce(payload_json ->> 'device', ''),
        'issue', coalesce(payload_json ->> 'issue', ''),
        'status', status,
        'updatedAt', updated_at
      ) order by updated_at desc)
      from public.documents
      where commerce_id = v_commerce.id
        and kind in ('ticket', 'postventa')
    ), '[]'::jsonb),
    'cashMovements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'branchId', branch_id,
        'registerId', register_id,
        'cashSessionId', cash_session_id,
        'createdBy', created_by,
        'kind', kind,
        'amount', amount,
        'signedAmount', signed_amount,
        'note', note,
        'createdAt', created_at
      ) order by created_at desc)
      from public.cash_movements
      where commerce_id = v_commerce.id
    ), '[]'::jsonb),
    'stockMovements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'branchId', branch_id,
        'productId', product_id,
        'referenceId', reference_id,
        'type', movement_type,
        'movementType', movement_type,
        'referenceType', reference_type,
        'quantity', quantity,
        'notes', notes,
        'createdBy', created_by,
        'createdAt', created_at
      ) order by created_at desc)
      from public.stock_movements
      where commerce_id = v_commerce.id
    ), '[]'::jsonb),
    'auditLogs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'actorUserId', actor_user_id,
        'entityType', entity_type,
        'entityId', entity_id,
        'action', action,
        'beforeData', before_data,
        'afterData', after_data,
        'createdAt', created_at
      ) order by created_at desc)
      from public.audit_logs_core
      where commerce_id = v_commerce.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.app_public_save_snapshot(
  p_session_token text,
  p_state_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.control_user_sessions;
  v_actor public.control_users;
  v_commerce public.commerce_accounts;
  v_business jsonb := coalesce(p_state_json -> 'business', '{}'::jsonb);
  v_branch jsonb;
  v_register jsonb;
  v_user jsonb;
  v_customer jsonb;
  v_supplier jsonb;
  v_product jsonb;
  v_sale jsonb;
  v_sale_item jsonb;
  v_payment_key text;
  v_payment_value jsonb;
  v_receipt jsonb;
  v_invoice jsonb;
  v_ticket jsonb;
  v_cash_session jsonb;
  v_cash_movement jsonb;
  v_stock_movement jsonb;
  v_audit jsonb;
  v_role_key text;
  v_user_id uuid;
  v_login_name text;
  v_pin_hash text;
begin
  select *
  into v_session
  from public.control_user_sessions
  where token = public.app_try_uuid(p_session_token)
    and revoked_at is null
    and expires_at > now()
  limit 1;

  if v_session.token is null then
    raise exception 'session_not_found';
  end if;

  select * into v_actor from public.control_users where id = v_session.user_id;
  select * into v_commerce from public.commerce_accounts where id = v_session.commerce_id;

  if v_actor.status <> 'active' then
    raise exception 'actor_inactive';
  end if;

  update public.commerce_accounts
  set
    name = coalesce(nullif(v_business ->> 'name', ''), v_commerce.name),
    active_plan = coalesce(nullif(v_business ->> 'activePlan', ''), v_commerce.active_plan),
    settings_json = jsonb_strip_nulls(coalesce(settings_json, '{}'::jsonb) || jsonb_build_object(
      'enabledModules', coalesce(v_business -> 'enabledModules', settings_json -> 'enabledModules', jsonb_build_array('dashboard','customers','sales','cash','branches','registers','products','purchases','invoices','tickets','reports','settings')),
      'documentCounters', coalesce(v_business -> 'documentCounters', settings_json -> 'documentCounters', '{}'::jsonb)
    )),
    updated_at = now()
  where id = v_commerce.id
  returning * into v_commerce;

  delete from public.audit_logs_core where commerce_id = v_commerce.id;
  delete from public.stock_movements where commerce_id = v_commerce.id;
  delete from public.documents where commerce_id = v_commerce.id;
  delete from public.purchase_receipts where commerce_id = v_commerce.id;
  delete from public.sale_payments where commerce_id = v_commerce.id;
  delete from public.sale_items where commerce_id = v_commerce.id;
  delete from public.sales where commerce_id = v_commerce.id;
  delete from public.cash_movements where commerce_id = v_commerce.id;
  delete from public.cash_sessions where commerce_id = v_commerce.id;
  delete from public.product_branch_stock where commerce_id = v_commerce.id;
  delete from public.products where commerce_id = v_commerce.id;
  delete from public.suppliers where commerce_id = v_commerce.id;
  delete from public.customers where commerce_id = v_commerce.id;
  delete from public.registers where commerce_id = v_commerce.id;
  delete from public.branches where commerce_id = v_commerce.id;
  delete from public.commerce_memberships where commerce_id = v_commerce.id;

  for v_user in
    select value from jsonb_array_elements(coalesce(p_state_json -> 'users', '[]'::jsonb))
  loop
    v_user_id := coalesce(public.app_try_uuid(v_user ->> 'id'), gen_random_uuid());
    v_role_key := public.app_role_key_from_role_id(v_user ->> 'roleId', coalesce(v_user ->> 'roleKey', 'cashier'));
    v_login_name := public.app_pick_login(v_user ->> 'email', v_user ->> 'loginName', v_user ->> 'fullName', v_user_id);
    v_pin_hash := case
      when nullif(v_user ->> 'pin', '') is not null then extensions.crypt(v_user ->> 'pin', extensions.gen_salt('bf'))
      else null
    end;

    insert into public.control_users (
      id,
      email,
      login_name,
      full_name,
      role_key,
      status,
      is_owner,
      pin_hash,
      active_commerce_id,
      active_branch_id,
      assigned_register_id
    )
    values (
      v_user_id,
      lower(coalesce(v_user ->> 'email', '')),
      v_login_name,
      coalesce(v_user ->> 'fullName', 'Usuario'),
      v_role_key,
      case when coalesce((v_user ->> 'isActive')::boolean, true) then 'active' else 'disabled' end,
      (v_user_id = v_actor.id),
      v_pin_hash,
      v_commerce.id,
      public.app_try_uuid(v_business ->> 'currentBranchId'),
      public.app_try_uuid(v_business ->> 'currentRegisterId')
    )
    on conflict (id) do update
    set
      email = excluded.email,
      login_name = excluded.login_name,
      full_name = excluded.full_name,
      role_key = excluded.role_key,
      status = excluded.status,
      is_owner = public.control_users.is_owner or excluded.is_owner,
      pin_hash = coalesce(excluded.pin_hash, public.control_users.pin_hash),
      active_commerce_id = excluded.active_commerce_id,
      active_branch_id = coalesce(excluded.active_branch_id, public.control_users.active_branch_id),
      assigned_register_id = coalesce(excluded.assigned_register_id, public.control_users.assigned_register_id);

    insert into public.commerce_memberships (
      commerce_id,
      user_id,
      role_key,
      status,
      is_owner
    )
    values (
      v_commerce.id,
      v_user_id,
      v_role_key,
      case when coalesce((v_user ->> 'isActive')::boolean, true) then 'active' else 'disabled' end,
      (v_user_id = v_actor.id)
    );
  end loop;

  for v_branch in
    select value from jsonb_array_elements(coalesce(p_state_json -> 'branches', '[]'::jsonb))
  loop
    insert into public.branches (id, commerce_id, code, name, address, is_active)
    values (
      coalesce(public.app_try_uuid(v_branch ->> 'id'), gen_random_uuid()),
      v_commerce.id,
      upper(coalesce(v_branch ->> 'code', 'SUC')),
      coalesce(v_branch ->> 'name', 'Sucursal'),
      coalesce(v_branch ->> 'address', ''),
      coalesce((v_branch ->> 'isActive')::boolean, true)
    );
  end loop;

  for v_register in
    select value from jsonb_array_elements(coalesce(p_state_json -> 'registers', '[]'::jsonb))
  loop
    insert into public.registers (id, commerce_id, branch_id, code, name, cashier_user_id, is_active)
    values (
      coalesce(public.app_try_uuid(v_register ->> 'id'), gen_random_uuid()),
      v_commerce.id,
      coalesce(public.app_try_uuid(v_register ->> 'branchId'), (select id from public.branches where commerce_id = v_commerce.id order by created_at asc limit 1)),
      upper(coalesce(v_register ->> 'code', 'CAJA')),
      coalesce(v_register ->> 'name', 'Caja'),
      public.app_try_uuid(v_register ->> 'cashierUserId'),
      coalesce((v_register ->> 'isActive')::boolean, true)
    );
  end loop;

  for v_customer in
    select value from jsonb_array_elements(coalesce(p_state_json -> 'customers', '[]'::jsonb))
  loop
    insert into public.customers (id, commerce_id, full_name, phone, email, balance, tag, notes, is_active)
    values (
      coalesce(public.app_try_uuid(v_customer ->> 'id'), gen_random_uuid()),
      v_commerce.id,
      coalesce(v_customer ->> 'fullName', 'Cliente'),
      coalesce(v_customer ->> 'phone', ''),
      lower(coalesce(v_customer ->> 'email', '')),
      coalesce((v_customer ->> 'balance')::numeric, 0),
      coalesce(v_customer ->> 'tag', ''),
      coalesce(v_customer ->> 'notes', ''),
      true
    );
  end loop;

  for v_supplier in
    select value from jsonb_array_elements(coalesce(p_state_json -> 'suppliers', '[]'::jsonb))
  loop
    insert into public.suppliers (id, commerce_id, name, contact, phone, email, category, balance, last_delivery, notes, is_active)
    values (
      coalesce(public.app_try_uuid(v_supplier ->> 'id'), gen_random_uuid()),
      v_commerce.id,
      coalesce(v_supplier ->> 'name', 'Proveedor'),
      coalesce(v_supplier ->> 'contact', ''),
      coalesce(v_supplier ->> 'phone', ''),
      lower(coalesce(v_supplier ->> 'email', '')),
      coalesce(v_supplier ->> 'category', ''),
      coalesce((v_supplier ->> 'balance')::numeric, 0),
      nullif(v_supplier ->> 'lastDelivery', '')::date,
      coalesce(v_supplier ->> 'notes', ''),
      true
    );
  end loop;

  for v_product in
    select value from jsonb_array_elements(coalesce(p_state_json -> 'products', '[]'::jsonb))
  loop
    insert into public.products (id, commerce_id, sku, barcode, name, category, sale_price, cost_price, min_stock, track_stock, is_active)
    values (
      coalesce(public.app_try_uuid(v_product ->> 'id'), gen_random_uuid()),
      v_commerce.id,
      coalesce(v_product ->> 'sku', ''),
      coalesce(v_product ->> 'barcode', ''),
      coalesce(v_product ->> 'name', 'Producto'),
      coalesce(v_product ->> 'category', ''),
      coalesce((v_product ->> 'salePrice')::numeric, 0),
      coalesce((v_product ->> 'costPrice')::numeric, 0),
      coalesce((v_product ->> 'minStock')::numeric, 0),
      coalesce((v_product ->> 'trackStock')::boolean, true),
      true
    );

    if jsonb_typeof(v_product -> 'stockByBranch') = 'object' then
      insert into public.product_branch_stock (commerce_id, product_id, branch_id, quantity)
      select
        v_commerce.id,
        coalesce(public.app_try_uuid(v_product ->> 'id'), gen_random_uuid()),
        key::uuid,
        coalesce(value::numeric, 0)
      from jsonb_each_text(v_product -> 'stockByBranch')
      where public.app_try_uuid(key) is not null;
    else
      insert into public.product_branch_stock (commerce_id, product_id, branch_id, quantity)
      values (
        v_commerce.id,
        coalesce(public.app_try_uuid(v_product ->> 'id'), gen_random_uuid()),
        coalesce(public.app_try_uuid(v_business ->> 'currentBranchId'), (select id from public.branches where commerce_id = v_commerce.id order by created_at asc limit 1)),
        coalesce((v_product ->> 'stock')::numeric, 0)
      );
    end if;
  end loop;

  for v_cash_session in
    select value from jsonb_array_elements(coalesce(p_state_json -> 'cashSessions', '[]'::jsonb))
  loop
    insert into public.cash_sessions (
      id, commerce_id, branch_id, register_id, opened_by, closed_by, opening_amount, counted_amount, expected_amount, difference_amount, status, opened_at, closed_at
    )
    values (
      coalesce(public.app_try_uuid(v_cash_session ->> 'id'), gen_random_uuid()),
      v_commerce.id,
      coalesce(public.app_try_uuid(v_cash_session ->> 'branchId'), (select id from public.branches where commerce_id = v_commerce.id order by created_at asc limit 1)),
      coalesce(public.app_try_uuid(v_cash_session ->> 'registerId'), (select id from public.registers where commerce_id = v_commerce.id order by created_at asc limit 1)),
      public.app_try_uuid(v_cash_session ->> 'openedBy'),
      v_actor.id,
      coalesce((v_cash_session ->> 'openingAmount')::numeric, 0),
      nullif(v_cash_session ->> 'countedAmount', '')::numeric,
      nullif(v_cash_session ->> 'expectedAmount', '')::numeric,
      nullif(v_cash_session ->> 'differenceAmount', '')::numeric,
      coalesce(v_cash_session ->> 'status', 'open'),
      coalesce(nullif(v_cash_session ->> 'openedAt', '')::timestamptz, now()),
      nullif(v_cash_session ->> 'closedAt', '')::timestamptz
    );
  end loop;

  for v_cash_movement in
    select value from jsonb_array_elements(coalesce(p_state_json -> 'cashMovements', '[]'::jsonb))
  loop
    insert into public.cash_movements (
      id, commerce_id, branch_id, register_id, cash_session_id, created_by, kind, amount, signed_amount, note, created_at
    )
    values (
      coalesce(public.app_try_uuid(v_cash_movement ->> 'id'), gen_random_uuid()),
      v_commerce.id,
      coalesce(public.app_try_uuid(v_cash_movement ->> 'branchId'), (select id from public.branches where commerce_id = v_commerce.id order by created_at asc limit 1)),
      public.app_try_uuid(v_cash_movement ->> 'registerId'),
      public.app_try_uuid(v_cash_movement ->> 'cashSessionId'),
      coalesce(public.app_try_uuid(v_cash_movement ->> 'createdBy'), v_actor.id),
      coalesce(v_cash_movement ->> 'kind', 'adjustment'),
      coalesce((v_cash_movement ->> 'amount')::numeric, 0),
      coalesce((v_cash_movement ->> 'signedAmount')::numeric, public.app_sign_amount(v_cash_movement ->> 'kind', (v_cash_movement ->> 'amount')::numeric)),
      coalesce(v_cash_movement ->> 'note', ''),
      coalesce(nullif(v_cash_movement ->> 'createdAt', '')::timestamptz, now())
    );
  end loop;

  for v_sale in
    select value from jsonb_array_elements(coalesce(p_state_json -> 'sales', '[]'::jsonb))
  loop
    insert into public.sales (
      id, commerce_id, branch_id, register_id, seller_user_id, customer_id, cash_session_id, channel, payment_method, status, subtotal_amount, discount_amount, total_amount, amount_paid, total_quantity, note, sold_at, updated_at
    )
    values (
      coalesce(public.app_try_uuid(v_sale ->> 'id'), gen_random_uuid()),
      v_commerce.id,
      coalesce(public.app_try_uuid(v_sale ->> 'branchId'), (select id from public.branches where commerce_id = v_commerce.id order by created_at asc limit 1)),
      public.app_try_uuid(v_sale ->> 'registerId'),
      coalesce(public.app_try_uuid(v_sale ->> 'sellerUserId'), v_actor.id),
      public.app_try_uuid(v_sale ->> 'customerId'),
      public.app_try_uuid(v_sale ->> 'cashSessionId'),
      lower(coalesce(v_sale ->> 'channel', 'mostrador')),
      coalesce(v_sale ->> 'paymentMethod', 'cash'),
      coalesce(v_sale ->> 'status', 'pending'),
      coalesce((v_sale ->> 'subtotalAmount')::numeric, coalesce((v_sale ->> 'totalAmount')::numeric, 0) + coalesce((v_sale ->> 'discountAmount')::numeric, 0)),
      coalesce((v_sale ->> 'discountAmount')::numeric, 0),
      coalesce((v_sale ->> 'totalAmount')::numeric, 0),
      coalesce((v_sale ->> 'amountPaid')::numeric, 0),
      coalesce((v_sale ->> 'totalQuantity')::numeric, 0),
      coalesce(v_sale ->> 'note', ''),
      coalesce(nullif(v_sale ->> 'soldAt', '')::timestamptz, now()),
      coalesce(nullif(v_sale ->> 'updatedAt', '')::timestamptz, now())
    );

    for v_sale_item in
      select value from jsonb_array_elements(coalesce(v_sale -> 'items', '[]'::jsonb))
    loop
      insert into public.sale_items (
        commerce_id, sale_id, product_id, quantity, unit_price, line_total
      )
      values (
        v_commerce.id,
        coalesce(public.app_try_uuid(v_sale ->> 'id'), gen_random_uuid()),
        public.app_try_uuid(v_sale_item ->> 'productId'),
        coalesce((v_sale_item ->> 'quantity')::numeric, 0),
        coalesce((v_sale_item ->> 'unitPrice')::numeric, 0),
        coalesce((v_sale_item ->> 'lineTotal')::numeric, 0)
      );
    end loop;

    if jsonb_typeof(v_sale -> 'paymentBreakdown') = 'object' then
      for v_payment_key, v_payment_value in
        select key, value from jsonb_each(v_sale -> 'paymentBreakdown')
      loop
        insert into public.sale_payments (
          commerce_id, sale_id, method_key, amount
        )
        values (
          v_commerce.id,
          coalesce(public.app_try_uuid(v_sale ->> 'id'), gen_random_uuid()),
          v_payment_key,
          coalesce((v_payment_value #>> '{}')::numeric, 0)
        );
      end loop;
    elsif coalesce((v_sale ->> 'amountPaid')::numeric, 0) > 0 then
      insert into public.sale_payments (
        commerce_id, sale_id, method_key, amount
      )
      values (
        v_commerce.id,
        coalesce(public.app_try_uuid(v_sale ->> 'id'), gen_random_uuid()),
        coalesce(v_sale ->> 'paymentMethod', 'cash'),
        coalesce((v_sale ->> 'amountPaid')::numeric, 0)
      );
    end if;
  end loop;

  for v_receipt in
    select value from jsonb_array_elements(coalesce(p_state_json -> 'purchaseReceipts', '[]'::jsonb))
  loop
    insert into public.purchase_receipts (
      id, commerce_id, branch_id, supplier_id, product_id, received_by, document_number, quantity, unit_cost, total_cost, note, received_at, updated_at
    )
    values (
      coalesce(public.app_try_uuid(v_receipt ->> 'id'), gen_random_uuid()),
      v_commerce.id,
      coalesce(public.app_try_uuid(v_receipt ->> 'branchId'), (select id from public.branches where commerce_id = v_commerce.id order by created_at asc limit 1)),
      public.app_try_uuid(v_receipt ->> 'supplierId'),
      public.app_try_uuid(v_receipt ->> 'productId'),
      coalesce(public.app_try_uuid(v_receipt ->> 'receivedBy'), v_actor.id),
      coalesce(v_receipt ->> 'documentNumber', ''),
      coalesce((v_receipt ->> 'quantity')::numeric, 0),
      coalesce((v_receipt ->> 'unitCost')::numeric, 0),
      coalesce((v_receipt ->> 'quantity')::numeric, 0) * coalesce((v_receipt ->> 'unitCost')::numeric, 0),
      coalesce(v_receipt ->> 'note', ''),
      coalesce(nullif(v_receipt ->> 'receivedAt', '')::timestamptz, now()),
      coalesce(nullif(v_receipt ->> 'updatedAt', '')::timestamptz, now())
    );
  end loop;

  for v_invoice in
    select value from jsonb_array_elements(coalesce(p_state_json -> 'invoices', '[]'::jsonb))
  loop
    insert into public.documents (
      id, commerce_id, branch_id, sale_id, customer_id, document_number, kind, fiscal_type, status, fiscal_status, total_amount, payload_json, issued_at, updated_at
    )
    values (
      coalesce(public.app_try_uuid(v_invoice ->> 'id'), gen_random_uuid()),
      v_commerce.id,
      coalesce(public.app_try_uuid(v_invoice ->> 'branchId'), (select id from public.branches where commerce_id = v_commerce.id order by created_at asc limit 1)),
      public.app_try_uuid(v_invoice ->> 'saleId'),
      public.app_try_uuid(v_invoice ->> 'customerId'),
      coalesce(v_invoice ->> 'number', 'DOC-' || floor(random() * 100000)::text),
      coalesce(v_invoice ->> 'kind', 'factura'),
      coalesce(v_invoice ->> 'type', 'B'),
      coalesce(v_invoice ->> 'status', 'emitida'),
      coalesce(v_invoice ->> 'fiscalStatus', 'pendiente'),
      coalesce((v_invoice ->> 'totalAmount')::numeric, 0),
      coalesce(v_invoice -> 'payload_json', '{}'::jsonb),
      coalesce(nullif(v_invoice ->> 'issuedAt', '')::timestamptz, nullif(v_invoice ->> 'dueDate', '')::timestamptz, now()),
      coalesce(nullif(v_invoice ->> 'updatedAt', '')::timestamptz, now())
    );
  end loop;

  for v_ticket in
    select value from jsonb_array_elements(coalesce(p_state_json -> 'tickets', '[]'::jsonb))
  loop
    insert into public.documents (
      id, commerce_id, branch_id, sale_id, customer_id, document_number, kind, fiscal_type, status, fiscal_status, total_amount, payload_json, issued_at, updated_at
    )
    values (
      coalesce(public.app_try_uuid(v_ticket ->> 'id'), gen_random_uuid()),
      v_commerce.id,
      coalesce(public.app_try_uuid(v_ticket ->> 'branchId'), (select id from public.branches where commerce_id = v_commerce.id order by created_at asc limit 1)),
      public.app_try_uuid(v_ticket ->> 'saleId'),
      public.app_try_uuid(v_ticket ->> 'customerId'),
      coalesce(v_ticket ->> 'number', 'TICK-' || floor(random() * 100000)::text),
      'ticket',
      'B',
      coalesce(v_ticket ->> 'status', 'emitida'),
      'pendiente',
      0,
      jsonb_build_object(
        'device', coalesce(v_ticket ->> 'device', ''),
        'issue', coalesce(v_ticket ->> 'issue', '')
      ),
      coalesce(nullif(v_ticket ->> 'issuedAt', '')::timestamptz, now()),
      coalesce(nullif(v_ticket ->> 'updatedAt', '')::timestamptz, now())
    );
  end loop;

  for v_stock_movement in
    select value from jsonb_array_elements(coalesce(p_state_json -> 'stockMovements', '[]'::jsonb))
  loop
    insert into public.stock_movements (
      id, commerce_id, branch_id, product_id, reference_id, reference_type, movement_type, quantity, notes, created_by, created_at
    )
    values (
      coalesce(public.app_try_uuid(v_stock_movement ->> 'id'), gen_random_uuid()),
      v_commerce.id,
      public.app_try_uuid(v_stock_movement ->> 'branchId'),
      public.app_try_uuid(v_stock_movement ->> 'productId'),
      public.app_try_uuid(v_stock_movement ->> 'referenceId'),
      coalesce(v_stock_movement ->> 'referenceType', 'snapshot'),
      coalesce(v_stock_movement ->> 'movementType', v_stock_movement ->> 'type', 'adjustment_in'),
      coalesce((v_stock_movement ->> 'quantity')::numeric, 0),
      coalesce(v_stock_movement ->> 'notes', ''),
      coalesce(public.app_try_uuid(v_stock_movement ->> 'createdBy'), v_actor.id),
      coalesce(nullif(v_stock_movement ->> 'createdAt', '')::timestamptz, now())
    );
  end loop;

  for v_audit in
    select value from jsonb_array_elements(coalesce(p_state_json -> 'auditLogs', '[]'::jsonb))
  loop
    insert into public.audit_logs_core (
      id, commerce_id, actor_user_id, entity_type, entity_id, action, before_data, after_data, created_at
    )
    values (
      coalesce(public.app_try_uuid(v_audit ->> 'id'), gen_random_uuid()),
      v_commerce.id,
      public.app_try_uuid(v_audit ->> 'actorUserId'),
      coalesce(v_audit ->> 'entityType', 'system'),
      public.app_try_uuid(v_audit ->> 'entityId'),
      coalesce(v_audit ->> 'action', 'updated'),
      v_audit -> 'beforeData',
      v_audit -> 'afterData',
      coalesce(nullif(v_audit ->> 'createdAt', '')::timestamptz, now())
    );
  end loop;

  update public.control_users
  set
    active_commerce_id = v_commerce.id,
    active_branch_id = public.app_try_uuid(v_business ->> 'currentBranchId'),
    assigned_register_id = public.app_try_uuid(v_business ->> 'currentRegisterId')
  where id = v_actor.id;

  update public.control_user_sessions
  set last_seen_at = now()
  where token = v_session.token;

  return jsonb_build_object('ok', true, 'saved_at', now(), 'commerce_id', v_commerce.id);
end;
$$;

revoke all on public.control_user_sessions from public;
revoke all on public.control_user_login_attempts from public, anon, authenticated;

revoke all on function public.app_build_public_session_payload(uuid, uuid, uuid) from public;
revoke all on function public.app_get_setup_status(text) from public;
revoke all on function public.app_setup_instance(text, text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.app_public_sign_in(text, text, text) from public;
revoke all on function public.app_public_restore_session(text) from public;
revoke all on function public.app_public_sign_out(text) from public;
revoke all on function public.app_public_request_password_reset(text) from public;
revoke all on function public.app_public_export_snapshot(text) from public;
revoke all on function public.app_public_save_snapshot(text, jsonb) from public;

grant execute on function public.app_get_setup_status(text) to anon, authenticated;
grant execute on function public.app_setup_instance(text, text, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.app_public_sign_in(text, text, text) to anon, authenticated;
grant execute on function public.app_public_restore_session(text) to anon, authenticated;
grant execute on function public.app_public_sign_out(text) to anon, authenticated;
grant execute on function public.app_public_request_password_reset(text) to anon, authenticated;
grant execute on function public.app_public_export_snapshot(text) to anon, authenticated;
grant execute on function public.app_public_save_snapshot(text, jsonb) to anon, authenticated;
