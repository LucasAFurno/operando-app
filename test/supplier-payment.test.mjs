import test from 'node:test'
import assert from 'node:assert/strict'
import { createBrowserDataStore } from '../site/data-store.js'

test('supplier partial payment reduces debt and rejects overpayment', async () => {
  const store = createBrowserDataStore({ seedDemoData: true })
  await store.authenticateUser('admin@demo.local', 'demo1234')
  assert.equal((await store.createSupplier({ name: 'QA Supplier', balance: 2400 })).ok, true)
  const supplier = store.getSnapshot().suppliers.find((entry) => entry.name === 'QA Supplier')
  assert.equal((await store.registerSupplierPayment({ supplierId: supplier.id, amount: 2500, method: 'transfer' })).ok, false)
  assert.equal((await store.registerSupplierPayment({ supplierId: supplier.id, amount: 1000, method: 'transfer' })).ok, true)
  assert.equal(store.getSnapshot().suppliers.find((entry) => entry.id === supplier.id).balance, 1400)
})
