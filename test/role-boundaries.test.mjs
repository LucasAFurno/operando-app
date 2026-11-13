import test from 'node:test'
import assert from 'node:assert/strict'
import { createBrowserDataStore } from '../site/data-store.js'

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
