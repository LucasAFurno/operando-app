alter table public.control_users
  add column if not exists is_platform_admin boolean not null default false;

update public.control_users
set is_platform_admin = true
where lower(coalesce(email, '')) in (
  'admin@operando.control',
  'lucas_yenkoz28@hotmail.com'
);

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
      'is_platform_admin', coalesce(v_user.is_platform_admin, false),
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
      'status', v_commerce.status
    )
  );
end;
$$;

create or replace function public.app_public_export_snapshot(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_session public.control_user_sessions;
  v_user public.control_users;
  v_commerce public.commerce_accounts;
  v_membership public.commerce_memberships;
  v_is_admin boolean := false;
  v_roles jsonb := jsonb_build_array(
    jsonb_build_object('id', 'role-admin', 'key', 'admin', 'name', 'Administrador', 'permissions', jsonb_build_array('dashboard:view','customers:view','sales:view','cash:view','branches:view','registers:view','products:view','purchases:view','invoices:view','tickets:view','reports:view','settings:view','customers:write','sales:write','cash:operate','branches:manage','registers:manage','products:write','products:adjust','products:transfer','purchases:write','invoices:write','tickets:write','reports:export','settings:manage')),
    jsonb_build_object('id', 'role-cashier', 'key', 'cashier', 'name', 'Caja', 'permissions', jsonb_build_array('dashboard:view','customers:view','sales:view','cash:view','invoices:view','reports:view','customers:write','sales:write','cash:operate','invoices:write')),
    jsonb_build_object('id', 'role-warehouse', 'key', 'warehouse', 'name', 'Deposito', 'permissions', jsonb_build_array('dashboard:view','customers:view','products:view','purchases:view','tickets:view','reports:view','customers:write','products:write','products:adjust','products:transfer','purchases:write','tickets:write'))
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
  select *
  into v_membership
  from public.commerce_memberships
  where commerce_id = v_session.commerce_id
    and user_id = v_session.user_id
    and status = 'active'
  order by is_owner desc, updated_at desc
  limit 1;

  if v_membership.id is null then
    raise exception 'session_forbidden';
  end if;

  v_is_admin := coalesce(v_membership.is_owner, false) or coalesce(v_membership.role_key, '') in ('owner', 'admin');

  return jsonb_build_object(
    'meta', jsonb_build_object(
      'schemaVersion', 6,
      'edition', 'cloud-core',
      'adapter', 'supabase-core',
      'syncStatus', 'online',
      'lastSyncedAt', now(),
      'instanceKey', v_commerce.instance_key
    ),
    'business', jsonb_build_object(
      'name', v_commerce.name,
      'organization', coalesce(nullif(v_commerce.legal_name, ''), v_commerce.name),
      'currentBranchId', coalesce(v_user.active_branch_id, (select id from public.branches where commerce_id = v_commerce.id order by created_at asc limit 1)),
      'currentRegisterId', coalesce(v_user.assigned_register_id, (select id from public.registers where commerce_id = v_commerce.id order by created_at asc limit 1)),
      'enabledModules', public.app_effective_enabled_modules(v_commerce.id),
      'activePlan', v_commerce.active_plan,
      'documentCounters', coalesce(v_commerce.settings_json -> 'documentCounters', '{}'::jsonb),
      'billingStatus', v_commerce.billing_status,
      'onboardingStatus', v_commerce.onboarding_status,
      'trialEndsAt', v_commerce.trial_ends_at,
      'allowPublicSignup', v_commerce.allow_public_signup
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
        'email', case when v_is_admin or cu.id = v_user.id then cu.email else '' end,
        'loginName', case when v_is_admin or cu.id = v_user.id then coalesce(cu.login_name, '') else '' end,
        'pin', '',
        'isActive', (cu.status = 'active' and coalesce(cm.status, 'active') = 'active'),
        'isPlatformAdmin', coalesce(cu.is_platform_admin, false)
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
    'customers', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'fullName', full_name, 'phone', phone, 'email', email, 'balance', balance, 'tag', tag) order by created_at asc) from public.customers where commerce_id = v_commerce.id), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'sku', p.sku, 'barcode', p.barcode, 'stock', coalesce((select sum(quantity) from public.product_branch_stock where product_id = p.id), 0), 'salePrice', p.sale_price, 'costPrice', p.cost_price, 'minStock', p.min_stock, 'category', p.category, 'trackStock', p.track_stock, 'stockByBranch', coalesce((select jsonb_object_agg(branch_id::text, quantity) from public.product_branch_stock where product_id = p.id), '{}'::jsonb)) order by p.created_at asc) from public.products p where p.commerce_id = v_commerce.id), '[]'::jsonb),
    'suppliers', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'contact', contact, 'phone', phone, 'email', email, 'category', category, 'balance', balance, 'lastDelivery', last_delivery, 'notes', notes) order by created_at asc) from public.suppliers where commerce_id = v_commerce.id), '[]'::jsonb),
    'cashSessions', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'openedBy', opened_by, 'openingAmount', opening_amount, 'status', status, 'openedAt', opened_at, 'closedAt', closed_at, 'countedAmount', counted_amount, 'differenceAmount', difference_amount, 'branchId', branch_id, 'registerId', register_id) order by opened_at desc) from public.cash_sessions where commerce_id = v_commerce.id), '[]'::jsonb),
    'purchaseReceipts', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'branchId', branch_id, 'supplierId', supplier_id, 'productId', product_id, 'receivedBy', received_by, 'documentNumber', document_number, 'quantity', quantity, 'unitCost', unit_cost, 'note', note, 'receivedAt', received_at, 'updatedAt', updated_at) order by received_at desc) from public.purchase_receipts where commerce_id = v_commerce.id), '[]'::jsonb),
    'sales', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'branchId', s.branch_id, 'registerId', s.register_id, 'sellerUserId', s.seller_user_id, 'customerId', s.customer_id, 'cashSessionId', s.cash_session_id, 'channel', initcap(s.channel), 'paymentMethod', s.payment_method, 'status', s.status, 'subtotalAmount', s.subtotal_amount, 'discountAmount', s.discount_amount, 'totalAmount', s.total_amount, 'amountPaid', s.amount_paid, 'note', s.note, 'soldAt', s.sold_at, 'updatedAt', s.updated_at, 'paymentBreakdown', coalesce((select jsonb_object_agg(method_key, amount) from public.sale_payments where sale_id = s.id), '{}'::jsonb), 'items', coalesce((select jsonb_agg(jsonb_build_object('productId', product_id, 'quantity', quantity, 'unitPrice', unit_price, 'lineTotal', line_total) order by id asc) from public.sale_items where sale_id = s.id), '[]'::jsonb)) order by s.sold_at desc) from public.sales s where s.commerce_id = v_commerce.id), '[]'::jsonb),
    'invoices', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'branchId', branch_id, 'saleId', sale_id, 'customerId', customer_id, 'number', document_number, 'kind', kind, 'type', fiscal_type, 'status', status, 'fiscalStatus', fiscal_status, 'totalAmount', total_amount, 'dueDate', issued_at::date, 'issuedAt', issued_at, 'updatedAt', updated_at) order by issued_at desc) from public.documents where commerce_id = v_commerce.id and kind in ('factura', 'presupuesto', 'remito', 'nota_credito')), '[]'::jsonb),
    'tickets', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'branchId', branch_id, 'saleId', sale_id, 'customerId', customer_id, 'number', document_number, 'device', coalesce(payload_json ->> 'device', ''), 'issue', coalesce(payload_json ->> 'issue', ''), 'status', status, 'updatedAt', updated_at) order by updated_at desc) from public.documents where commerce_id = v_commerce.id and kind in ('ticket', 'postventa')), '[]'::jsonb),
    'cashMovements', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'branchId', branch_id, 'registerId', register_id, 'cashSessionId', cash_session_id, 'createdBy', created_by, 'kind', kind, 'amount', amount, 'signedAmount', signed_amount, 'note', note, 'createdAt', created_at) order by created_at desc) from public.cash_movements where commerce_id = v_commerce.id), '[]'::jsonb),
    'stockMovements', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'branchId', branch_id, 'productId', product_id, 'referenceId', reference_id, 'type', movement_type, 'movementType', movement_type, 'referenceType', reference_type, 'quantity', quantity, 'notes', notes, 'createdBy', created_by, 'createdAt', created_at) order by created_at desc) from public.stock_movements where commerce_id = v_commerce.id), '[]'::jsonb),
    'auditLogs', case when v_is_admin then coalesce((select jsonb_agg(jsonb_build_object('id', id, 'actorUserId', actor_user_id, 'entityType', entity_type, 'entityId', entity_id, 'action', action, 'beforeData', before_data, 'afterData', after_data, 'createdAt', created_at) order by created_at desc) from public.audit_logs_core where commerce_id = v_commerce.id), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$function$;

create or replace function public.app_public_platform_overview(
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

  select *
  into v_user
  from public.control_users
  where id = v_session.user_id
  limit 1;

  if v_user.id is null or v_user.status <> 'active' then
    raise exception 'user_inactive';
  end if;

  if not coalesce(v_user.is_platform_admin, false) then
    raise exception 'platform_admin_required';
  end if;

  return jsonb_build_object(
    'summary', jsonb_build_object(
      'total_commerces', (select count(*) from public.commerce_accounts),
      'trial_commerces', (select count(*) from public.commerce_accounts where billing_status = 'trial'),
      'active_commerces', (select count(*) from public.commerce_accounts where status = 'active'),
      'paused_commerces', (select count(*) from public.commerce_accounts where status = 'paused' or billing_status = 'paused'),
      'expired_commerces', (select count(*) from public.commerce_accounts where billing_status in ('past_due', 'cancelled')),
      'total_users', (select count(*) from public.control_users),
      'total_branches', (select count(*) from public.branches),
      'total_registers', (select count(*) from public.registers)
    ),
    'commerces', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', commerce.id,
        'name', commerce.name,
        'instance_key', commerce.instance_key,
        'owner_email', commerce.owner_email,
        'active_plan', commerce.active_plan,
        'status', commerce.status,
        'billing_status', commerce.billing_status,
        'onboarding_status', commerce.onboarding_status,
        'allow_public_signup', commerce.allow_public_signup,
        'trial_started_at', commerce.trial_started_at,
        'trial_ends_at', commerce.trial_ends_at,
        'created_at', commerce.created_at,
        'updated_at', commerce.updated_at,
        'last_access_at', (
          select max(cu.last_login_at)
          from public.commerce_memberships cm
          join public.control_users cu on cu.id = cm.user_id
          where cm.commerce_id = commerce.id
        ),
        'branches_count', (select count(*) from public.branches where commerce_id = commerce.id),
        'registers_count', (select count(*) from public.registers where commerce_id = commerce.id),
        'users_count', (select count(*) from public.commerce_memberships where commerce_id = commerce.id and status = 'active'),
        'enabled_modules', public.app_effective_enabled_modules(commerce.id),
        'branches', coalesce((select jsonb_agg(jsonb_build_object('id', branch.id, 'name', branch.name, 'code', branch.code, 'address', branch.address, 'is_active', branch.is_active) order by branch.created_at asc) from public.branches branch where branch.commerce_id = commerce.id), '[]'::jsonb),
        'registers', coalesce((select jsonb_agg(jsonb_build_object('id', register.id, 'branch_id', register.branch_id, 'name', register.name, 'code', register.code, 'is_active', register.is_active) order by register.created_at asc) from public.registers register where register.commerce_id = commerce.id), '[]'::jsonb),
        'users', coalesce((select jsonb_agg(jsonb_build_object('id', cu.id, 'full_name', cu.full_name, 'email', cu.email, 'role_key', cm.role_key, 'status', cm.status, 'is_owner', cm.is_owner, 'last_login_at', cu.last_login_at) order by cm.is_owner desc, cu.created_at asc) from public.commerce_memberships cm join public.control_users cu on cu.id = cm.user_id where cm.commerce_id = commerce.id), '[]'::jsonb)
      ) order by commerce.created_at desc)
      from public.commerce_accounts commerce
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.app_public_platform_update_commerce(
  p_session_token text,
  p_commerce_id uuid,
  p_active_plan text default null,
  p_status text default null,
  p_billing_status text default null,
  p_allow_public_signup boolean default null
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

  select *
  into v_user
  from public.control_users
  where id = v_session.user_id
  limit 1;

  if v_user.id is null or v_user.status <> 'active' then
    raise exception 'user_inactive';
  end if;

  if not coalesce(v_user.is_platform_admin, false) then
    raise exception 'platform_admin_required';
  end if;

  update public.commerce_accounts
  set
    active_plan = coalesce(nullif(trim(coalesce(p_active_plan, '')), ''), active_plan),
    status = coalesce(nullif(trim(coalesce(p_status, '')), ''), status),
    billing_status = coalesce(nullif(trim(coalesce(p_billing_status, '')), ''), billing_status),
    allow_public_signup = coalesce(p_allow_public_signup, allow_public_signup),
    updated_at = now()
  where id = p_commerce_id
  returning * into v_commerce;

  if v_commerce.id is null then
    raise exception 'commerce_not_found';
  end if;

  return jsonb_build_object(
    'ok', true,
    'message', 'Comercio actualizado.',
    'commerce_id', v_commerce.id
  );
end;
$$;
