import test from 'node:test'
import assert from 'node:assert/strict'
import { createBrowserDataStore } from '../site/data-store.js'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

test('cashier cannot create products or users', async () => {
  const store = createBrowserDataStore({ seedDemoData: true })
  assert.equal((await store.authenticateUser('caja@demo.local', 'demo1111')).ok, true)
  assert.equal((await store.createProduct({ name: 'QA', sku: 'QA' })).ok, false)
  assert.equal((await store.createUser({ fullName: 'QA', roleId: 'role-admin', email: 'qa@example.com', pin: '123456' })).ok, false)
})

test('warehouse user cannot register a sale', async () => {
  const store = createBrowserDataStore({ seedDemoData: true })
  assert.equal((await store.authenticateUser('deposito@demo.local', 'demo2222')).ok, true)
  const product = store.getSnapshot().products.find((entry) => entry.stock > 0)
  assert.equal((await store.createSale({ items: [{ productId: product.id, quantity: 1 }], paymentMethod: 'transfer', isPaid: true })).ok, false)
})

test('database payment endpoints enforce blocked permission and allowed module', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create schema private;
      create table public.commerce_memberships(commerce_id uuid, user_id uuid, status text, is_owner boolean, updated_at timestamptz, blocked_permissions jsonb, allowed_modules jsonb);
      insert into public.commerce_memberships values ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','active',false,now(),'["invoices:write"]','["invoices"]');
      create function public.app_public_session_context(text) returns table(session_commerce_id uuid, session_user_id uuid, session_is_owner boolean) language sql as $$ select '11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, false $$;
      create function public.app_public_register_invoice_payment(text,text,text,numeric,text,jsonb) returns text language plpgsql as $$ declare v_ctx record; begin select * into v_ctx from public.app_public_session_context(p_session_token); return 'ok'; end $$;
    `.replace('register_invoice_payment(text,text,text,numeric,text,jsonb)', 'register_invoice_payment(p_session_token text,text,text,numeric,text,jsonb)'))
    await db.exec(`create function public.app_public_register_supplier_payment(p_session_token text,text,text,numeric,text,text) returns text language plpgsql as $$ declare v_ctx record; begin select * into v_ctx from public.app_public_session_context(p_session_token); return 'ok'; end $$;`)
    const permissions = await readFile(new URL('../supabase/migrations/20260906180000_enforce_blocked_permissions_writes.sql', import.meta.url), 'utf8')
    const helper = permissions.slice(permissions.indexOf('create or replace function private.app_assert_membership_permission(')).split('$$;')[0] + '$$;'
    await db.exec(helper)
    await db.exec(await readFile(new URL('../supabase/migrations/20261113232313_enforce_payment_permissions.sql', import.meta.url), 'utf8'))
    await assert.rejects(db.query("select public.app_public_register_invoice_payment('x','x','transfer',1,'','{}')"), /permission_denied/)
    await assert.rejects(db.query("select public.app_public_register_supplier_payment('x','x','transfer',1,'','')"), /permission_denied/)
    await db.exec("update public.commerce_memberships set blocked_permissions='[]', allowed_modules='[\"invoices\",\"purchases\"]'")
    assert.equal((await db.query("select public.app_public_register_invoice_payment('x','x','transfer',1,'','{}') as result")).rows[0].result, 'ok')
    assert.equal((await db.query("select public.app_public_register_supplier_payment('x','x','transfer',1,'','') as result")).rows[0].result, 'ok')
  } finally { await db.close() }
})
