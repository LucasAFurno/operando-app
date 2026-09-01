create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create table if not exists public.platform_event_outbox (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerce_accounts(id) on delete cascade,
  event_type text not null check (event_type in ('commerce_created', 'first_product', 'first_cash_open', 'first_sale')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz,
  dispatch_request_id bigint,
  dispatch_error text,
  unique (commerce_id, event_type)
);

alter table public.platform_event_outbox enable row level security;
revoke all on table public.platform_event_outbox from anon, authenticated;

create or replace function public.app_enqueue_platform_milestone()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_commerce_id uuid;
  v_event_type text;
  v_payload jsonb;
begin
  if tg_table_name = 'commerce_accounts' then
    v_commerce_id := new.id;
    v_event_type := 'commerce_created';
    v_payload := jsonb_build_object(
      'commerce_name', new.name,
      'owner_email', new.owner_email,
      'plan', new.active_plan
    );
  elsif tg_table_name = 'products' then
    v_commerce_id := new.commerce_id;
    v_event_type := 'first_product';
    v_payload := jsonb_build_object('product_name', new.name);
  elsif tg_table_name = 'cash_sessions' then
    v_commerce_id := new.commerce_id;
    v_event_type := 'first_cash_open';
    v_payload := jsonb_build_object('opened_at', new.opened_at);
  elsif tg_table_name = 'sales' then
    v_commerce_id := new.commerce_id;
    v_event_type := 'first_sale';
    v_payload := jsonb_build_object(
      'total_amount', new.total_amount,
      'sold_at', new.sold_at
    );
  else
    return new;
  end if;

  insert into public.platform_event_outbox (commerce_id, event_type, payload)
  values (v_commerce_id, v_event_type, v_payload)
  on conflict (commerce_id, event_type) do nothing;

  return new;
end;
$$;

revoke all on function public.app_enqueue_platform_milestone() from public, anon, authenticated;

drop trigger if exists commerce_accounts_platform_milestone on public.commerce_accounts;
create trigger commerce_accounts_platform_milestone
after insert on public.commerce_accounts
for each row execute function public.app_enqueue_platform_milestone();

drop trigger if exists products_platform_milestone on public.products;
create trigger products_platform_milestone
after insert on public.products
for each row execute function public.app_enqueue_platform_milestone();

drop trigger if exists cash_sessions_platform_milestone on public.cash_sessions;
create trigger cash_sessions_platform_milestone
after insert on public.cash_sessions
for each row execute function public.app_enqueue_platform_milestone();

drop trigger if exists sales_platform_milestone on public.sales;
create trigger sales_platform_milestone
after insert on public.sales
for each row execute function public.app_enqueue_platform_milestone();

create or replace function public.app_dispatch_platform_event_telegram()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net, pg_temp
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

  update public.platform_event_outbox
  set dispatched_at = now(), dispatch_request_id = v_request_id, dispatch_error = null
  where id = new.id;

  return new;
exception
  when others then
    update public.platform_event_outbox
    set dispatch_error = left(sqlerrm, 500)
    where id = new.id;
    return new;
end;
$$;

revoke all on function public.app_dispatch_platform_event_telegram() from public, anon, authenticated;

drop trigger if exists platform_event_outbox_telegram on public.platform_event_outbox;
create trigger platform_event_outbox_telegram
after insert on public.platform_event_outbox
for each row execute function public.app_dispatch_platform_event_telegram();

comment on table public.platform_event_outbox is
  'Internal milestone queue for owner notifications. Never exposed to commerce users.';
