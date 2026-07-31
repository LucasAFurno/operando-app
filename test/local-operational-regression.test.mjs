import test from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'

globalThis.crypto ??= webcrypto

const { createBrowserDataStore } = await import('../data-store.js')

const createAuthenticatedStore = async () => {
  const store = createBrowserDataStore()
  assert.deepEqual(await store.authenticateUser('admin@demo.local', 'demo1234'), { ok: true })
  return store
}

test('desktop local: una venta descuenta stock y rechaza una segunda venta sin unidades', async () => {
  const store = await createAuthenticatedStore()
  const product = store.getSnapshot().products.find((entry) => entry.trackStock)
  const quantity = product.stock
  assert.ok(quantity > 0)

  const sale = await store.createSale({
    items: [{ productId: product.id, quantity }],
    paymentMethod: 'transfer',
    channel: 'Mostrador',
    isPaid: true,
  })
  assert.equal(sale.ok, true)
  assert.equal(store.getSnapshot().products.find((entry) => entry.id === product.id).stock, 0)

  const repeated = await store.createSale({
    items: [{ productId: product.id, quantity: 1 }],
    paymentMethod: 'transfer',
    channel: 'Mostrador',
    isPaid: true,
  })
  assert.equal(repeated.ok, false)
  assert.match(repeated.message, /stock/i)
})

test('desktop local: no permite cobrar efectivo sin una caja abierta', async () => {
  const store = await createAuthenticatedStore()
  const openSession = store.getSnapshot().cashSessions.find((entry) => entry.status === 'open')
  if (openSession) assert.equal((await store.closeCashSession({ cashSessionId: openSession.id, countedAmount: openSession.openingAmount })).ok, true)
  const product = store.getSnapshot().products.find((entry) => entry.trackStock && entry.stock > 0)
  const salesBefore = store.getSnapshot().sales.length

  const result = await store.createSale({
    items: [{ productId: product.id, quantity: 1 }],
    paymentMethod: 'cash',
    cashAmount: product.salePrice,
    channel: 'Mostrador',
    isPaid: true,
  })

  assert.equal(result.ok, false)
  assert.match(result.message, /caja abierta/i)
  assert.equal(store.getSnapshot().sales.length, salesBefore)
})

test('cloud sale migration retains tenant-bound idempotency and stock locks', async () => {
  const source = await (await import('node:fs/promises')).readFile(
    new URL('../supabase/migrations/20260728023000_sale_operation_idempotency.sql', import.meta.url),
    'utf8',
  )

  assert.match(source, /primary key \(commerce_id, operation_id\)/i)
  assert.match(source, /where commerce_id = v_ctx\.session_commerce_id[\s\S]*?and operation_id = v_operation_id/i)
  assert.match(source, /for update of stock/i)
  assert.match(source, /select \* into v_ctx from public\.app_public_session_context\(p_session_token\)/i)
})
