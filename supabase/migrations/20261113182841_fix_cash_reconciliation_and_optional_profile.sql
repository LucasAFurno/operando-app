-- Preserve each installation's session/permission checks and existing grants.
-- Cloud sale operations already append kind='sale' receipts to the cash ledger.
-- The payment-table sum is only a fallback for sessions without those entries.
do $migration$
declare
  v_definition text;
  v_updated text;
begin
  v_definition := pg_get_functiondef('public.app_public_close_cash_session(text,text,numeric)'::regprocedure);
  v_updated := replace(v_definition,
    'v_expected_amount := coalesce(v_session.opening_amount, 0) + v_cash_sales + v_manual_delta;',
    $replacement$if exists (
    select 1 from public.cash_movements
    where cash_session_id = v_session.id
      and commerce_id = v_ctx.session_commerce_id
      and kind = 'sale'
  ) then
    v_cash_sales := 0;
  end if;
  v_expected_amount := coalesce(v_session.opening_amount, 0) + v_cash_sales + v_manual_delta;$replacement$);
  if v_updated = v_definition then
    raise exception 'Unexpected cash-close definition; review before applying this migration';
  end if;
  execute v_updated;

  v_definition := pg_get_functiondef('public.app_public_update_progressive_profile(text,text,text,text,text,boolean,jsonb,text)'::regprocedure);
  v_updated := replace(v_definition,
    $old$if v_status = 'complete' and (trim(coalesce(p_phone, '')) = '' or v_email = '') then raise exception 'progressive_contact_required'; end if;$old$,
    '-- Contact is optional; nonempty values are still validated below.');
  if v_updated = v_definition then
    raise exception 'Unexpected progressive-profile definition; review before applying this migration';
  end if;
  execute v_updated;
end;
$migration$;
