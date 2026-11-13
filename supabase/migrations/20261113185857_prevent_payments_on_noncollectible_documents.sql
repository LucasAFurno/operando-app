do $migration$
declare
  v_definition text := pg_get_functiondef('public.app_public_register_invoice_payment(text,text,text,numeric,text,jsonb)'::regprocedure);
  v_updated text;
begin
  v_updated := replace(v_definition,
    $old$if v_document.id is null then raise exception 'invoice_not_found'; end if;$old$,
    $new$if v_document.id is null then raise exception 'invoice_not_found'; end if;
  if lower(coalesce(v_document.kind, '')) not in ('factura', 'ticket') or lower(coalesce(v_document.status, '')) in ('anulada', 'anulado', 'cancelled', 'cobrada', 'cobrado') then raise exception 'document_not_collectible'; end if;$new$);
  if v_updated = v_definition then raise exception 'Unexpected invoice payment definition'; end if;
  execute v_updated;
end;
$migration$;
