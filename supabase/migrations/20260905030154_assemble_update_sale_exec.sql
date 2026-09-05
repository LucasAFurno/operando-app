-- execute assembled update_sale and cleanup
do $outer$
declare
  v_sql text;
begin
  select body into v_sql from private._p0_sql_assemble where k = 'update_sale';
  if v_sql is null or length(v_sql) < 100 then
    raise exception 'update_sale_sql_missing';
  end if;
  execute v_sql;
end;
$outer$;
drop table if exists private._p0_sql_assemble;
