-- The ledger already stores signed_amount. Recomputing its sign from just
-- 'expense' turns refunds and withdrawals into fictitious cash income.
do $migration$
declare
  v_definition text := pg_get_functiondef('public.app_public_export_snapshot(text)'::regprocedure);
  v_updated text;
begin
  v_updated := replace(v_definition,
    $old$'signedAmount', case when kind = 'expense' then amount * -1 else amount end$old$,
    $new$'signedAmount', signed_amount$new$);
  if v_updated = v_definition then raise exception 'Unexpected cash movement export definition'; end if;
  execute v_updated;
end;
$migration$;
