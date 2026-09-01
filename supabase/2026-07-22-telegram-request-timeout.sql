create or replace function public.app_dispatch_platform_event_telegram()
returns trigger
language plpgsql
security definer
set search_path = public, private, vault, net, pg_temp
as $$
declare
  v_bot_token text;
  v_chat_id text;
  v_commerce_name text;
  v_message text;
  v_request_id bigint;
begin
  select decrypted_secret into v_bot_token
  from vault.decrypted_secrets
  where name = 'pclaf_control_telegram_bot_token'
  limit 1;

  select decrypted_secret into v_chat_id
  from vault.decrypted_secrets
  where name = 'pclaf_control_telegram_chat_id'
  limit 1;

  if coalesce(v_bot_token, '') = '' or coalesce(v_chat_id, '') = '' then
    return new;
  end if;

  select name into v_commerce_name
  from public.commerce_accounts
  where id = new.commerce_id;

  v_message := case new.event_type
    when 'commerce_created' then format(
      E'operando.app\nNueva cuenta: %s\nResponsable: %s\nPlan: %s',
      coalesce(v_commerce_name, 'Sin nombre'),
      coalesce(new.payload ->> 'owner_email', '-'),
      coalesce(new.payload ->> 'plan', '-')
    )
    when 'first_product' then format(
      E'operando.app\n%s cargo su primer producto: %s',
      coalesce(v_commerce_name, 'Un comercio'),
      coalesce(new.payload ->> 'product_name', '-')
    )
    when 'first_cash_open' then format(
      E'operando.app\n%s abrio su primera caja.',
      coalesce(v_commerce_name, 'Un comercio')
    )
    when 'first_sale' then format(
      E'operando.app\n%s registro su primera venta por $%s.',
      coalesce(v_commerce_name, 'Un comercio'),
      coalesce(new.payload ->> 'total_amount', '0')
    )
    else 'operando.app: nueva actividad.'
  end;

  select net.http_post(
    url := 'https://api.telegram.org/bot' || v_bot_token || '/sendMessage',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('chat_id', v_chat_id, 'text', v_message),
    timeout_milliseconds := 15000
  ) into v_request_id;

  update private.platform_event_outbox
  set dispatched_at = now(), dispatch_request_id = v_request_id, dispatch_error = null
  where id = new.id;

  return new;
exception
  when others then
    update private.platform_event_outbox
    set dispatch_error = left(sqlerrm, 500)
    where id = new.id;
    return new;
end;
$$;

revoke all on function public.app_dispatch_platform_event_telegram() from public, anon, authenticated;
