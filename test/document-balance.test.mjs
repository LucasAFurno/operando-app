import test from 'node:test'
import assert from 'node:assert/strict'
import { invoiceBalance } from '../site/operational-utils.js'

test('only open collectible documents contribute the unpaid balance', () => {
  assert.equal(invoiceBalance({ kind: 'Factura', status: 'Emitida', totalAmount: 2500, amountPaid: 1000 }), 1500)
  for (const kind of ['Presupuesto', 'presupuesto', 'Remito', 'Nota de credito']) {
    assert.equal(invoiceBalance({ kind, status: 'Emitida', totalAmount: 2500 }), 0)
  }
  for (const status of ['Anulada', 'Cobrada']) {
    assert.equal(invoiceBalance({ kind: 'Factura', status, totalAmount: 2500 }), 0)
  }
})
