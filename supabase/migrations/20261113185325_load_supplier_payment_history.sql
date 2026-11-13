-- Preserve the runtime loader's existing session checks and permissions.
do $migration$
declare
  v_definition text := pg_get_functiondef('public.app_public_load_runtime_state(text,text[])'::regprocedure);
  v_updated text;
begin
  v_updated := replace(v_definition, 'return v_base || v_data;', $replacement$
  if v_dashboard or 'purchases' = any(v_modules) then
    v_data := v_data || jsonb_build_object('supplierPayments', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'supplierId', p.supplier_id,
        'amount', p.amount, 'method', p.method_key, 'reference', p.reference,
        'createdAt', p.created_at) order by p.created_at desc)
      from public.supplier_payments p
      where p.commerce_id = (select session_commerce_id from public.app_public_session_context(p_session_token))
    ), '[]'::jsonb));
  end if;
  return v_base || v_data;$replacement$);
  if v_updated = v_definition then raise exception 'Unexpected runtime loader definition'; end if;
  execute v_updated;
end;
$migration$;
