import test from 'node:test'
import assert from 'node:assert/strict'
import { invoiceBalance } from '../site/operational-utils.js'
import { createBrowserDataStore } from '../site/data-store.js'

test('only open collectible documents contribute the unpaid balance', () => {
  assert.equal(invoiceBalance({ kind: 'Factura', status: 'Emitida', totalAmount: 2500, amountPaid: 1000 }), 1500)
  for (const kind of ['Presupuesto', 'presupuesto', 'Remito', 'Nota de credito']) {
    assert.equal(invoiceBalance({ kind, status: 'Emitida', totalAmount: 2500 }), 0)
  }
  for (const status of ['Anulada', 'Cobrada']) {
    assert.equal(invoiceBalance({ kind: 'Factura', status, totalAmount: 2500 }), 0)
  }
})

test('invoice payment details survive restoring a saved snapshot', async () => {
  const previousWindow = globalThis.window
  globalThis.window = { operandoDesktop: { isDesktop: true, initialize: (state) => state, saveSnapshot: (state) => state } }
  try {
    const store = createBrowserDataStore({ seedDemoData: true })
    await store.authenticateUser('admin@demo.local', 'demo1234')
    const snapshot = store.getSnapshot()
    snapshot.invoices = [{ id: 'qa', number: 'QA', totalAmount: 1500, amountPaid: 500, paymentHistory: [{ amount: 500 }], kind: 'Factura', status: 'Emitida' }]
    assert.equal(store.importData(snapshot).ok, true)
    const invoice = store.getSnapshot().invoices[0]
    assert.equal(invoiceBalance(invoice), 1000)
    assert.equal(invoice.paymentHistory[0].amount, 500)
  } finally { globalThis.window = previousWindow }
})
