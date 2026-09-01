-- Rebranding técnico de las dos instancias de plataforma.
update public.commerce_accounts
set instance_key = case lower(trim(instance_key))
  when 'pclaf-dev' then 'operando-dev'
  when 'pclaf-prod' then 'operando-prod'
  else instance_key
end
where lower(trim(coalesce(instance_key, ''))) in ('pclaf-dev', 'pclaf-prod');
