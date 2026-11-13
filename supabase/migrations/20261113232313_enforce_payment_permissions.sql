do $migration$
declare
  v_entry record;
  v_definition text;
  v_updated text;
begin
  for v_entry in select * from (values
    ('public.app_public_register_invoice_payment(text,text,text,numeric,text,jsonb)', 'invoices:write', 'invoices'),
    ('public.app_public_register_supplier_payment(text,text,text,numeric,text,text)', 'purchases:write', 'purchases')
  ) as entry(signature, permission, module)
  loop
    v_definition := pg_get_functiondef(v_entry.signature::regprocedure);
    if position('app_assert_membership_permission' in v_definition) > 0 then
      raise exception 'Payment function already has a permissions check: %', v_entry.signature;
    end if;
    v_updated := replace(v_definition,
      'select * into v_ctx from public.app_public_session_context(p_session_token);',
      format('select * into v_ctx from public.app_public_session_context(p_session_token); perform private.app_assert_membership_permission(v_ctx.session_commerce_id, v_ctx.session_user_id, v_ctx.session_is_owner, %L, %L);', v_entry.permission, v_entry.module));
    if v_updated = v_definition then raise exception 'Unexpected payment function definition: %', v_entry.signature; end if;
    execute v_updated;
  end loop;
end;
$migration$;
