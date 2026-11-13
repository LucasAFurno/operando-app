import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('migration fixes cloud cash close and allows empty optional contact without removing validation', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create table commerce_accounts (id uuid primary key, onboarding_country text, onboarding_industry text, onboarding_phone text,
        onboarding_email text, onboarding_needs_arca boolean, onboarding_goals jsonb, onboarding_status text, updated_at timestamptz);
      create table cash_sessions (id uuid primary key, commerce_id uuid, opening_amount numeric, counted_amount numeric,
        expected_amount numeric, difference_amount numeric, status text, closed_by uuid, closed_at timestamptz);
      create table sales (id uuid primary key, cash_session_id uuid);
      create table sale_payments (sale_id uuid, amount numeric, method_key text);
      create table cash_movements (cash_session_id uuid, commerce_id uuid, kind text, signed_amount numeric);
      create function app_try_uuid(text) returns uuid language sql as 'select $1::uuid';
      create function app_public_session_context(text) returns table(session_commerce_id uuid, session_user_id uuid, session_is_owner boolean, session_role_key text)
      language plpgsql as $$ begin
        if $1 not in ('qa-owner','qa-cashier') then raise exception 'invalid_session'; end if;
        return query select '11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, $1 = 'qa-owner', 'admin'::text;
      end $$;
      insert into commerce_accounts(id) values ('11111111-1111-4111-8111-111111111111');
      insert into cash_sessions(id,commerce_id,opening_amount,status) values ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',5000,'open');
      insert into sales values ('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333');
      insert into sale_payments values ('44444444-4444-4444-8444-444444444444',3000,'cash');
      insert into cash_movements values ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','sale',3000);
    `)
    const cashSource = await readFile(new URL('../supabase/2026-07-17-core-public-ops-phase2.sql', import.meta.url), 'utf8')
    const cashFunction = cashSource.slice(cashSource.indexOf('create or replace function public.app_public_close_cash_session(')).split('$$;')[0] + '$$;'
    const profileSource = await readFile(new URL('../supabase/migrations/20260830232631_progressive_profile_contact_email.sql', import.meta.url), 'utf8')
    const profileFunction = profileSource.slice(profileSource.indexOf('create function public.app_public_update_progressive_profile(')).split('$$;')[0] + '$$;'
    await db.exec(cashFunction + profileFunction)
    const profile = (args = "p_session_token => 'qa-owner'") => db.query(`select app_public_update_progressive_profile(${args}, p_status => 'complete') as profile`)
    await assert.rejects(profile(), /progressive_contact_required/)
    await db.exec(await readFile(new URL('../supabase/migrations/20261113182841_fix_cash_reconciliation_and_optional_profile.sql', import.meta.url), 'utf8'))
    assert.equal((await profile()).rows[0].profile.onboarding_status, 'complete')
    await assert.rejects(profile("p_session_token => 'qa-cashier'"), /owner_required/)
    await assert.rejects(profile("p_session_token => 'qa-owner', p_phone => 'bad'"), /invalid_phone/)
    await assert.rejects(profile("p_session_token => 'qa-owner', p_email => 'bad'"), /invalid_email/)
    const close = () => db.query("select app_public_close_cash_session('qa-owner','33333333-3333-4333-8333-333333333333',8000) as result")
    assert.equal((await close()).rows[0].result.difference_amount, 0)
    await db.exec("update cash_sessions set status='open'; delete from cash_movements;")
    assert.equal((await close()).rows[0].result.expected_amount, 8000, 'legacy payment-only sessions remain supported')
    await db.exec("update cash_sessions set status='open'; insert into cash_movements values ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','sale',3000), ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','refund',-3000); delete from sale_payments;")
    assert.equal((await close()).rows[0].result.expected_amount, 5000, 'cancellation refunds reconcile with the original receipt')
  } finally {
    await db.close()
  }
})
